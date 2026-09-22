import { afterEach, describe, expect, it } from "vitest";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";
import { sha256Hex } from "../convex/lib/hash";
import { TEST_PASSPHRASE, operatorToken } from "./helpers";

const modules = import.meta.glob(["../convex/**/*.ts", "../convex/**/*.js"]);

/**
 * A self-hosted deployment should be set up from its own website, not from a terminal.
 * That means the board itself has to be able to take the first passphrase - and the
 * whole safety of that rests on one rule: a deployment that already has an operator
 * cannot be claimed again.
 *
 * The order between the two ways in matters too. A passphrase set from the browser wins
 * over one the deployment was given in its environment, because the browser one is what
 * the operator chose most recently and can change without a redeploy.
 */
afterEach(() => {
  delete process.env.OPERATOR_PASSPHRASE_HASH;
});

function harness() {
  return convexTest(schema, modules);
}

describe("claiming a deployment from the board", () => {
  it("reports itself claimable while nothing is configured", async () => {
    const t = harness();
    const state = await t.query(api.auth.state, {});
    expect(state).toEqual({ configured: false, claimable: true, source: null });
  });

  it("cannot be claimed once the environment holds a passphrase", async () => {
    const t = harness();
    process.env.OPERATOR_PASSPHRASE_HASH = await sha256Hex(TEST_PASSPHRASE);
    const state = await t.query(api.auth.state, {});
    expect(state.claimable).toBe(false);
    expect(state.source).toBe("environment");
    await expect(
      t.mutation(api.auth.claim, { passphrase: "someone-elses-passphrase" })
    ).rejects.toThrow(/already has an operator/);
  });

  it("takes the passphrase, signs the operator in, and stores only its hash", async () => {
    const t = harness();
    const { token } = await t.mutation(api.auth.claim, { passphrase: "chosen-on-the-board" });

    const settings = await t.run(async (ctx) => ctx.db.query("operatorSettings").collect());
    expect(settings.length).toBe(1);
    expect(settings[0].passphraseHash).not.toBe("chosen-on-the-board");
    expect(settings[0].passphraseHash).toBe(await sha256Hex("chosen-on-the-board"));
    expect(settings[0].setFrom).toBe("browser");

    // and that token is a working session
    expect((await t.query(api.auth.current, { token })).signedIn).toBe(true);
    // while the old way in - the environment - is now irrelevant
    const state = await t.query(api.auth.state, {});
    expect(state).toEqual({ configured: true, claimable: false, source: "browser" });
  });

  it("refuses a second claim, so a board with an operator stays theirs", async () => {
    const t = harness();
    await t.mutation(api.auth.claim, { passphrase: "first-operator" });
    await expect(t.mutation(api.auth.claim, { passphrase: "second-operator" })).rejects.toThrow(
      /already has an operator/
    );
  });

  it("refuses a passphrase too short to be worth having", async () => {
    const t = harness();
    await expect(t.mutation(api.auth.claim, { passphrase: "short" })).rejects.toThrow(/eight characters/);
  });

  it("signs in with the browser passphrase after claiming, and not with the old one", async () => {
    const t = harness();
    process.env.OPERATOR_PASSPHRASE_HASH = await sha256Hex(TEST_PASSPHRASE);
    // an operator who claimed from the board changes what the deployment expects
    const { token } = await (async () => {
      const t2 = harness();
      delete process.env.OPERATOR_PASSPHRASE_HASH;
      return await t2.mutation(api.auth.claim, { passphrase: "from-the-board" });
    })();
    expect(token.length).toBe(64);

    const claimed = harness();
    await claimed.mutation(api.auth.claim, { passphrase: "from-the-board" });
    await expect(
      claimed.mutation(api.auth.signIn, { passphrase: TEST_PASSPHRASE })
    ).rejects.toThrow(/expects/);
    const ok = await claimed.mutation(api.auth.signIn, { passphrase: "from-the-board" });
    expect(ok.token.length).toBe(64);
  });
});

describe("changing the passphrase from the board", () => {
  it("needs a session", async () => {
    const t = harness();
    await t.mutation(api.auth.claim, { passphrase: "first-passphrase" });
    await expect(
      t.mutation(api.auth.changePassphrase, { current: "first-passphrase", next: "second-passphrase" })
    ).rejects.toThrow(/session is required/);
  });

  it("needs the current passphrase, not just a session", async () => {
    const t = harness();
    const { token } = await t.mutation(api.auth.claim, { passphrase: "first-passphrase" });
    await expect(
      t.mutation(api.auth.changePassphrase, {
        token,
        current: "not-the-current-one",
        next: "second-passphrase",
      })
    ).rejects.toThrow(/not the current passphrase/);
  });

  it("replaces it, and works when the deployment started from the environment", async () => {
    const t = harness();
    process.env.OPERATOR_PASSPHRASE_HASH = await sha256Hex(TEST_PASSPHRASE);
    const token = await operatorToken(t);

    const result = await t.mutation(api.auth.changePassphrase, {
      token,
      current: TEST_PASSPHRASE,
      next: "chosen-in-the-browser",
    });
    expect(result.changed).toBe(true);

    // the browser passphrase now wins over the one in the environment
    const ok = await t.mutation(api.auth.signIn, { passphrase: "chosen-in-the-browser" });
    expect(ok.token.length).toBe(64);
    await expect(t.mutation(api.auth.signIn, { passphrase: TEST_PASSPHRASE })).rejects.toThrow(/expects/);
  });

  it("ends every other session, because a new passphrase is also a revocation", async () => {
    const t = harness();
    const { token } = await t.mutation(api.auth.claim, { passphrase: "first-passphrase", label: "phone" });
    const second = await t.mutation(api.auth.signIn, { passphrase: "first-passphrase", label: "laptop" });
    expect((await t.query(api.auth.sessions, { token })).length).toBe(2);

    const result = await t.mutation(api.auth.changePassphrase, {
      token,
      current: "first-passphrase",
      next: "second-passphrase",
    });
    expect(result.otherSessionsEnded).toBe(1);
    expect((await t.query(api.auth.current, { token: second.token })).signedIn).toBe(false);
    expect((await t.query(api.auth.current, { token })).signedIn).toBe(true);
  });

  it("refuses a new passphrase that is too short", async () => {
    const t = harness();
    const { token } = await t.mutation(api.auth.claim, { passphrase: "first-passphrase" });
    await expect(
      t.mutation(api.auth.changePassphrase, { token, current: "first-passphrase", next: "short" })
    ).rejects.toThrow(/eight characters/);
  });
});

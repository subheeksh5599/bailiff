import { afterEach, describe, expect, it } from "vitest";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api, internal } from "../convex/_generated/api";

const modules = import.meta.glob(["../convex/**/*.ts", "../convex/**/*.js"]);

/**
 * The two ways in that do not go through the passphrase form.
 *
 * `mintSession` is the deployment key's own authority used a second time, so a recording or
 * an agent can drive a signed-in board without anyone typing a secret into it.
 * `clearBrowserPassphrase` is the way back in when the passphrase is lost.
 *
 * Both are load-bearing on a live deployment and both can be wrong in ways that stay
 * invisible until the moment they matter, which is why they are pinned rather than trusted.
 */
afterEach(() => {
  delete process.env.OPERATOR_PASSPHRASE_HASH;
});

function fresh() {
  return convexTest(schema, modules);
}

async function claimed(t: ReturnType<typeof convexTest>, passphrase: string) {
  await t.mutation(api.auth.claim, { passphrase, label: "test" });
  return t;
}

describe("a session minted from the deployment key", () => {
  it("is refused outright when no operator is configured", async () => {
    // An unclaimed deployment must not be able to hand out sessions. The mint is only
    // meaningful as a second expression of authority that already exists.
    await expect(fresh().mutation(internal.auth.mintSession, { label: "recorder" })).rejects.toThrow(
      /no operator passphrase/,
    );
  });

  it("signs in as an operator, and carries its label", async () => {
    const t = await claimed(fresh(), "the first passphrase");
    const minted = await t.mutation(internal.auth.mintSession, { label: "the recorder" });

    expect(minted.token.length).toBeGreaterThanOrEqual(32);
    expect(minted.expiresAt).toBeGreaterThan(Date.now());

    // It signs in for real, not merely exists: the token satisfies the operator gate.
    const signed = await t.query(api.auth.current, { token: minted.token });
    expect(signed.signedIn).toBe(true);
    expect(signed.label).toBe("the recorder");

    const rows = await t.query(api.auth.sessions, { token: minted.token });
    expect(rows.map((row) => row.label)).toContain("the recorder");
  });

  it("mints a different token each time, and an unissued one signs nobody in", async () => {
    const t = await claimed(fresh(), "the first passphrase");
    const first = await t.mutation(internal.auth.mintSession, {});
    const second = await t.mutation(internal.auth.mintSession, {});
    expect(first.token).not.toEqual(second.token);

    const stranger = await t.query(api.auth.current, { token: "not-a-token-that-was-ever-issued" });
    expect(stranger.signedIn).toBe(false);
  });
});

describe("forgetting the passphrase set from the browser", () => {
  it("reopens the board for claiming and kills the sessions with it", async () => {
    const t = await claimed(fresh(), "the first passphrase");
    const minted = await t.mutation(internal.auth.mintSession, { label: "the recorder" });

    const result = await t.mutation(internal.auth.clearBrowserPassphrase, {});
    expect(result.cleared).toBe(true);
    expect(result.sessionsEnded).toBeGreaterThan(0);

    const state = await t.query(api.auth.state, {});
    expect(state.claimable).toBe(true);
    expect(state.configured).toBe(false);

    // The part that matters: a forgotten passphrase must not leave a working key behind.
    const after = await t.query(api.auth.current, { token: minted.token });
    expect(after.signedIn).toBe(false);
    await expect(t.query(api.auth.sessions, { token: minted.token })).rejects.toThrow();
  });

  it("says so when there was nothing to clear", async () => {
    const result = await fresh().mutation(internal.auth.clearBrowserPassphrase, {});
    expect(result.cleared).toBe(false);
    expect(result.sessionsEnded).toBe(0);
  });

  it("lets a new passphrase in and keeps the old one out", async () => {
    const t = await claimed(fresh(), "the first passphrase");
    await t.mutation(internal.auth.clearBrowserPassphrase, {});
    await t.mutation(api.auth.claim, { passphrase: "a different passphrase" });

    await expect(t.mutation(api.auth.signIn, { passphrase: "the first passphrase" })).rejects.toThrow();
    const second = await t.mutation(api.auth.signIn, { passphrase: "a different passphrase" });
    expect(second.token).toBeTruthy();
  });
});

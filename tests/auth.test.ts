import { afterEach, describe, expect, it } from "vitest";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";
import { sha256Hex } from "../convex/lib/hash";
import { SESSION_TTL_MS, expired, randomToken } from "../convex/lib/session";
import { TEST_PASSPHRASE, operatorToken } from "./helpers";

const modules = import.meta.glob(["../convex/**/*.ts", "../convex/**/*.js"]);

/**
 * The board has to be a private surface: the reads stay public, because that is how
 * anyone checks the product, but closing a case, moving a charge, spending a call or
 * taking a file all require a session.
 *
 * What is worth pinning here is the refusal side. A deployment with no passphrase
 * configured refuses everyone rather than letting everyone through, a token that was
 * never issued is refused, an expired session is refused, and a signed-out token stops
 * working immediately. Those are the failures that would matter.
 */
afterEach(() => {
  delete process.env.OPERATOR_PASSPHRASE_HASH;
});

async function caseOpen(t: ReturnType<typeof convexTest>) {
  const { caseId } = await t.mutation(api.cases.openCase, {
    ref: "case-auth",
    customerRef: "cust-auth",
    counterpartyName: "Example Corp",
    channel: "phone",
  });
  await t.mutation(api.cases.freezeRequirements, {
    caseId,
    actor: "intake",
    requirements: [{ key: "refund_moved", label: "their record shows it moved", kind: "email_reply" }],
  });
  return caseId;
}

describe("signing in to the board", () => {
  it("issues a session for the deployment's passphrase, and only the hash is stored", async () => {
    const t = convexTest(schema, modules);
    process.env.OPERATOR_PASSPHRASE_HASH = await sha256Hex(TEST_PASSPHRASE);

    const { token, expiresAt } = await t.mutation(api.auth.signIn, { passphrase: TEST_PASSPHRASE });
    expect(token.length).toBe(64);
    expect(expiresAt).toBeGreaterThan(Date.now());

    const stored = await t.run(async (ctx) => ctx.db.query("operatorSessions").collect());
    expect(stored.length).toBe(1);
    expect(stored[0].tokenHash).not.toBe(token);
    expect(stored[0].tokenHash).toBe(await sha256Hex(token));
  });

  it("refuses the wrong passphrase", async () => {
    const t = convexTest(schema, modules);
    process.env.OPERATOR_PASSPHRASE_HASH = await sha256Hex(TEST_PASSPHRASE);
    await expect(t.mutation(api.auth.signIn, { passphrase: "not-it" })).rejects.toThrow(/expects/);
  });

  it("refuses everyone when the deployment has no passphrase configured", async () => {
    const t = convexTest(schema, modules);
    delete process.env.OPERATOR_PASSPHRASE_HASH;
    await expect(t.mutation(api.auth.signIn, { passphrase: TEST_PASSPHRASE })).rejects.toThrow(
      /no operator passphrase/
    );
    await expect(
      t.mutation(api.cases.attemptClose, { caseId: await caseOpen(t), actor: "board", token: "x".repeat(64) })
    ).rejects.toThrow(/no operator passphrase/);
  });

  it("lets a session act, and answers what the session is", async () => {
    const t = convexTest(schema, modules);
    const token = await operatorToken(t);
    const state = await t.query(api.auth.current, { token });
    expect(state.signedIn).toBe(true);
    const result = await t.mutation(api.cases.attemptClose, {
      caseId: await caseOpen(t),
      actor: "board",
      token,
    });
    expect(result.closed).toBe(false); // refused on the requirement, not on the session
  });

  it("refuses an action with no session at all", async () => {
    const t = convexTest(schema, modules);
    process.env.OPERATOR_PASSPHRASE_HASH = await sha256Hex(TEST_PASSPHRASE);
    await expect(
      t.mutation(api.cases.attemptClose, { caseId: await caseOpen(t), actor: "board" })
    ).rejects.toThrow(/session is required/);
  });

  it("refuses a token this deployment never issued", async () => {
    const t = convexTest(schema, modules);
    process.env.OPERATOR_PASSPHRASE_HASH = await sha256Hex(TEST_PASSPHRASE);
    await expect(
      t.mutation(api.cases.attemptClose, {
        caseId: await caseOpen(t),
        actor: "board",
        token: "f".repeat(64),
      })
    ).rejects.toThrow(/never issued|not one this deployment issued/);
  });

  it("refuses a session that has expired", async () => {
    const t = convexTest(schema, modules);
    const token = await operatorToken(t);
    const caseId = await caseOpen(t);
    // Age the session past its life the way time would.
    await t.run(async (ctx) => {
      const session = await ctx.db.query("operatorSessions").first();
      await ctx.db.patch(session!._id, { expiresAt: Date.now() - 1 });
    });
    await expect(
      t.mutation(api.cases.attemptClose, { caseId, actor: "board", token })
    ).rejects.toThrow(/expired/);
    expect((await t.query(api.auth.current, { token })).signedIn).toBe(false);
  });

  it("stops working the moment it is signed out", async () => {
    const t = convexTest(schema, modules);
    const token = await operatorToken(t);
    const caseId = await caseOpen(t);
    expect((await t.mutation(api.auth.signOut, { token })).signedOut).toBe(true);
    await expect(
      t.mutation(api.cases.attemptClose, { caseId, actor: "board", token })
    ).rejects.toThrow(/never issued|not one this deployment issued/);
  });

  it("lists live sessions to an operator, and never lists an expired one", async () => {
    const t = convexTest(schema, modules);
    const token = await operatorToken(t);
    await t.run(async (ctx) => {
      await ctx.db.insert("operatorSessions", {
        tokenHash: "0".repeat(64),
        createdAt: Date.now() - 1000,
        expiresAt: Date.now() - 500, // already gone
      });
    });
    const rows = await t.query(api.auth.sessions, { token });
    expect(rows.length).toBe(1);
  });

  it("ends another session on request", async () => {
    const t = convexTest(schema, modules);
    const token = await operatorToken(t);
    const other = await t.mutation(api.auth.signIn, { passphrase: TEST_PASSPHRASE });
    // Sessions are listed newest first, so the top row is the one just issued.
    const rows = await t.query(api.auth.sessions, { token });
    expect(rows.length).toBe(2);
    await t.mutation(api.auth.endSession, { token, sessionId: rows[0]._id });

    expect((await t.query(api.auth.current, { token: other.token })).signedIn).toBe(false);
    expect((await t.query(api.auth.sessions, { token })).length).toBe(1);
    // and the operator's own session still works
    expect((await t.query(api.auth.current, { token })).signedIn).toBe(true);
  });
});

describe("session tokens and lifetimes", () => {
  it("are long enough to be unguessable and different every time", () => {
    const a = randomToken();
    const b = randomToken();
    expect(a).not.toBe(b);
    expect(a.length).toBe(64);
  });

  it("expire at the boundary, not a millisecond later", () => {
    const now = Date.now();
    expect(expired({ expiresAt: now }, now)).toBe(true);
    expect(expired({ expiresAt: now + 1 }, now)).toBe(false);
  });

  it("last a working day", () => {
    expect(SESSION_TTL_MS).toBe(12 * 60 * 60 * 1000);
  });
});

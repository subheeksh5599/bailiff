import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";
import { operatorToken } from "./helpers";

const modules = import.meta.glob(["../convex/**/*.ts", "../convex/**/*.js"]);

/**
 * The board is what a person actually looks at, and the JSON routes are what a
 * skeptic checks it against. If the two could disagree, the board would be a
 * different product from the one the routes describe - so the ordering, the limit
 * and the fields are pinned here.
 *
 * The second half covers what happens when an operator tries to file a read the
 * product cannot honestly take: an address that is not a web address, a case that
 * does not exist, and a case that has already settled. Each refuses by name.
 */
describe("the board reads the rows the JSON does", () => {
  async function seeded() {
    const t = convexTest(schema, modules);
    for (const [i, ref] of ["case-old", "case-mid", "case-new"].entries()) {
      const { caseId } = await t.mutation(api.cases.openCase, {
        ref,
        customerRef: `cust-${i}`,
        counterpartyName: `Company ${i}`,
        channel: "phone",
      });
      await t.mutation(api.cases.freezeRequirements, {
        caseId,
        actor: "intake",
        requirements: [{ key: "refund_moved", label: "their record shows it moved", kind: "email_reply" }],
      });
    }
    return t;
  }

  it("returns nothing rather than throwing on an empty deployment", async () => {
    const t = convexTest(schema, modules);
    expect(await t.query(api.cases.board, {})).toEqual([]);
  });

  it("is newest first", async () => {
    const t = await seeded();
    const rows = await t.query(api.cases.board, {});
    const opened = rows.map((r) => r.openedAt);
    expect(opened).toEqual([...opened].sort((a, b) => b - a));
  });

  it("honours the limit it is given", async () => {
    const t = await seeded();
    expect((await t.query(api.cases.board, { limit: 2 })).length).toBe(2);
  });

  it("carries the same fields the case itself has, so a row cannot drift from it", async () => {
    const t = await seeded();
    const rows = await t.query(api.cases.board, {});
    const row = rows.find((r) => r.ref === "case-new")!;
    const snapshot = await t.query(api.cases.get, { ref: "case-new" });
    expect(row.counterparty).toBe(snapshot!.case.counterpartyName);
    expect(row.amountClaimedUnits).toBe(snapshot!.case.amountClaimedUnits);
    expect(row.state).toBe(snapshot!.case.state);
    expect(row.currency).toBe(snapshot!.case.currency);
  });
});

describe("reading a page as evidence refuses what it cannot honestly take", () => {
  it("refuses a case that does not exist", async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.action(api.board.readSource, { token: await operatorToken(t), caseRef: "case-nope", url: "https://example.com" })
    ).rejects.toThrow(/no case/);
  });

  it("refuses an address that is not a web address", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(api.cases.openCase, {
      ref: "case-url",
      customerRef: "cust-url",
      counterpartyName: "Example Corp",
      channel: "phone",
    });
    await expect(
      t.action(api.board.readSource, { token: await operatorToken(t), caseRef: "case-url", url: "not-a-url" })
    ).rejects.toThrow(/http/i);
  });

  it("refuses to feed a case that has already settled", async () => {
    const t = convexTest(schema, modules);
    const { caseId } = await t.mutation(api.cases.openCase, {
      ref: "case-settled",
      customerRef: "cust-settled",
      counterpartyName: "Example Corp",
      channel: "phone",
    });
    // Settle it directly: what matters here is the refusal, not the route to a close.
    await t.run(async (ctx) => {
      await ctx.db.patch(caseId, { state: "VERIFIED", verifiedAt: Date.now() });
    });
    await expect(
      t.action(api.board.readSource, { token: await operatorToken(t), caseRef: "case-settled", url: "https://example.com" })
    ).rejects.toThrow(/settled/i);
  });
});

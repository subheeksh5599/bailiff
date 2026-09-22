import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api, internal } from "../convex/_generated/api";
import { operatorToken } from "./helpers";

const modules = import.meta.glob(["../convex/**/*.ts", "../convex/**/*.js"]);

describe("the re-check takes a closure back when the evidence stops being current", () => {
  it("moves a verified case to dispute and says which requirement aged out", async () => {
    const t = convexTest(schema, modules);
    const { caseId } = await t.mutation(api.cases.openCase, {
      ref: "case-recheck",
      customerRef: "cust-2",
      counterpartyName: "Example Corp",
      channel: "email",
    });
    await t.mutation(api.cases.freezeRequirements, {
      caseId,
      actor: "intake",
      requirements: [{ key: "refund_issued", label: "Refund issued", kind: "payment_record" }],
    });
    await t.mutation(internal.ingest.evidenceFromFetch, {
      caseId,
      kind: "payment_record",
      sourceKind: "counterparty",
      source: "https://example.com/orders/9",
      excerpt: "refund issued",
      ingestedBy: "fetcher",
    });
    const closed = await t.mutation(api.cases.attemptClose, { token: await operatorToken(t), caseId, actor: "chase" });
    expect(closed.closed).toBe(true);

    const result = await t.mutation(internal.recheck.verified, { maxAgeDays: 0 });
    expect(result.examined).toBe(1);
    expect(result.revertedCount).toBe(1);
    expect(result.reverted).toHaveLength(1);
    expect(result.reverted[0].ref).toBe("case-recheck");

    const board = await t.query(api.cases.board, {});
    expect(board[0].state).toBe("DISPUTED");
    expect(board[0].verifiedAt).toBeUndefined();

    const audit = await t.run(async (ctx) => ctx.db.query("audit").collect());
    const withdrawal = audit.find((a) => a.action === "close.withdrawn");
    expect(withdrawal?.from).toBe("VERIFIED");
    expect(withdrawal?.to).toBe("DISPUTED");
    expect(withdrawal?.detail).toMatch(/no longer current/);
  });
});

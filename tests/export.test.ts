import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api, internal } from "../convex/_generated/api";
import { operatorToken } from "./helpers";

const modules = import.meta.glob(["../convex/**/*.ts", "../convex/**/*.js"]);

/**
 * The export is what a judge or an auditor reads when they do not want to trust a
 * screen: the whole case as one document. These tests keep it complete and ordered.
 */
describe("the case export", () => {
  it("returns nothing for a case that does not exist, rather than an empty shell", async () => {
    const t = convexTest(schema, modules);
    expect(await t.query(api.ops.caseExport, { caseRef: "nope" })).toBeNull();
  });

  it("carries every part of the argument once the case has been worked", async () => {
    const t = convexTest(schema, modules);
    const { caseId } = await t.mutation(api.cases.openCase, {
      ref: "case-export",
      customerRef: "cust-9",
      counterpartyName: "Example Corp",
      counterpartyDomain: "example.com",
      channel: "phone",
      currency: "USD",
      amountClaimedUnits: 4120,
    });
    await t.mutation(api.cases.freezeRequirements, {
      caseId,
      actor: "intake",
      requirements: [
        { key: "order_ref", label: "Order reference", kind: "email_reply" },
        { key: "refund_issued", label: "Refund issued", kind: "payment_record" },
      ],
    });
    await t.mutation(internal.ingest.evidenceFromFetch, {
      caseId,
      kind: "email_reply",
      sourceKind: "counterparty",
      source: "support reply",
      excerpt: "order 12345 shipped",
      ingestedBy: "fetcher",
    });
    await t.mutation(internal.ingest.recordClaim, {
      caseId,
      text: "refund was issued on the 20th",
      kind: "fact",
      actor: "extraction",
    });

    const exported = await t.query(api.ops.caseExport, { caseRef: "case-export" });
    expect(exported).not.toBeNull();
    if (!exported) return;

    expect(exported.case.ref).toBe("case-export");
    expect(exported.requirements).toHaveLength(2);
    expect(exported.requirements.find((r) => r.key === "order_ref")?.satisfied).toBe(true);
    expect(exported.requirements.find((r) => r.key === "refund_issued")?.satisfied).toBe(false);
    expect(exported.evidence).toHaveLength(1);
    expect(exported.evidence[0].contentHash).toMatch(/^[0-9a-f]{64}$/);
    expect(exported.claims).toHaveLength(1);
    expect(exported.claims[0].verdict).toBe("unverifiable");
    expect(exported.billing).toHaveLength(0);
    expect(exported.audit.length).toBeGreaterThanOrEqual(3);
    expect(typeof exported.exportedAt).toBe("number");
  });

  it("keeps the diary in the order things happened", async () => {
    const t = convexTest(schema, modules);
    const { caseId } = await t.mutation(api.cases.openCase, {
      ref: "case-diary",
      customerRef: "cust-1",
      counterpartyName: "Example Corp",
      channel: "email",
    });
    await t.mutation(api.cases.freezeRequirements, {
      caseId,
      actor: "intake",
      requirements: [{ key: "refund_issued", label: "Refund issued", kind: "payment_record" }],
    });
    await t.mutation(api.cases.attemptClose, { token: await operatorToken(t), caseId, actor: "chase" });

    const diary = await t.query(api.ops.auditForCase, { caseRef: "case-diary" });
    const actions = diary.map((row) => row.action);
    expect(actions[0]).toBe("case.opened");
    expect(actions).toContain("requirements.frozen");
    expect(actions[actions.length - 1]).toBe("close.refused");
    for (let i = 1; i < diary.length; i += 1) {
      expect(diary[i].at).toBeGreaterThanOrEqual(diary[i - 1].at);
    }
  });

  it("reports integration state as booleans and never as values", async () => {
    const t = convexTest(schema, modules);
    const health = await t.query(api.ops.integrationHealth, {});
    for (const [name, value] of Object.entries(health)) {
      expect(typeof value, `${name} must be a boolean`).toBe("boolean");
    }
    expect(JSON.stringify(health)).not.toMatch(/sk-|key|secret|token/i);
  });
});

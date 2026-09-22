import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api, internal } from "../convex/_generated/api";
import { operatorToken } from "./helpers";

const modules = import.meta.glob(["../convex/**/*.ts", "../convex/**/*.js"]);

function harness() {
  return convexTest(schema, modules);
}

async function openCase(t: ReturnType<typeof harness>, ref = "case-1") {
  const { caseId } = await t.mutation(api.cases.openCase, {
    ref,
    customerRef: "cust-1",
    counterpartyName: "Example Corp",
    counterpartyDomain: "example.com",
    channel: "phone",
    currency: "USD",
    amountClaimedUnits: 4120,
  });
  return caseId;
}

const RULES = [
  { key: "order_ref", label: "Order reference", kind: "email_reply" },
  { key: "refund_issued", label: "Refund issued", kind: "payment_record" },
];

describe("a case opens, freezes its requirements, and closes only on a read-back", () => {
  it("refuses to close while a requirement is unsatisfied, and names it", async () => {
    const t = harness();
    const caseId = await openCase(t);
    await t.mutation(api.cases.freezeRequirements, { caseId, requirements: RULES, actor: "intake" });
    await t.mutation(internal.ingest.evidenceFromFetch, {
      caseId,
      kind: "email_reply",
      sourceKind: "counterparty",
      source: "support reply",
      excerpt: "your order 12345 shipped",
      ingestedBy: "mailbox",
    });

    const result = await t.mutation(api.cases.attemptClose, { token: await operatorToken(t), caseId, actor: "chase" });
    expect(result.closed).toBe(false);
    expect(result.unsatisfied.map((u) => u.key)).toEqual(["refund_issued"]);

    const board = await t.query(api.cases.board, {});
    expect(board[0].state).not.toBe("VERIFIED");
  });

  it("closes once the counterparty's own record shows the money moved", async () => {
    const t = harness();
    const caseId = await openCase(t);
    await t.mutation(api.cases.freezeRequirements, { caseId, requirements: RULES, actor: "intake" });
    for (const [kind, source, excerpt] of [
      ["email_reply", "support reply", "order 12345 shipped"],
      ["payment_record", "https://example.com/orders/12345", "refund 41.20 issued"],
    ] as const) {
      await t.mutation(internal.ingest.evidenceFromFetch, {
        caseId,
        kind,
        sourceKind: "counterparty",
        source,
        excerpt,
        ingestedBy: "fetcher",
      });
    }

    const first = await t.mutation(api.cases.attemptClose, { token: await operatorToken(t), caseId, actor: "chase" });
    expect(first.closed).toBe(true);

    const state = await t.query(api.cases.board, {});
    expect(state[0].state).toBe("VERIFIED");

    const second = await t.mutation(api.cases.attemptClose, { token: await operatorToken(t), caseId, actor: "chase" });
    expect(second.closed).toBe(true);
    if (second.closed) expect(second.alreadyVerified).toBe(true);

    // The record has to agree with itself. A case reading verified while the requirement
    // it closed on still reads unsatisfied is two answers to the same question, and the
    // board reads that flag - so the pointer is written with the move, not later.
    const record = await t.query(api.cases.get, { ref: "case-1" });
    const requirements = record?.requirements ?? [];
    expect(requirements).toHaveLength(2);
    for (const requirement of requirements) {
      expect(requirement.satisfied).toBe(true);
      expect(requirement.satisfiedByEvidenceId).toBeTruthy();
    }
  });

  it("returns the grade recorded against the case's call, not only case-level ones", async () => {
    // A grade is recorded against the call it judged. The case view asked for
    // case-level grades alone and came back empty, which made a graded case read
    // as ungraded - the grade existed, the question was wrong.
    const t = harness();
    const caseId = await openCase(t, "case-graded");
    const now = Date.now();
    await t.mutation(internal.ingest.ingestCall, {
      caseRef: "case-graded",
      callRef: "call-graded",
      startedAt: now,
      endedAt: now + 90_000,
      endedReason: "assistant-ended-call",
      transcript: "agent: we will refund the 41.20 by Friday.",
    });
    await t.mutation(internal.grades.recordGrade, {
      subjectKind: "call",
      subjectRef: "call-graded",
      rubricRef: "call/v1",
      checks: [{ name: "promises_on_record", passed: true, detail: "1 promise, backed" }],
      gradedBy: "test",
    });

    const back = await t.query(api.cases.get, { ref: "case-graded" });
    expect(back?.grades.map((g) => g.subjectRef)).toContain("call-graded");
    expect(back?.grades[0]?.checks[0]?.name).toBe("promises_on_record");
    expect(back?.calls.map((c) => c.callRef)).toContain("call-graded");
  });

  it("refuses to close on evidence that was read before the case existed", async () => {
    const t = harness();
    const caseId = await openCase(t);
    await t.mutation(api.cases.freezeRequirements, { caseId, requirements: RULES, actor: "intake" });
    const long_ago = Date.now() - 7 * 24 * 60 * 60 * 1000;
    for (const kind of ["email_reply", "payment_record"]) {
      await t.mutation(internal.ingest.evidenceFromFetch, {
        caseId,
        kind,
        sourceKind: "counterparty",
        source: "old export",
        excerpt: "from a previous complaint",
        ingestedBy: "import",
        fetchedAt: long_ago,
      });
    }
    const result = await t.mutation(api.cases.attemptClose, { token: await operatorToken(t), caseId, actor: "chase" });
    expect(result.closed).toBe(false);
    expect(result.unsatisfied[0].reason).toMatch(/read before the case opened/);
  });

  it("keeps intake idempotent by case ref", async () => {
    const t = harness();
    const a = await t.mutation(api.cases.openCase, {
      ref: "dup-1",
      customerRef: "cust-1",
      counterpartyName: "Example Corp",
      channel: "email",
    });
    const b = await t.mutation(api.cases.openCase, {
      ref: "dup-1",
      customerRef: "cust-1",
      counterpartyName: "Example Corp",
      channel: "phone",
    });
    expect(a.duplicate).toBe(false);
    expect(b.duplicate).toBe(true);
    expect(b.caseId).toEqual(a.caseId);
  });

  it("will not let the requirement set be rewritten after it is frozen", async () => {
    const t = harness();
    const caseId = await openCase(t);
    await t.mutation(api.cases.freezeRequirements, { caseId, requirements: RULES, actor: "intake" });
    await expect(
      t.mutation(api.cases.freezeRequirements, {
        caseId,
        requirements: [{ key: "extra", label: "Extra hoop", kind: "page_fetch" }],
        actor: "chase",
      })
    ).rejects.toThrow(/frozen/);
  });

  it("records a claim with no evidence as unverifiable rather than fine", async () => {
    const t = harness();
    const caseId = await openCase(t);
    const claim = await t.mutation(internal.ingest.recordClaim, {
      caseId,
      text: "the agent told the customer Monday",
      kind: "promise",
      actor: "transcript",
    });
    expect(claim.verdict).toBe("unverifiable");
  });
});

describe("the audit trail explains every refusal", () => {
  it("keeps a refused close and a refused charge on the record", async () => {
    const t = harness();
    const caseId = await openCase(t);
    await t.mutation(api.cases.freezeRequirements, { caseId, requirements: RULES, actor: "intake" });
    await t.mutation(api.cases.attemptClose, { token: await operatorToken(t), caseId, actor: "chase" });
    await t.mutation(api.billing.recordUsage, {
      idempotencyKey: "call-6",
      caseId,
      units: 1,
      reason: "resolved call",
    });
    const rows = await t.run(async (ctx) => ctx.db.query("audit").collect());
    const actions = rows.map((r) => r.action);
    expect(actions).toContain("close.refused");
    expect(actions).toContain("billing.refused");
  });
});

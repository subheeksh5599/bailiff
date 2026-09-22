import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api, internal } from "../convex/_generated/api";

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

describe("billing: money moves only behind a passing grade, once", () => {
  const checks = (over: Array<{ name: string; passed: boolean; detail: string }> = []) =>
    [
      { name: "grounded", passed: true, detail: "every number has a fetch" },
      { name: "no_false_promise", passed: true, detail: "nothing promised beyond the record" },
    ].concat(over);

  it("refuses to bill with no grade at all, and writes nothing", async () => {
    const t = harness();
    const caseId = await openCase(t);
    const result = await t.mutation(api.billing.recordUsage, {
      idempotencyKey: "call-1",
      caseId,
      units: 1,
      reason: "resolved call",
    });
    expect(result.billed).toBe(false);
    expect(await t.query(api.billing.forCase, { caseId })).toHaveLength(0);
  });

  it("refuses to bill a call whose grade failed", async () => {
    const t = harness();
    const caseId = await openCase(t);
    const grade = await t.mutation(internal.grades.recordGrade, {
      subjectKind: "call",
      subjectRef: "call-2",
      rubricRef: "resolution-v1",
      checks: checks([{ name: "no_false_promise", passed: false, detail: "promised Saturday" }]),
      gradedBy: "evaluator",
    });
    expect(grade.verdict).toBe("fail");

    const result = await t.mutation(api.billing.recordUsage, {
      idempotencyKey: "call-2",
      caseId,
      gradeId: grade.gradeId,
      units: 1,
      reason: "resolved call",
    });
    expect(result.billed).toBe(false);
    if (!result.billed) expect(result.refusal).toMatch(/failed/);
    expect(await t.query(api.billing.forCase, { caseId })).toHaveLength(0);
  });

  it("refuses to bill an unverified grade, because unverified is not a pass", async () => {
    const t = harness();
    const caseId = await openCase(t);
    const grade = await t.mutation(internal.grades.recordGrade, {
      subjectKind: "call",
      subjectRef: "call-3",
      rubricRef: "resolution-v1",
      checks: checks([{ name: "unverified", passed: false, detail: "transcript truncated" }]),
      gradedBy: "evaluator",
    });
    expect(grade.verdict).toBe("unverified");
    const result = await t.mutation(api.billing.recordUsage, {
      idempotencyKey: "call-3",
      caseId,
      gradeId: grade.gradeId,
      units: 1,
      reason: "resolved call",
    });
    expect(result.billed).toBe(false);
  });

  it("bills once behind a passing grade, and a replayed webhook does not bill again", async () => {
    const t = harness();
    const caseId = await openCase(t);
    const grade = await t.mutation(internal.grades.recordGrade, {
      subjectKind: "call",
      subjectRef: "call-4",
      rubricRef: "resolution-v1",
      checks: checks(),
      gradedBy: "evaluator",
    });
    expect(grade.verdict).toBe("pass");

    const args = { idempotencyKey: "call-4", caseId, gradeId: grade.gradeId, units: 1, reason: "resolved call" };
    const first = await t.mutation(api.billing.recordUsage, args);
    const replay = await t.mutation(api.billing.recordUsage, args);
    expect(first.billed).toBe(true);
    if (replay.billed === false) expect(replay.replay).toBe(true);

    const rows = await t.query(api.billing.forCase, { caseId });
    expect(rows).toHaveLength(1);
    expect(rows[0].units).toBe(1);
  });

  it("a failed meter call stays pending and is retried, never duplicated", async () => {
    const t = harness();
    const caseId = await openCase(t);
    const grade = await t.mutation(internal.grades.recordGrade, {
      subjectKind: "call",
      subjectRef: "call-5",
      rubricRef: "resolution-v1",
      checks: checks(),
      gradedBy: "evaluator",
    });
    const billed = await t.mutation(api.billing.recordUsage, {
      idempotencyKey: "call-5",
      caseId,
      gradeId: grade.gradeId,
      units: 1,
      reason: "resolved call",
    });
    if (!billed.billed) throw new Error("expected a billing row");
    const failed = await t.mutation(api.billing.markFailed, {
      billingEventId: billed.billingEventId,
      error: "meter unavailable",
    });
    expect(failed.retryable).toBe(true);
    expect(failed.attempts).toBe(1);

    const pending = await t.query(api.billing.pending, {});
    expect(pending).toHaveLength(1);
    expect(pending[0].state).toBe("pending");

    await t.mutation(api.billing.markMetered, {
      billingEventId: billed.billingEventId,
      meterEventId: "evt-1",
    });
    const after = await t.query(api.billing.forCase, { caseId });
    expect(after).toHaveLength(1);
    expect(after[0].state).toBe("metered");
    // Two deliveries were attempted: the one that failed and the retry that landed.
    expect(after[0].attempts).toBe(2);
  });
});

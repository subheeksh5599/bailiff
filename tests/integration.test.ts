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

    const result = await t.mutation(api.cases.attemptClose, { caseId, actor: "chase" });
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

    const first = await t.mutation(api.cases.attemptClose, { caseId, actor: "chase" });
    expect(first.closed).toBe(true);

    const state = await t.query(api.cases.board, {});
    expect(state[0].state).toBe("VERIFIED");

    const second = await t.mutation(api.cases.attemptClose, { caseId, actor: "chase" });
    expect(second.closed).toBe(true);
    if (second.closed) expect(second.alreadyVerified).toBe(true);
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
    const result = await t.mutation(api.cases.attemptClose, { caseId, actor: "chase" });
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

describe("the audit trail explains every refusal", () => {
  it("keeps a refused close and a refused charge on the record", async () => {
    const t = harness();
    const caseId = await openCase(t);
    await t.mutation(api.cases.freezeRequirements, { caseId, requirements: RULES, actor: "intake" });
    await t.mutation(api.cases.attemptClose, { caseId, actor: "chase" });
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

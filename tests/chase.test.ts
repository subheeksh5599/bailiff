import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api, internal } from "../convex/_generated/api";
import { CHASE_INTERVAL_MS, MAX_CHASES, chaseDue, chaseNumber } from "../convex/lib/cadence";

const modules = import.meta.glob(["../convex/**/*.ts", "../convex/**/*.js"]);

function harness() {
  return convexTest(schema, modules);
}

const DAY = 24 * 60 * 60 * 1000;

async function frozenCase(t: ReturnType<typeof harness>, ref = "case-chase") {
  const { caseId } = await t.mutation(api.cases.openCase, {
    ref,
    customerRef: "cust-1",
    counterpartyName: "Example Corp",
    counterpartyDomain: "example.com",
    counterpartyContact: "billing@example.com",
    channel: "phone",
    currency: "GBP",
    amountClaimedUnits: 4120,
  });
  await t.mutation(api.cases.freezeRequirements, {
    caseId,
    requirements: [{ key: "refund_moved", label: "their record shows the refund moved", kind: "email_reply" }],
    actor: "intake",
  });
  return caseId;
}

describe("the chase cadence", () => {
  it("waits the interval after the requirements were frozen", () => {
    const frozenAt = Date.now();
    const early = chaseDue({ frozenAt, chaseCount: 0, now: frozenAt + DAY });
    expect(early.due).toBe(false);
    expect(early.reason).toMatch(/next chase in about \d+h/);

    const due = chaseDue({ frozenAt, chaseCount: 0, now: frozenAt + CHASE_INTERVAL_MS });
    expect(due.due).toBe(true);
    expect(due.reason).toContain("frozen");
  });

  it("counts from the last chase, not from the freeze, once one has gone out", () => {
    const now = Date.now();
    const frozenAt = now - 10 * DAY;
    const chasedAt = now - DAY;

    // a day after the chase, with the interval at two days: not yet, and it says so
    const waiting = chaseDue({ frozenAt, chasedAt, chaseCount: 1, now });
    expect(waiting.due).toBe(false);
    expect(waiting.reason).toMatch(/next chase in about \d+h/);

    // and once the interval from the chase has passed, the reason names the chase
    const due = chaseDue({ frozenAt, chasedAt, chaseCount: 1, now: chasedAt + CHASE_INTERVAL_MS });
    expect(due.due).toBe(true);
    expect(due.reason).toContain("since the last chase");
  });

  it("gives up at the cap instead of chasing forever", () => {
    const decision = chaseDue({
      frozenAt: Date.now() - 30 * DAY,
      chaseCount: MAX_CHASES,
      now: Date.now(),
    });
    expect(decision.due).toBe(false);
    expect(decision.abandon).toBe(true);
    expect(decision.reason).toContain(`${MAX_CHASES} chases`);
  });

  it("numbers the attempt for a reader rather than for a log", () => {
    expect(chaseNumber(0)).toBe(`chase 1 of ${MAX_CHASES}`);
    expect(chaseNumber(MAX_CHASES - 1)).toBe(`chase ${MAX_CHASES} of ${MAX_CHASES}`);
  });
});

describe("sweeping for cases that are owed a chase", () => {
  it("leaves a fresh case alone, and finds it once its interval has passed", async () => {
    const t = harness();
    await frozenCase(t, "case-stale");
    await frozenCase(t, "case-fresh");
    const now = Date.now();

    // both were frozen a moment ago: nothing is owed yet
    const early = await t.mutation(internal.chase.sweep, { now: now + 1000 });
    expect(early.examined).toBe(2);
    expect(early.scheduled).toEqual([]);

    // and with the clock past the interval, both are owed one. The sweep schedules
    // them; it does not chase them itself, and it moves nothing.
    const due = await t.mutation(internal.chase.sweep, { now: now + CHASE_INTERVAL_MS + 1000 });
    expect(due.scheduled).toContain("case-stale");
    expect(due.scheduled).toContain("case-fresh");

    const untouched = await t.query(api.cases.get, { ref: "case-stale" });
    expect(untouched?.case.state).toBe("REQUIREMENTS_FROZEN");
  });

  it("will not move a case on the strength of a message nobody sent", async () => {
    // No mail path is configured in tests, and that is the point: without one the
    // case stays where it is and the reason is written down.
    const t = harness();
    const caseId = await frozenCase(t, "case-nomail");
    const now = Date.now() + CHASE_INTERVAL_MS + 1000;

    const result = await t.action(internal.chase.one, { caseId, now });
    expect(result.skipped).toBe("no mail path is configured");

    const after = await t.query(api.cases.get, { ref: "case-nomail" });
    expect(after?.case.state).toBe("REQUIREMENTS_FROZEN");

    const diary = await t.query(api.ops.auditForCase, { caseRef: "case-nomail" });
    expect(diary.some((row) => row.action === "chase.skipped")).toBe(true);
    expect(diary.find((row) => row.action === "chase.skipped")?.detail).toContain("AGENTMAIL_API_KEY");
  });

  it("abandons a case once the cadence has run out, naming what was never read back", async () => {
    const t = harness();
    const caseId = await frozenCase(t, "case-tired");
    const now = Date.now() + 30 * DAY;

    // three attempts recorded, then the sweep that finds the cadence exhausted
    for (let i = 0; i < MAX_CHASES; i += 1) {
      await t.mutation(internal.chase.markChased, { caseId, now: Date.now() + i, detail: "test" });
    }

    const result = await t.action(internal.chase.one, { caseId, now });
    expect(result.abandoned).toBe(true);
    const outstanding = result.outstanding as string[] | undefined;
    expect(outstanding?.[0]).toContain("refund_moved");

    const after = await t.query(api.cases.get, { ref: "case-tired" });
    expect(after?.case.state).toBe("ABANDONED");

    const diary = await t.query(api.ops.auditForCase, { caseRef: "case-tired" });
    const moved = diary.find((row) => row.action === "state" && row.to === "ABANDONED");
    expect(moved?.detail).toContain("3 chases went unanswered");
  });

  it("keeps the cadence's bookkeeping on the case", async () => {
    const t = harness();
    const caseId = await frozenCase(t, "case-counted");
    await t.mutation(internal.chase.markChased, { caseId, now: 123, detail: "first" });
    await t.mutation(internal.chase.markChased, { caseId, now: 456, detail: "second" });

    const after = await t.query(api.cases.get, { ref: "case-counted" });
    expect(after?.case.chaseCount).toBe(2);
    expect(after?.case.chasedAt).toBe(456);
  });

  it("does not chase a case that nothing is outstanding on", async () => {
    const t = harness();
    const caseId = await frozenCase(t, "case-clear");
    await t.mutation(internal.ingest.evidenceFromFetch, {
      caseId,
      kind: "email_reply",
      sourceKind: "counterparty",
      source: "their reply",
      excerpt: "the refund of 41.20 was issued today",
      ingestedBy: "test",
    });

    const result = await t.action(internal.chase.one, { caseId, now: Date.now() + 30 * DAY });
    expect(result.skipped).toBe("every requirement is satisfied");

    const after = await t.query(api.cases.get, { ref: "case-clear" });
    expect(after?.case.state).toBe("REQUIREMENTS_FROZEN");
  });
});

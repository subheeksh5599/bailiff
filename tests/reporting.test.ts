import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";
import { abandonmentNotice, callReport, chaseMessage, withReference } from "../convex/lib/messages";
import { median, summarise } from "../convex/lib/metrics";
import { RUBRIC, rubricSummary } from "../convex/lib/checks";

const modules = import.meta.glob(["../convex/**/*.ts", "../convex/**/*.js"]);

function harness() {
  return convexTest(schema, modules);
}

describe("what the product says", () => {
  it("always carries the case reference, because a reply without it is filed nowhere", () => {
    expect(withReference("anything", "case-1")).toBe("anything [case:case-1]");
    const report = callReport({
      caseRef: "case-1",
      verdict: "pass",
      checks: [{ name: "resolved", passed: true, detail: "the caller's problem was dealt with" }],
      billing: { released: true, note: "one row, keyed on call-1" },
    });
    expect(report.subject).toContain("[case:case-1]");
    expect(report.text).toContain("1 of 1 checks passed");
    expect(report.text).toContain("The charge was released");
  });

  it("does not claim a charge when the grade did not pass", () => {
    const report = callReport({
      caseRef: "case-2",
      verdict: "fail",
      checks: [{ name: "unverified", passed: false, detail: "1 statement has no record behind it" }],
      billing: { released: false, note: "the grade did not pass, so no row was written" },
    });
    expect(report.subject).toContain("not billable");
    expect(report.text).toContain("FAIL  unverified");
    expect(report.text).toContain("No charge was released");
  });

  it("names what is still outstanding when it chases, and what was never read back when it gives up", () => {
    const chase = chaseMessage({
      caseRef: "case-3",
      counterparty: "Example Corp",
      attempt: "chase 1 of 3",
      outstanding: [{ key: "refund_moved", label: "their record shows the refund moved", reason: "no evidence of this kind has been read back" }],
    });
    expect(chase.text).toContain("chase 1 of 3");
    expect(chase.text).toContain("refund_moved");
    expect(chase.subject).toContain("[case:case-3]");

    const notice = abandonmentNotice({
      caseRef: "case-3",
      counterparty: "Example Corp",
      attempts: 3,
      outstanding: [{ key: "refund_moved", label: "their record shows the refund moved" }],
    });
    expect(notice.text).toContain("abandoned after 3 chases");
    expect(notice.text).toContain("not closed");
  });
});

describe("what the numbers mean", () => {
  it("returns nothing rather than a zero when there is nothing to average", () => {
    expect(median([])).toBeNull();
    expect(summarise([]).medianHoursToClosure).toBeNull();
    expect(summarise([]).total).toBe(0);
  });

  it("takes the middle of an even and an odd set the same way", () => {
    expect(median([10, 20, 30])).toBe(20);
    expect(median([10, 20, 30, 40])).toBe(25);
  });

  it("counts what settled, what was given up on, and what is still being worked", () => {
    const day = 24 * 60 * 60 * 1000;
    const now = Date.now();
    const insights = summarise([
      { state: "VERIFIED", openedAt: now - 2 * day, verifiedAt: now - day, counterparty: "A" },
      { state: "VERIFIED", openedAt: now - 4 * day, verifiedAt: now - day, counterparty: "A" },
      { state: "CHASING", openedAt: now - day, chaseCount: 2, counterparty: "B" },
      { state: "ABANDONED", openedAt: now - 9 * day, chaseCount: 3, counterparty: "B" },
    ]);

    expect(insights.total).toBe(4);
    expect(insights.verified).toBe(2);
    expect(insights.abandoned).toBe(1);
    expect(insights.open).toBe(1);
    expect(insights.medianHoursToClosure).toBe(48); // 24h and 72h, so the middle is 48
    expect(insights.chases).toEqual({ cases: 2, total: 5 });
    expect(insights.counterparties[0]).toEqual({ name: "A", cases: 2 });
  });
});

describe("the checks a grade is made of", () => {
  it("passes only when every one is present", () => {
    expect(rubricSummary(RUBRIC).ok).toBe(true);
    const short = rubricSummary(["resolved"]);
    expect(short.ok).toBe(false);
    expect(short.detail).toContain("promises_on_record");
  });
});

describe("asking the deployment what it can do", () => {
  it("answers every check, and reports the ones it cannot run instead of passing them", async () => {
    const t = harness();
    await t.mutation(api.cases.openCase, {
      ref: "case-selftest",
      customerRef: "cust-1",
      counterpartyName: "Example Corp",
      channel: "phone",
    });

    const report = await t.action(api.selftest.run, {});
    const byName = Object.fromEntries(report.checks.map((check) => [check.name, check]));

    // storage is exercised rather than inspected: written, read back, removed
    expect(byName.storage?.ok).toBe(true);
    expect(byName.storage?.detail).toContain("read them back");
    expect(byName.casesReadable?.detail).toContain("1 case");
    expect(byName.rubricPresent?.ok).toBe(true);

    // no key configured in tests, so the mail path reports skipped rather than a pass
    expect(byName.mailPath?.skipped).toBe(true);
    expect(byName.mailPath?.ok).toBe(false);
    expect(report.ran).toBe(5);
    expect(report.skipped).toBeGreaterThan(0);
  });
});

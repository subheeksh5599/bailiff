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

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

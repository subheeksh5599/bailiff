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

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

describe("the checks a grade is made of", () => {
  it("passes only when every one is present", () => {
    expect(rubricSummary(RUBRIC).ok).toBe(true);
    const short = rubricSummary(["resolved"]);
    expect(short.ok).toBe(false);
    expect(short.detail).toContain("promises_on_record");
  });
});

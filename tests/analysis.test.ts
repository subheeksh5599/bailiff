import { describe, expect, it } from "vitest";
import { parseCallAnalysis } from "../convex/lib/analysis";

describe("reading the call platform's analysis of a call", () => {
  it("accepts a well-formed reading", () => {
    const parsed = parseCallAnalysis(
      JSON.stringify({
        caller_wanted: "the refund moved",
        resolved: false,
        promises: [{ text: "we will refund 41.20 by Friday", promised_when: "Friday" }],
        facts: [{ text: "the refund was issued on the 20th", subject: "refund" }],
      })
    );
    expect(parsed?.promises).toHaveLength(1);
    expect(parsed?.facts[0].text).toContain("20th");
    expect(parsed?.resolved).toBe(false);
  });

  it("throws away a reading it cannot parse, rather than half-using it", () => {
    expect(parseCallAnalysis("not json at all")).toBeNull();
    expect(parseCallAnalysis(undefined)).toBeNull();
    expect(parseCallAnalysis(null)).toBeNull();
  });

  it("treats a reading that yields nothing as no reading at all", () => {
    expect(parseCallAnalysis(JSON.stringify({ promises: [], facts: [] }))).toBeNull();
    expect(parseCallAnalysis(JSON.stringify({ caller_wanted: "   " }))).toBeNull();
  });

  it("keeps the parts it can read and skips the parts it cannot", () => {
    const parsed = parseCallAnalysis(
      JSON.stringify({
        caller_wanted: "a working line",
        promises: [{ text: "an engineer will call back", promised_when: null }, { text: "" }, 42, null],
        facts: [{ text: "the line was off for 3 days" }, { subject: "no text" }],
      })
    );
    expect(parsed?.promises).toHaveLength(1);
    expect(parsed?.facts).toHaveLength(1);
    expect(parsed?.facts[0].subject).toBe("unknown");
  });

  it("does not let a claim carry a verdict of its own", () => {
    // whatever the platform says about truth, the verdict is decided by our rules
    const parsed = parseCallAnalysis(
      JSON.stringify({
        caller_wanted: "closure",
        resolved: true,
        promises: [],
        facts: [{ text: "the refund moved", subject: "refund", verdict: "verified" }],
      })
    );
    expect(parsed?.facts[0]).not.toHaveProperty("verdict");
    expect(parsed?.resolved).toBe(true);
  });
});

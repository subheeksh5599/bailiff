import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { internal } from "../convex/_generated/api";
import { POLICIES, policyTable } from "../convex/lib/limits";
import rateLimiterTest from "@convex-dev/rate-limiter/test";

const modules = import.meta.glob(["../convex/**/*.ts", "../convex/**/*.js"]);

/**
 * The hooks are the only way evidence enters this product, and they are already
 * fail-closed without a shared secret. What they were not is bounded: a provider
 * retrying, or a loop in someone else's cron, could arrive as often as it liked.
 *
 * The ceilings are two, and they answer different questions. The global one bounds
 * what the deployment absorbs; the per-case one bounds what a single case can be
 * asked to absorb, so a flood aimed at one case cannot spend every other case's
 * allowance with it.
 */
describe("the ceilings on the public hooks", () => {
  it("covers every hook name the routes use, and nothing they do not", () => {
    expect(Object.keys(POLICIES).sort()).toEqual(["hookAll", "hookPerCase", "operatorAction"]);
  });

  it("describes each ceiling in a form a person can read", () => {
    const table = policyTable();
    expect(table.length).toBe(3);
    for (const row of table) {
      expect(row.per).toMatch(/^\d+ per minute$/);
      expect(row.burst).toBeGreaterThan(0);
    }
  });

  it("gives a case less headroom than the deployment, which is the point of having both", () => {
    expect(POLICIES.hookPerCase.rate).toBeLessThan(POLICIES.hookAll.rate);
    expect(POLICIES.hookPerCase.capacity).toBeLessThan(POLICIES.hookAll.capacity);
  });

  it("allows a genuine burst rather than only a steady drip", () => {
    for (const name of Object.keys(POLICIES) as Array<keyof typeof POLICIES>) {
      expect(POLICIES[name].kind).toBe("token bucket");
      expect(POLICIES[name].capacity).toBeGreaterThan(1);
    }
  });
});

describe("spending an allowance", () => {
  function harness() {
    const t = convexTest(schema, modules);
    rateLimiterTest.register(t); // the component, as the deployment mounts it
    return t;
  }

  it("answers with the limit it applied, in a shape a caller can read without a guard", async () => {
    const t = harness();
    const first = await t.mutation(internal.limits.consume, { name: "hookPerCase", key: "case-x" });
    expect(first.limit).toBe("hookPerCase");
    expect(first.ok).toBe(true);
    expect(first.retryAfter === null || typeof first.retryAfter === "number").toBe(true);
  });

  it("refuses once the burst is spent, and says how long to wait", async () => {
    const t = harness();
    let last = await t.mutation(internal.limits.consume, { name: "hookPerCase", key: "case-flood" });
    for (let i = 0; i < POLICIES.hookPerCase.capacity + 2; i += 1) {
      last = await t.mutation(internal.limits.consume, { name: "hookPerCase", key: "case-flood" });
    }
    expect(last.ok).toBe(false);
    expect(typeof last.retryAfter).toBe("number");
  });

  it("keeps one case's flood out of another case's allowance", async () => {
    const t = harness();
    for (let i = 0; i < POLICIES.hookPerCase.capacity + 2; i += 1) {
      await t.mutation(internal.limits.consume, { name: "hookPerCase", key: "case-loud" });
    }
    const quiet = await t.mutation(internal.limits.consume, { name: "hookPerCase", key: "case-quiet" });
    expect(quiet.ok).toBe(true);
  });

  it("refuses the deployment as a whole once its own ceiling is spent", async () => {
    const t = harness();
    let last = await t.mutation(internal.limits.consume, { name: "hookAll", key: "all" });
    for (let i = 0; i < POLICIES.hookAll.capacity + 2; i += 1) {
      last = await t.mutation(internal.limits.consume, { name: "hookAll", key: "all" });
    }
    expect(last.ok).toBe(false);
  });
});

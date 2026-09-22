import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api, internal } from "../convex/_generated/api";

const modules = import.meta.glob(["../convex/**/*.ts", "../convex/**/*.js"]);

describe("hooks are fail-closed", () => {
  it("reports which integrations are configured, and only as booleans", async () => {
    const t = convexTest(schema, modules);
    const res = await t.fetch("/health", { method: "GET" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; integrations: Record<string, boolean> };
    expect(body.ok).toBe(true);
    expect(body.integrations.convex).toBe(true);
    for (const [name, value] of Object.entries(body.integrations)) {
      expect(typeof value, `${name} must be a boolean`).toBe("boolean");
    }
  });

  it("refuses a call webhook outright when no secret is configured, instead of accepting it", async () => {
    const t = convexTest(schema, modules);
    const res = await t.fetch("/hooks/call-ended", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: { call: { id: "c1", metadata: { caseRef: "x" } } } }),
    });
    expect(res.status).toBe(503);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/refusing/);
  });

  it("refuses an inbound mail webhook with no secret configured", async () => {
    const t = convexTest(schema, modules);
    const res = await t.fetch("/hooks/inbound-email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ caseRef: "x", text: "hello" }),
    });
    expect(res.status).toBe(503);
  });
});

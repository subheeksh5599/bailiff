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

describe("ingesting a call without dressing it up", () => {
  async function seed(t: ReturnType<typeof convexTest>) {
    const { caseId } = await t.mutation(api.cases.openCase, {
      ref: "case-call-1",
      customerRef: "cust-1",
      counterpartyName: "Example Corp",
      channel: "phone",
    });
    return caseId;
  }

  it("refuses a call against a case that does not exist", async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.mutation(internal.ingest.ingestCall, {
        caseRef: "no-such-case",
        callRef: "call-x",
        startedAt: Date.now() - 60_000,
        endedAt: Date.now(),
        endedReason: "hangup",
        transcript: "hi",
      })
    ).rejects.toThrow(/cannot be filed against nothing/);
  });

  it("stores the transcript verbatim, hashed, and absorbs a replay by call reference", async () => {
    const t = convexTest(schema, modules);
    const caseId = await seed(t);
    const transcript = "customer: where is my refund? agent: it was issued on the 20th.";

    const first = await t.mutation(internal.ingest.ingestCall, {
      caseRef: "case-call-1",
      callRef: "call-1",
      startedAt: Date.now() - 120_000,
      endedAt: Date.now() - 60_000,
      endedReason: "customer-ended-call",
      transcript,
    });
    expect(first.duplicate).toBe(false);

    const replay = await t.mutation(internal.ingest.ingestCall, {
      caseRef: "case-call-1",
      callRef: "call-1",
      startedAt: Date.now() - 120_000,
      endedAt: Date.now() - 60_000,
      endedReason: "customer-ended-call",
      transcript,
    });
    expect(replay.duplicate).toBe(true);

    const evidence = await t.query(api.cases.evidenceFor, { caseId });
    const transcripts = evidence.filter((e) => e.kind === "call_transcript");
    expect(transcripts).toHaveLength(1);
    expect(transcripts[0].excerpt).toBe(transcript);
    expect(transcripts[0].sourceKind).toBe("own_record");
    expect(transcripts[0].contentHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("a transcript of us talking is our own record, so it cannot satisfy a requirement about them", async () => {
    const t = convexTest(schema, modules);
    const caseId = await seed(t);
    await t.mutation(api.cases.freezeRequirements, {
      caseId,
      actor: "intake",
      requirements: [{ key: "refund_issued", label: "Refund issued", kind: "payment_record" }],
    });
    await t.mutation(internal.ingest.ingestCall, {
      caseRef: "case-call-1",
      callRef: "call-2",
      startedAt: Date.now() - 60_000,
      endedAt: Date.now(),
      endedReason: "hangup",
      transcript: "agent: I promise the refund is already in your account",
    });
    const result = await t.mutation(api.cases.attemptClose, { caseId, actor: "chase" });
    expect(result.closed).toBe(false);
    expect(result.unsatisfied.map((u) => u.key)).toEqual(["refund_issued"]);
  });
});

describe("the re-check takes a closure back when the evidence stops being current", () => {
  it("moves a verified case to dispute and says which requirement aged out", async () => {
    const t = convexTest(schema, modules);
    const { caseId } = await t.mutation(api.cases.openCase, {
      ref: "case-recheck",
      customerRef: "cust-2",
      counterpartyName: "Example Corp",
      channel: "email",
    });
    await t.mutation(api.cases.freezeRequirements, {
      caseId,
      actor: "intake",
      requirements: [{ key: "refund_issued", label: "Refund issued", kind: "payment_record" }],
    });
    await t.mutation(internal.ingest.evidenceFromFetch, {
      caseId,
      kind: "payment_record",
      sourceKind: "counterparty",
      source: "https://example.com/orders/9",
      excerpt: "refund issued",
      ingestedBy: "fetcher",
    });
    const closed = await t.mutation(api.cases.attemptClose, { caseId, actor: "chase" });
    expect(closed.closed).toBe(true);

    const result = await t.mutation(internal.recheck.verified, { maxAgeDays: 0 });
    expect(result.examined).toBe(1);
    expect(result.revertedCount).toBe(1);
    expect(result.reverted).toHaveLength(1);
    expect(result.reverted[0].ref).toBe("case-recheck");

    const board = await t.query(api.cases.board, {});
    expect(board[0].state).toBe("DISPUTED");
    expect(board[0].verifiedAt).toBeUndefined();

    const audit = await t.run(async (ctx) => ctx.db.query("audit").collect());
    const withdrawal = audit.find((a) => a.action === "close.withdrawn");
    expect(withdrawal?.from).toBe("VERIFIED");
    expect(withdrawal?.to).toBe("DISPUTED");
    expect(withdrawal?.detail).toMatch(/no longer current/);
  });
});

import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api, internal } from "../convex/_generated/api";
import { operatorToken } from "./helpers";

const modules = import.meta.glob(["../convex/**/*.ts", "../convex/**/*.js"]);

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

  it("a retried inbound webhook is one reply, not two", async () => {
    const t = convexTest(schema, modules);
    await seed(t);
    const reply = {
      caseRef: "case-call-1",
      from: "billing@example.com",
      subject: "Re: refund",
      text: "The refund was issued on the 20th, reference RF-119.",
    };
    const first = await t.mutation(internal.ingest.ingestReply, reply);
    expect(first.duplicate).toBe(false);
    const replay = await t.mutation(internal.ingest.ingestReply, reply);
    expect(replay.duplicate).toBe(true);
    expect(replay.evidenceId).toBe(first.evidenceId);
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
    const result = await t.mutation(api.cases.attemptClose, { token: await operatorToken(t), caseId, actor: "chase" });
    expect(result.closed).toBe(false);
    expect(result.unsatisfied.map((u) => u.key)).toEqual(["refund_issued"]);
  });
});

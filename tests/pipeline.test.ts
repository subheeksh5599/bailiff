import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api, internal } from "../convex/_generated/api";

const modules = import.meta.glob(["../convex/**/*.ts", "../convex/**/*.js"]);

/**
 * The pipeline is a sequence of named stops, and this suite pins the two that
 * matter most for honesty: a run that cannot get claims must end as a structured
 * stop with a reason on the case, and it must not produce a grade or a charge.
 *
 * The assertion is deliberately tolerant about *why* it stopped: whether the
 * provider key is absent or the provider itself refuses (quota, outage, bad model
 * id), the caller gets a stop, never an exception and never a silent success.
 */
async function seededCall(t: ReturnType<typeof convexTest>) {
  const { caseId } = await t.mutation(api.cases.openCase, {
    ref: "case-pipeline",
    customerRef: "cust-1",
    counterpartyName: "Example Corp",
    channel: "phone",
  });
  await t.mutation(api.cases.freezeRequirements, {
    caseId,
    actor: "intake",
    requirements: [{ key: "refund_issued", label: "Refund issued", kind: "payment_record" }],
  });
  const ingest = await t.mutation(internal.ingest.ingestCall, {
    caseRef: "case-pipeline",
    callRef: "call-pipeline",
    startedAt: Date.now() - 90_000,
    endedAt: Date.now() - 30_000,
    endedReason: "customer-ended-call",
    transcript: "customer: where is my refund? agent: it was issued on the 20th, I promise.",
  });
  return { caseId, evidenceId: ingest.evidenceId };
}

describe("a run that cannot get claims stops and says why", () => {
  it("returns a structured stop rather than throwing", async () => {
    const t = convexTest(schema, modules);
    await seededCall(t);

    const result = await t.action(api.orchestrator.resolveCall, {
      caseRef: "case-pipeline",
      callRef: "call-pipeline",
    });

    expect(result.stopped).toBeTruthy();
    expect(typeof result.stopped).toBe("string");
    expect(result.grade).toBeUndefined();
    expect(result.billing).toBeUndefined();
  });

  it("writes the reason onto the case instead of losing it", async () => {
    const t = convexTest(schema, modules);
    await seededCall(t);
    await t.action(api.orchestrator.resolveCall, { caseRef: "case-pipeline", callRef: "call-pipeline" });

    const diary = await t.query(api.ops.auditForCase, { caseRef: "case-pipeline" });
    const stopping = diary.filter((row) => row.action === "pipeline.stopped" || row.action === "extraction.failed");
    expect(stopping.length).toBeGreaterThan(0);
    expect((stopping[0].detail ?? "").length).toBeGreaterThan(10);
  });

  it("leaves the call ungraded and unbilled, so nothing is claimed about it", async () => {
    const t = convexTest(schema, modules);
    const { caseId } = await seededCall(t);
    await t.action(api.orchestrator.resolveCall, { caseRef: "case-pipeline", callRef: "call-pipeline" });

    expect(await t.query(api.grades.forSubject, { subjectKind: "call", subjectRef: "call-pipeline" })).toHaveLength(0);
    expect(await t.query(api.billing.forCase, { caseId })).toHaveLength(0);
  });

  it("stops before touching anything when the call was never ingested", async () => {
    const t = convexTest(schema, modules);
    await seededCall(t);
    const result = await t.action(api.orchestrator.resolveCall, {
      caseRef: "case-pipeline",
      callRef: "call-that-never-happened",
    });
    expect(result.stopped).toMatch(/no call/);
  });

  it("refuses to run against a case that does not exist", async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.action(api.orchestrator.resolveCall, { caseRef: "ghost", callRef: "call-1" })
    ).rejects.toThrow(/no case/);
  });
});

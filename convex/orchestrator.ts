import { v } from "convex/values";
import { action, internalAction, type ActionCtx } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { gradeVerdict, type GradeCheck } from "./lib/rules";
import { has } from "./lib/config";

/**
 * The whole pipeline for one call, with every stop named.
 *
 * Everything that changes state lives here; the integration modules are adapters
 * that only talk to vendors. The run is written as a sequence of "is this switched
 * on?" checks rather than a chain that assumes everything is present: when a piece
 * is missing the run stops there, writes down which variable was missing and
 * returns it - so an unconfigured integration leaves a visible gap in the record
 * instead of a plausible-looking number.
 */
export type OrchestrationResult = {
  stopped: string | null;
  grade?: string;
  checks?: GradeCheck[];
  claimsRecorded?: number;
  independent?: { testCaseId: string | null; independentScore: number | null; note: string } | null;
  billing?: unknown;
  emailed?: boolean;
};

export const resolveCall = action({
  args: { caseRef: v.string(), callRef: v.string() },
  handler: async (ctx: ActionCtx, args): Promise<OrchestrationResult> => {
    return await ctx.runAction(internal.orchestrator.deriveOutcome, args);
  },
});

export const deriveOutcome = internalAction({
  args: { caseRef: v.string(), callRef: v.string() },
  handler: async (ctx: ActionCtx, args): Promise<OrchestrationResult> => {
    const snapshot = await ctx.runQuery(internal.ops.caseSnapshot, { caseRef: args.caseRef });
    if (!snapshot) throw new Error(`no case ${args.caseRef}`);

    const call = snapshot.calls.find((c) => c.callRef === args.callRef);
    if (!call) return { stopped: "no call with that reference has been ingested" };

    const transcript = snapshot.evidence.find(
      (e) => e.kind === "call_transcript" && e.source === `call:${args.callRef}`
    );
    if (!transcript) return { stopped: "the call exists but carries no transcript to read" };

    if (!has(process.env, "openai")) {
      await ctx.runMutation(internal.ops.audit, {
        caseId: snapshot.case._id,
        action: "pipeline.stopped",
        actor: "orchestrator",
        detail: "extraction is not configured: set OPENAI_API_KEY",
      });
      return { stopped: "extraction is not configured (OPENAI_API_KEY)" };
    }

    const extracted = await ctx.runAction(internal.integrations.openai.extractClaims, {
      transcript: transcript.excerpt,
    });

    // A promise is verified against our own recording: the transcript proves it was
    // said. A statement of fact cannot be - only the counterparty's record settles
    // whether it was true - so facts are recorded with no evidence link and are
    // therefore unverified until such a record exists.
    for (const promise of extracted.promises) {
      await ctx.runMutation(internal.ingest.recordClaim, {
        caseId: snapshot.case._id,
        text: promise.promised_when ? `${promise.text} (by ${promise.promised_when})` : promise.text,
        kind: "promise",
        evidenceId: transcript._id,
        actor: "extraction",
      });
    }
    for (const fact of extracted.facts) {
      await ctx.runMutation(internal.ingest.recordClaim, {
        caseId: snapshot.case._id,
        text: `${fact.text} [${fact.subject}]`,
        kind: "fact",
        actor: "extraction",
      });
    }

    const after = await ctx.runQuery(internal.ops.caseSnapshot, { caseRef: args.caseRef });
    const claims = after?.claims ?? [];
    const facts = claims.filter((c) => c.kind === "fact");
    const promises = claims.filter((c) => c.kind === "promise");
    const ungroundedFacts = facts.filter((c) => c.verdict !== "verified");
    const unbackedPromises = promises.filter((c) => c.verdict !== "verified");

    const checks: GradeCheck[] = [
      {
        name: "promises_on_record",
        passed: unbackedPromises.length === 0,
        detail:
          unbackedPromises.length === 0
            ? `${promises.length} promise(s), each backed by the transcript`
            : `${unbackedPromises.length} promise(s) could not be backed`,
      },
      {
        // Named "unverified" on purpose: a statement with no record behind it is
        // unknown, not false, and an unknown call bills nothing without being
        // called a failure.
        name: "unverified",
        passed: ungroundedFacts.length === 0,
        detail:
          ungroundedFacts.length === 0
            ? `${facts.length} statement(s) of fact, each backed by a record`
            : `${ungroundedFacts.length} statement(s) of fact have no record behind them`,
      },
      {
        name: "resolved",
        passed: Boolean(extracted.resolved),
        detail: extracted.resolved
          ? `caller wanted: ${extracted.caller_wanted}`
          : `not resolved: ${extracted.caller_wanted}`,
      },
    ];

    const grade = await ctx.runMutation(internal.grades.recordGrade, {
      subjectKind: "call",
      subjectRef: args.callRef,
      rubricRef: "resolution-v1",
      checks,
      gradedBy: "bailiff",
    });

    let independent: OrchestrationResult["independent"] = null;
    if (has(process.env, "scorecard")) {
      try {
        independent = await ctx.runAction(internal.integrations.scorecard.crossScore, {
          bundle: {
            caseRef: args.caseRef,
            callRef: args.callRef,
            transcriptExcerpt: transcript.excerpt,
            claims: claims.map((c) => ({ kind: c.kind, text: c.text, verdict: c.verdict })),
            evidence: snapshot.evidence.map((e) => ({
              kind: e.kind,
              sourceKind: e.sourceKind,
              source: e.source,
              excerpt: e.excerpt.slice(0, 600),
            })),
          },
        });
      } catch (error) {
        await ctx.runMutation(internal.ops.audit, {
          caseId: snapshot.case._id,
          action: "grade.independent_failed",
          actor: "orchestrator",
          detail: error instanceof Error ? error.message : "unknown failure",
        });
      }
    }

    const verdict = gradeVerdict(checks);
    let billing: unknown = null;
    if (verdict === "pass") {
      if (!has(process.env, "autumn")) {
        await ctx.runMutation(internal.ops.audit, {
          caseId: snapshot.case._id,
          action: "pipeline.stopped",
          actor: "orchestrator",
          detail: "the call passed and is billable, but metering is not configured: set AUTUMN_SECRET_KEY",
        });
      } else {
        const gate = await ctx.runMutation(api.billing.recordUsage, {
          idempotencyKey: `call:${args.callRef}`,
          caseId: snapshot.case._id,
          gradeId: grade.gradeId,
          units: 1,
          reason: "a resolved call, graded from the transcript",
        });
        if ("billed" in gate && gate.billed) {
          const usage = await ctx.runAction(internal.integrations.autumn.trackUsage, {
            customerId: snapshot.case.customerRef,
            featureId: process.env.AUTUMN_FEATURE_ID ?? "verified_resolution",
            units: 1,
            idempotencyKey: `call:${args.callRef}`,
          });
          if (usage.sent) {
            await ctx.runMutation(api.billing.markMetered, {
              billingEventId: gate.billingEventId,
              meterEventId: usage.meterEventId ?? `call:${args.callRef}`,
            });
          } else {
            await ctx.runMutation(api.billing.markFailed, {
              billingEventId: gate.billingEventId,
              error: usage.error,
            });
          }
          billing = usage;
        } else {
          billing = gate;
        }
      }
    }

    let emailed = false;
    if (has(process.env, "resend")) {
      const owner = process.env.OWNER_EMAIL;
      if (!owner) {
        await ctx.runMutation(internal.ops.audit, {
          caseId: snapshot.case._id,
          action: "pipeline.stopped",
          actor: "orchestrator",
          detail: "email is configured but OWNER_EMAIL is not set, so no report was sent",
        });
      } else {
        const report = [
          `Case: ${args.caseRef}`,
          `Call: ${args.callRef}`,
          `Grade: ${verdict}`,
          `Caller wanted: ${extracted.caller_wanted}`,
          "",
          "Checks:",
          ...checks.map((c) => `- ${c.name}: ${c.passed ? "pass" : "fail"} - ${c.detail}`),
          "",
          verdict === "pass" ? "Billable, once." : "Not billable.",
        ].join("\n");
        const sent = await ctx.runAction(internal.integrations.resend.sendEmail, {
          to: owner,
          purpose: `call report for ${args.caseRef}`,
          subject: verdict === "pass" ? `Resolved call, billable: ${args.caseRef}` : `Call not billable (${verdict}): ${args.caseRef}`,
          text: report,
        });
        emailed = sent.sent;
      }
    }

    return {
      stopped: null,
      grade: verdict,
      checks,
      claimsRecorded: extracted.promises.length + extracted.facts.length,
      independent,
      billing,
      emailed,
    };
  },
});

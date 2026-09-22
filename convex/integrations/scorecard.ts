import { v } from "convex/values";
import { internalAction, type ActionCtx } from "../_generated/server";
import { ENDPOINTS } from "./endpoints";
import { postJson } from "./http";
import { sha256Hex } from "../lib/hash";
import { NotConfigured, has, requireKey } from "../lib/config";

/**
 * Adapter: hand the graded run to an independent evaluator.
 *
 * The delivered artifact is an OTLP trace, which is the mechanism this platform
 * documents for getting runs into it: one span per graded call, carrying the case,
 * the call, what was claimed, and how much of it the evidence actually supported.
 * What comes back is an acknowledgement, not a score - so no score is claimed, and
 * the second opinion remains the evaluator's to compute. Our own grade, printed
 * check by check on the case, is still the only thing that can release a charge.
 */
export type GradingBundle = {
  caseRef: string;
  callRef: string;
  transcriptExcerpt: string;
  claims: Array<{ kind: string; text: string; verdict: string }>;
  evidence: Array<{ kind: string; sourceKind: string; source: string; excerpt: string }>;
};

export function buildOtlpTrace(
  bundle: GradingBundle,
  ids: { traceId: string; spanId: string; now: number }
) {
  const unverified = bundle.claims.filter((c) => c.verdict !== "verified").length;
  return {
    resourceSpans: [
      {
        resource: {
          attributes: [{ key: "service.name", value: { stringValue: "bailiff" } }],
        },
        scopeSpans: [
          {
            scope: { name: "bailiff.grade" },
            spans: [
              {
                traceId: ids.traceId,
                spanId: ids.spanId,
                name: "call.graded",
                kind: 1,
                startTimeUnixNano: `${ids.now}000000`,
                endTimeUnixNano: `${ids.now + 1000}000000`,
                attributes: [
                  { key: "case.ref", value: { stringValue: bundle.caseRef } },
                  { key: "call.ref", value: { stringValue: bundle.callRef } },
                  { key: "claims.count", value: { intValue: String(bundle.claims.length) } },
                  { key: "claims.unverified", value: { intValue: String(unverified) } },
                  { key: "evidence.count", value: { intValue: String(bundle.evidence.length) } },
                  { key: "transcript.excerpt", value: { stringValue: bundle.transcriptExcerpt.slice(0, 400) } },
                ],
                status: { code: 1 },
              },
            ],
          },
        ],
      },
    ],
  };
}

export type TraceDelivery = { delivered: boolean; note: string };

const bundleInput = v.object({
  caseRef: v.string(),
  callRef: v.string(),
  transcriptExcerpt: v.string(),
  claims: v.array(v.object({ kind: v.string(), text: v.string(), verdict: v.string() })),
  evidence: v.array(
    v.object({ kind: v.string(), sourceKind: v.string(), source: v.string(), excerpt: v.string() })
  ),
});

export const deliverTrace = internalAction({
  args: { bundle: bundleInput },
  handler: async (_ctx: ActionCtx, args): Promise<TraceDelivery> => {
    if (!has(process.env, "scorecard")) throw new NotConfigured("grading", "SCORECARD_API_KEY");
    const key = requireKey(process.env, "scorecard", "grading");
    const bundle = args.bundle as GradingBundle;

    const traceId = (await sha256Hex(`trace:${bundle.caseRef}:${bundle.callRef}`)).slice(0, 32);
    const spanId = (await sha256Hex(`span:${bundle.caseRef}:${bundle.callRef}`)).slice(0, 16);
    const payload = buildOtlpTrace(bundle, { traceId, spanId, now: Date.now() });

    const response = await postJson<{ partialSuccess?: unknown }>(ENDPOINTS.scorecard.traces, payload, {
      token: key,
      timeoutMs: 30_000,
    });
    if (!response.ok) {
      throw new Error(`the evaluator refused the run: ${response.status} ${response.error}`);
    }

    return {
      delivered: true,
      note:
        `span ${spanId} delivered for ${bundle.claims.length} claim(s), ` +
        `with ${bundle.claims.filter((c) => c.verdict === "verified").length} verified. ` +
        "An acknowledgement is not a score, so none is claimed; the evaluation is theirs to run.",
    };
  },
});

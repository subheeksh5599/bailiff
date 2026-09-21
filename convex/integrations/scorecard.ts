import { v } from "convex/values";
import { internalAction, type ActionCtx } from "../_generated/server";
import { ENDPOINTS } from "./endpoints";
import { postJson } from "./http";
import { NotConfigured, has, requireKey } from "../lib/config";

/**
 * Adapter: ask someone else's evaluator the same question we asked ourselves.
 *
 * Our own checks decide the gate; this stores a second opinion next to them. When
 * the two disagree, the disagreement is the interesting artifact, so nothing is
 * smoothed over. It cannot release money: only our grade, whose checks are on the
 * case, is passed to the meter.
 */
export type GradingBundle = {
  caseRef: string;
  callRef: string;
  transcriptExcerpt: string;
  claims: Array<{ kind: string; text: string; verdict: string }>;
  evidence: Array<{ kind: string; sourceKind: string; source: string; excerpt: string }>;
};

export function buildTestCaseRequest(bundle: GradingBundle) {
  return {
    name: `call ${bundle.callRef}`,
    description:
      "Judge one customer service call: is every factual statement grounded in the attached " +
      "evidence, and was anything promised that the attached record does not support?",
    input: {
      transcript_excerpt: bundle.transcriptExcerpt,
      claims: bundle.claims,
      evidence: bundle.evidence,
    },
    metadata: { caseRef: bundle.caseRef, callRef: bundle.callRef },
  };
}

export type IndependentScore = {
  submitted: boolean;
  testCaseId: string | null;
  independentScore: number | null;
  note: string;
};

const bundleInput = v.object({
  caseRef: v.string(),
  callRef: v.string(),
  transcriptExcerpt: v.string(),
  claims: v.array(v.object({ kind: v.string(), text: v.string(), verdict: v.string() })),
  evidence: v.array(
    v.object({ kind: v.string(), sourceKind: v.string(), source: v.string(), excerpt: v.string() })
  ),
});

export const crossScore = internalAction({
  args: { bundle: bundleInput },
  handler: async (_ctx: ActionCtx, args): Promise<IndependentScore> => {
    if (!has(process.env, "scorecard")) throw new NotConfigured("grading", "SCORECARD_API_KEY");
    const key = requireKey(process.env, "scorecard", "grading");

    const response = await postJson<{ id?: string; score?: number }>(
      `${ENDPOINTS.scorecard.base}${ENDPOINTS.scorecard.testcases}`,
      buildTestCaseRequest(args.bundle as GradingBundle),
      { token: key, timeoutMs: 60_000 }
    );
    if (!response.ok) {
      throw new Error(`grading service refused the bundle: ${response.status} ${response.error}`);
    }

    const score = typeof response.data?.score === "number" ? response.data.score : null;
    return {
      submitted: true,
      testCaseId: response.data?.id ?? null,
      independentScore: score,
      note: score === null ? "submitted, and the service returned no score, so none is claimed" : "scored",
    };
  },
});

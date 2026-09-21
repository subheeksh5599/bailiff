import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import { evaluateCase, type CaseEvaluation, type Evidence, type Requirement } from "./lib/rules";

/**
 * The only path to "closed".
 *
 * Note what this does NOT do: it does not trust the case's own state, a stored
 * boolean, or anything the agent said on a call. It re-reads the requirement
 * rows and the evidence rows and decides again, every time it is asked.
 */
export async function evaluateById(
  ctx: QueryCtx | MutationCtx,
  caseId: Id<"cases">
): Promise<{ caseDoc: Doc<"cases">; evaluation: CaseEvaluation } | null> {
  const caseDoc = await ctx.db.get(caseId);
  if (!caseDoc) return null;

  const requirementRows = await ctx.db
    .query("requirements")
    .withIndex("by_case", (q) => q.eq("caseId", caseId))
    .collect();

  const evidenceRows = await ctx.db
    .query("evidence")
    .withIndex("by_case", (q) => q.eq("caseId", caseId))
    .collect();

  const requirements: Requirement[] = requirementRows.map((r) => ({
    key: r.key,
    label: r.label,
    kind: r.kind,
    satisfied: r.satisfied,
    satisfiedByEvidenceId: r.satisfiedByEvidenceId,
  }));

  const evidence: Evidence[] = evidenceRows.map((e) => ({
    _id: e._id,
    kind: e.kind,
    sourceKind: e.sourceKind,
    source: e.source,
    fetchedAt: e.fetchedAt,
    value: e.value,
    valueUnits: e.valueUnits,
    excerpt: e.excerpt,
  }));

  return { caseDoc, evaluation: evaluateCase(caseDoc.openedAt, requirements, evidence) };
}

/**
 * Evidence goes stale on its own. A requirement that was satisfied by a read
 * from six weeks ago is not satisfied today, and saying so is the whole point.
 */
export function staleEvidenceIds(
  evidence: Evidence[],
  caseOpenedAt: number,
  now: number,
  ttlMs: number
): string[] {
  return evidence
    .filter((e) => e.fetchedAt >= caseOpenedAt && now - e.fetchedAt > ttlMs)
    .map((e) => e._id ?? `${e.source}@${e.fetchedAt}`);
}

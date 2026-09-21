import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

/**
 * The re-check.
 *
 * A case marked verified last week is a claim about last week. This walks the
 * verified cases, looks at the age of the evidence that closed each one, and when
 * that evidence is old enough to be worthless it takes the closure away: back to
 * dispute, with the reason on the record. Nothing is deleted, so the history of
 * the claim stays readable.
 */
export const verified = internalMutation({
  args: { maxAgeDays: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const maxAgeMs = (args.maxAgeDays ?? 30) * 24 * 60 * 60 * 1000;
    const now = Date.now();

    const verifiedCases = await ctx.db
      .query("cases")
      .withIndex("by_state", (q) => q.eq("state", "VERIFIED"))
      .collect();

    const reverted: Array<{ ref: string; reason: string }> = [];

    for (const caseDoc of verifiedCases) {
      const requirements = await ctx.db
        .query("requirements")
        .withIndex("by_case", (q) => q.eq("caseId", caseDoc._id))
        .collect();

      const agedOut: string[] = [];
      for (const req of requirements) {
        if (!req.satisfied || !req.satisfiedByEvidenceId) continue;
        const evidence = await ctx.db.get(req.satisfiedByEvidenceId);
        if (!evidence) {
          agedOut.push(req.key);
          continue;
        }
        const age = now - evidence.fetchedAt;
        const satisfiedTooEarly = evidence.fetchedAt < caseDoc.openedAt;
        if (age > maxAgeMs || satisfiedTooEarly) {
          await ctx.db.patch(req._id, { satisfied: false, satisfiedByEvidenceId: undefined });
          agedOut.push(req.key);
        }
      }

      if (agedOut.length > 0) {
        const reason = `evidence behind ${agedOut.join(", ")} is no longer current`;
        await ctx.db.patch(caseDoc._id, { state: "DISPUTED", verifiedAt: undefined, closedReason: reason });
        await ctx.db.insert("audit", {
          caseId: caseDoc._id,
          actor: "recheck",
          action: "close.withdrawn",
          from: "VERIFIED",
          to: "DISPUTED",
          detail: reason,
          at: now,
        });
        reverted.push({ ref: caseDoc.ref, reason });
      }
    }

    return { examined: verifiedCases.length, revertedCount: reverted.length, reverted };
  },
});

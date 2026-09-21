import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "./_generated/server";
import { configured } from "./lib/config";

/** The audit trail, written from anywhere in the pipeline. */
export const audit = internalMutation({
  args: {
    caseId: v.optional(v.id("cases")),
    action: v.string(),
    actor: v.string(),
    detail: v.string(),
    from: v.optional(v.string()),
    to: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("audit", { ...args, at: Date.now() });
    return { ok: true as const };
  },
});

/**
 * One read of everything a grader needs, so a grading call is a pure function of
 * what is on the case rather than of a number of round trips that could drift.
 */
export const caseSnapshot = internalQuery({
  args: { caseRef: v.string() },
  handler: async (ctx, args) => {
    const caseDoc = await ctx.db
      .query("cases")
      .withIndex("by_ref", (q) => q.eq("ref", args.caseRef))
      .unique();
    if (!caseDoc) return null;
    const [requirements, evidence, claims, calls, grades] = await Promise.all([
      ctx.db.query("requirements").withIndex("by_case", (q) => q.eq("caseId", caseDoc._id)).collect(),
      ctx.db.query("evidence").withIndex("by_case", (q) => q.eq("caseId", caseDoc._id)).collect(),
      ctx.db.query("claims").withIndex("by_case", (q) => q.eq("caseId", caseDoc._id)).collect(),
      ctx.db.query("calls").withIndex("by_case", (q) => q.eq("caseId", caseDoc._id)).collect(),
      ctx.db.query("grades").withIndex("by_subject", (q) => q.eq("subjectKind", "case").eq("subjectRef", args.caseRef)).collect(),
    ]);
    return {
      case: caseDoc,
      requirements,
      evidence: evidence.sort((a, b) => b.fetchedAt - a.fetchedAt),
      claims,
      calls,
      grades,
    };
  },
});

/**
 * What the board shows about the wiring.
 *
 * Booleans only, and deliberately part of the product rather than a debug screen:
 * "extraction: off" on the board is the honest answer, and it is visible to a
 * judge as well as to us.
 */
export const integrationHealth = query({
  args: {},
  handler: async () => configured(process.env),
});

/** The audit rows for one case, newest last: the case's own diary. */
export const auditForCase = query({
  args: { caseRef: v.string() },
  handler: async (ctx, args) => {
    const caseDoc = await ctx.db
      .query("cases")
      .withIndex("by_ref", (q) => q.eq("ref", args.caseRef))
      .unique();
    if (!caseDoc) return [];
    const rows = await ctx.db.query("audit").withIndex("by_case", (q) => q.eq("caseId", caseDoc._id)).collect();
    return rows.sort((a, b) => a.at - b.at);
  },
});

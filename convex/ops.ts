import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { evaluateById } from "./verifier";
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
async function snapshotOf(ctx: QueryCtx, caseDoc: Doc<"cases">) {
  const [requirements, evidence, claims, calls, grades] = await Promise.all([
    ctx.db.query("requirements").withIndex("by_case", (q) => q.eq("caseId", caseDoc._id)).collect(),
    ctx.db.query("evidence").withIndex("by_case", (q) => q.eq("caseId", caseDoc._id)).collect(),
    ctx.db.query("claims").withIndex("by_case", (q) => q.eq("caseId", caseDoc._id)).collect(),
    ctx.db.query("calls").withIndex("by_case", (q) => q.eq("caseId", caseDoc._id)).collect(),
    ctx.db.query("grades").withIndex("by_subject", (q) => q.eq("subjectKind", "case").eq("subjectRef", caseDoc.ref)).collect(),
  ]);
  return {
    case: caseDoc,
    requirements,
    evidence: evidence.sort((a, b) => b.fetchedAt - a.fetchedAt),
    claims,
    calls,
    grades,
  };
}

export const caseSnapshot = internalQuery({
  args: { caseRef: v.string() },
  handler: async (ctx, args) => {
    const caseDoc = await ctx.db
      .query("cases")
      .withIndex("by_ref", (q) => q.eq("ref", args.caseRef))
      .unique();
    return caseDoc ? await snapshotOf(ctx, caseDoc) : null;
  },
});

/**
 * The same snapshot, by id.
 *
 * A scheduled job knows the case by its id and nothing else, and looking it up by
 * reference would mean carrying a second identifier around for no reason.
 */
export const caseSnapshotById = internalQuery({
  args: { caseId: v.id("cases") },
  handler: async (ctx, args) => {
    const caseDoc = await ctx.db.get(args.caseId as Id<"cases">);
    return caseDoc ? await snapshotOf(ctx, caseDoc) : null;
  },
});

/**
 * The requirement evaluation for a case, by id.
 *
 * A chase has to ask the same question the close gate asks - is anything still
 * outstanding, given the evidence as it stands now - rather than reading a stored
 * boolean that a later read-back may have changed the meaning of.
 */
export const evaluateCaseById = internalQuery({
  args: { caseId: v.id("cases") },
  handler: async (ctx, args) => {
    return await evaluateById(ctx, args.caseId as Id<"cases">);
  },
});

export const integrationHealth = query({
  args: {},
  handler: async () => configured(process.env),
});

/** The whole case as one document, for the board, the demo cards and a judge's own inspection. */
export const caseExport = query({
  args: { caseRef: v.string() },
  handler: async (ctx, args) => {
    const caseDoc = await ctx.db
      .query("cases")
      .withIndex("by_ref", (q) => q.eq("ref", args.caseRef))
      .unique();
    if (!caseDoc) return null;
    const [requirements, evidence, claims, calls, grades, billing, auditRows] = await Promise.all([
      ctx.db.query("requirements").withIndex("by_case", (q) => q.eq("caseId", caseDoc._id)).collect(),
      ctx.db.query("evidence").withIndex("by_case", (q) => q.eq("caseId", caseDoc._id)).collect(),
      ctx.db.query("claims").withIndex("by_case", (q) => q.eq("caseId", caseDoc._id)).collect(),
      ctx.db.query("calls").withIndex("by_case", (q) => q.eq("caseId", caseDoc._id)).collect(),
      ctx.db.query("grades").withIndex("by_subject", (q) => q.eq("subjectKind", "case").eq("subjectRef", args.caseRef)).collect(),
      ctx.db.query("billingEvents").withIndex("by_case", (q) => q.eq("caseId", caseDoc._id)).collect(),
      ctx.db.query("audit").withIndex("by_case", (q) => q.eq("caseId", caseDoc._id)).collect(),
    ]);
    return {
      case: caseDoc,
      requirements,
      evidence: evidence.sort((a, b) => b.fetchedAt - a.fetchedAt),
      claims,
      calls,
      grades,
      billing,
      audit: auditRows.sort((a, b) => a.at - b.at),
      exportedAt: Date.now(),
    };
  },
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

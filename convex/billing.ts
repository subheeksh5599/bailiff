import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { BILLING_REFUSAL, canBill } from "./lib/rules";

/**
 * Billing is the last thing that happens and the only place money is mentioned.
 *
 * The gate is not a policy written in a prompt or a dashboard setting: a billing
 * row cannot exist unless a passing grade for the same subject already exists.
 * The idempotency key is the caller's, so a replayed webhook re-reads the same
 * row instead of charging twice. When the meter call itself fails, the row stays
 * pending and is retried - it never becomes a second row.
 */
export const recordUsage = mutation({
  args: {
    idempotencyKey: v.string(),
    caseId: v.id("cases"),
    gradeId: v.optional(v.id("grades")),
    units: v.number(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("billingEvents")
      .withIndex("by_key", (q) => q.eq("idempotencyKey", args.idempotencyKey))
      .unique();
    if (existing) {
      return { billed: false as const, replay: true as const, billingEventId: existing._id };
    }

    const grade = args.gradeId ? await ctx.db.get(args.gradeId) : null;
    if (!grade) {
      await ctx.db.insert("audit", {
        caseId: args.caseId,
        actor: "billing",
        action: "billing.refused",
        detail: BILLING_REFUSAL.noGrade,
        at: Date.now(),
      });
      return { billed: false as const, replay: false as const, refusal: BILLING_REFUSAL.noGrade };
    }
    if (!canBill(grade.verdict)) {
      const message =
        grade.verdict === "fail" ? BILLING_REFUSAL.fail : BILLING_REFUSAL.unverified;
      await ctx.db.insert("audit", {
        caseId: args.caseId,
        actor: "billing",
        action: "billing.refused",
        detail: message,
        at: Date.now(),
      });
      return { billed: false as const, replay: false as const, refusal: message };
    }

    const billingEventId = await ctx.db.insert("billingEvents", {
      idempotencyKey: args.idempotencyKey,
      caseId: args.caseId,
      gradeId: args.gradeId,
      units: args.units,
      reason: args.reason,
      state: "pending",
      attempts: 0,
      createdAt: Date.now(),
    });
    await ctx.db.insert("audit", {
      caseId: args.caseId,
      actor: "billing",
      action: "billing.accepted",
      detail: `${args.units} unit(s): ${args.reason}`,
      at: Date.now(),
    });
    return { billed: true as const, replay: false as const, billingEventId };
  },
});

export const markMetered = mutation({
  args: { billingEventId: v.id("billingEvents"), meterEventId: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.billingEventId);
    if (!row) throw new Error("no such billing event");
    await ctx.db.patch(args.billingEventId, {
      state: "metered",
      meterEventId: args.meterEventId,
      attempts: row.attempts + 1,
    });
    return { ok: true as const };
  },
});

export const markFailed = mutation({
  args: { billingEventId: v.id("billingEvents"), error: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.billingEventId);
    if (!row) throw new Error("no such billing event");
    // A failed meter call is not a new charge: the row is retried, never duplicated.
    await ctx.db.patch(args.billingEventId, {
      state: "pending",
      attempts: row.attempts + 1,
    });
    await ctx.db.insert("audit", {
      caseId: row.caseId,
      actor: "billing",
      action: "meter.failed",
      detail: args.error,
      at: Date.now(),
    });
    return { retryable: true as const, attempts: row.attempts + 1 };
  },
});

export const forCase = query({
  args: { caseId: v.id("cases") },
  handler: async (ctx, args) =>
    ctx.db.query("billingEvents").withIndex("by_case", (q) => q.eq("caseId", args.caseId)).collect(),
});

export const pending = query({
  args: {},
  handler: async (ctx) =>
    ctx.db.query("billingEvents").withIndex("by_state", (q) => q.eq("state", "pending")).collect(),
});

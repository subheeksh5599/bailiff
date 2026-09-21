import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

/**
 * Ingesting what actually happened, without dressing it up.
 *
 * A transcript is stored as the text that was produced, hashed, and attached to
 * the case as our own record. It is not authoritative for a requirement about the
 * counterparty's behaviour - the kinds differ, so a recording of us promising
 * something cannot satisfy "their record shows the refund moved". Replays are
 * absorbed by call reference: the same call twice is one call.
 */
export const ingestCall = internalMutation({
  args: {
    caseRef: v.string(),
    callRef: v.string(),
    startedAt: v.number(),
    endedAt: v.number(),
    endedReason: v.string(),
    transcript: v.string(),
  },
  handler: async (ctx, args) => {
    const caseDoc = await ctx.db
      .query("cases")
      .withIndex("by_ref", (q) => q.eq("ref", args.caseRef))
      .unique();
    if (!caseDoc) throw new Error(`no case ${args.caseRef}: a call cannot be filed against nothing`);

    const existing = await ctx.db
      .query("calls")
      .withIndex("by_call_ref", (q) => q.eq("callRef", args.callRef))
      .unique();
    if (existing) return { duplicate: true as const, callId: existing._id };

    const callId = await ctx.db.insert("calls", {
      caseId: caseDoc._id,
      callRef: args.callRef,
      startedAt: args.startedAt,
      endedAt: args.endedAt,
      endedReason: args.endedReason,
      durationSeconds: Math.max(0, Math.round((args.endedAt - args.startedAt) / 1000)),
    });

    const evidenceId = await ctx.db.insert("evidence", {
      caseId: caseDoc._id,
      kind: "call_transcript",
      sourceKind: "own_record",
      source: `call:${args.callRef}`,
      fetchedAt: Date.now(),
      contentHash: await hashText(args.transcript),
      excerpt: args.transcript.slice(0, 4000),
      ingestedBy: "telephony-hook",
    });

    await ctx.db.insert("messages", {
      caseId: caseDoc._id,
      direction: "in",
      channel: "phone",
      body: args.transcript.slice(0, 2000),
      at: args.endedAt,
      evidenceId,
    });

    await ctx.db.insert("audit", {
      caseId: caseDoc._id,
      actor: "telephony-hook",
      action: "call.ingested",
      detail: `${args.callRef} ended: ${args.endedReason} (${Math.round((args.endedAt - args.startedAt) / 1000)}s)`,
      at: Date.now(),
    });

    return { duplicate: false as const, callId, evidenceId };
  },
});

export const ingestReply = internalMutation({
  args: {
    caseRef: v.string(),
    from: v.string(),
    subject: v.string(),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    const caseDoc = await ctx.db
      .query("cases")
      .withIndex("by_ref", (q) => q.eq("ref", args.caseRef))
      .unique();
    if (!caseDoc) throw new Error(`no case ${args.caseRef}`);

    const evidenceId = await ctx.db.insert("evidence", {
      caseId: caseDoc._id,
      kind: "email_reply",
      sourceKind: "counterparty",
      source: `mail:${args.from}`,
      fetchedAt: Date.now(),
      contentHash: await hashText(`${args.subject}\n${args.text}`),
      excerpt: args.text.slice(0, 4000),
      ingestedBy: "mail-hook",
    });

    await ctx.db.insert("messages", {
      caseId: caseDoc._id,
      direction: "in",
      channel: "email",
      body: args.text.slice(0, 2000),
      at: Date.now(),
      evidenceId,
    });

    await ctx.db.insert("audit", {
      caseId: caseDoc._id,
      actor: "mail-hook",
      action: "reply.ingested",
      detail: `${args.from}: ${args.subject.slice(0, 120)}`,
      at: Date.now(),
    });

    return { duplicate: false as const, evidenceId };
  },
});

async function hashText(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

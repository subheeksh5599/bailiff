import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { claimVerdict } from "./lib/rules";

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

/**
 * Evidence that speaks for someone else's behaviour, written only from the ingest
 * path: a page of theirs we fetched, a reply they sent, a portal we read. This is
 * never reachable from a browser, so a case cannot be argued to closure by the
 * party that wants it closed.
 */
export const evidenceFromFetch = internalMutation({
  args: {
    caseId: v.id("cases"),
    kind: v.string(),
    sourceKind: v.string(),
    source: v.string(),
    value: v.optional(v.string()),
    valueUnits: v.optional(v.number()),
    excerpt: v.string(),
    ingestedBy: v.string(),
    fetchedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const caseDoc = await ctx.db.get(args.caseId);
    if (!caseDoc) throw new Error("no such case");
    if (args.sourceKind === "own_record") {
      throw new Error("refused: the customer's own documents go through the browser path, not this one");
    }

    const fetchedAt = args.fetchedAt ?? Date.now();
    const evidenceId = await ctx.db.insert("evidence", {
      caseId: args.caseId,
      kind: args.kind,
      sourceKind: args.sourceKind,
      source: args.source,
      fetchedAt,
      contentHash: await hashText(`${args.kind}|${args.source}|${args.value ?? ""}|${args.excerpt}`),
      value: args.value,
      valueUnits: args.valueUnits,
      excerpt: args.excerpt.slice(0, 8000),
      ingestedBy: args.ingestedBy,
    });

    const requirements = await ctx.db
      .query("requirements")
      .withIndex("by_case", (q) => q.eq("caseId", args.caseId))
      .collect();
    const newlySatisfied: string[] = [];
    for (const req of requirements) {
      if (req.satisfied) continue;
      if (req.kind !== args.kind) continue;
      if (fetchedAt < caseDoc.openedAt) continue;
      if (args.sourceKind !== "counterparty" && args.sourceKind !== "own_record") continue;
      await ctx.db.patch(req._id, { satisfied: true, satisfiedByEvidenceId: evidenceId });
      newlySatisfied.push(req.key);
    }

    await ctx.db.insert("audit", {
      caseId: args.caseId,
      actor: args.ingestedBy,
      action: "evidence.read",
      detail: `${args.kind} from ${args.sourceKind} ${args.source}${
        newlySatisfied.length ? `; satisfies ${newlySatisfied.join(", ")}` : ""
      }`,
      at: Date.now(),
    });

    return { evidenceId, newlySatisfied };
  },
});

/**
 * Claims are read out of a transcript by extraction, not typed in by hand.
 *
 * The verdict is not a parameter either: it is derived from the evidence that was
 * attached at the moment the claim was recorded, so a claim cannot be born
 * verified.
 */
export const recordClaim = internalMutation({
  args: {
    caseId: v.id("cases"),
    text: v.string(),
    kind: v.string(),
    evidenceId: v.optional(v.id("evidence")),
    actor: v.string(),
  },
  handler: async (ctx, args) => {
    const caseDoc = await ctx.db.get(args.caseId);
    if (!caseDoc) throw new Error("no such case");
    const evidence = args.evidenceId ? await ctx.db.get(args.evidenceId) : null;
    const assertedAt = Date.now();
    const { verdict, reason } = claimVerdict(
      { assertedAt },
      evidence
        ? {
            kind: evidence.kind,
            sourceKind: evidence.sourceKind,
            source: evidence.source,
            fetchedAt: evidence.fetchedAt,
            excerpt: evidence.excerpt,
          }
        : undefined,
      caseDoc.openedAt
    );
    const claimId = await ctx.db.insert("claims", {
      caseId: args.caseId,
      text: args.text,
      kind: args.kind,
      evidenceId: args.evidenceId,
      assertedAt,
      verdict,
      verdictReason: reason,
    });
    await ctx.db.insert("audit", {
      caseId: args.caseId,
      actor: args.actor,
      action: "claim.recorded",
      detail: `${verdict}: ${args.text.slice(0, 120)}`,
      at: assertedAt,
    });
    return { claimId, verdict, reason };
  },
});

async function hashText(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

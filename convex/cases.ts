import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { checkTransition, requiresGuard, type CaseState } from "./lib/states";
import { claimVerdict, isFresh, requirementMatchedBy } from "./lib/rules";
import { requirementSetHash, sha256Hex } from "./lib/hash";
import { evaluateById } from "./verifier";

/**
 * Case operations.
 *
 * Every state move goes through `move()`, which refuses a transition the state
 * machine does not allow, and refuses a guarded transition unless the guard has
 * actually been evaluated in the same mutation. That is why "closed" cannot be
 * faked by writing a field.
 */

async function writeAudit(
  ctx: MutationCtx,
  entry: {
    caseId?: Id<"cases">;
    actor: string;
    action: string;
    from?: string;
    to?: string;
    detail?: string;
  }
) {
  await ctx.db.insert("audit", { ...entry, at: Date.now() });
}

async function move(
  ctx: MutationCtx,
  caseId: Id<"cases">,
  current: string,
  to: CaseState,
  actor: string,
  guardProven: boolean,
  detail?: string
) {
  const legality = checkTransition(current, to);
  if (!legality.ok) throw new Error(`refused: ${legality.reason}`);
  if (requiresGuard(current, to) && !guardProven) {
    throw new Error(`refused: ${current} -> ${to} requires an evaluated guard`);
  }
  await ctx.db.patch(caseId, { state: to });
  await writeAudit(ctx, { caseId, actor, action: "state", from: current, to, detail });
}

export const openCase = mutation({
  args: {
    ref: v.string(),
    customerRef: v.string(),
    counterpartyName: v.string(),
    counterpartyDomain: v.optional(v.string()),
    channel: v.string(),
    currency: v.optional(v.string()),
    amountClaimedUnits: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("cases")
      .withIndex("by_ref", (q) => q.eq("ref", args.ref))
      .unique();
    if (existing) return { caseId: existing._id, duplicate: true as const };

    const caseId = await ctx.db.insert("cases", {
      ref: args.ref,
      state: "INTAKE",
      customerRef: args.customerRef,
      counterpartyName: args.counterpartyName,
      counterpartyDomain: args.counterpartyDomain,
      amountClaimedUnits: args.amountClaimedUnits,
      currency: args.currency,
      channel: args.channel,
      openedAt: Date.now(),
    });
    await writeAudit(ctx, { caseId, actor: args.channel, action: "case.opened", to: "INTAKE" });
    return { caseId, duplicate: false as const };
  },
});

export const freezeRequirements = mutation({
  args: {
    caseId: v.id("cases"),
    requirements: v.array(
      v.object({ key: v.string(), label: v.string(), kind: v.string() })
    ),
    actor: v.string(),
  },
  handler: async (ctx, args) => {
    const caseDoc = await ctx.db.get(args.caseId);
    if (!caseDoc) throw new Error("no such case");
    if (args.requirements.length === 0) throw new Error("refused: an empty requirement set cannot be judged");
    const already = await ctx.db
      .query("requirements")
      .withIndex("by_case", (q) => q.eq("caseId", args.caseId))
      .collect();
    if (already.length > 0) {
      throw new Error("refused: the requirement set is frozen and may not be rewritten");
    }

    const now = Date.now();
    const hash = await requirementSetHash(args.requirements);
    for (const r of args.requirements) {
      await ctx.db.insert("requirements", {
        caseId: args.caseId,
        key: r.key,
        label: r.label,
        kind: r.kind,
        satisfied: false,
        frozenAt: now,
      });
    }
    await ctx.db.patch(args.caseId, { frozenAt: now, requirementSetHash: hash, state: "REQUIREMENTS_FROZEN" });
    await writeAudit(ctx, {
      caseId: args.caseId,
      actor: args.actor,
      action: "requirements.frozen",
      from: "INTAKE",
      to: "REQUIREMENTS_FROZEN",
      detail: `${args.requirements.length} requirements, set hash ${hash.slice(0, 12)}`,
    });
    return { hash, count: args.requirements.length };
  },
});

/**
 * What the browser is allowed to attach: the customer's own documents.
 *
 * Evidence that speaks for the counterparty is filled in only by the ingest path
 * (a fetch of their page, a reply they sent, a transcript of a call), never by
 * anything a browser asks for. Otherwise a case could be argued to closure by
 * whoever wants it closed. That is why sourceKind is not a parameter here.
 */
export const attachOwnEvidence = mutation({
  args: {
    caseId: v.id("cases"),
    kind: v.string(),
    source: v.string(),
    value: v.optional(v.string()),
    valueUnits: v.optional(v.number()),
    excerpt: v.string(),
    ingestedBy: v.string(),
  },
  handler: async (ctx, args) => {
    const caseDoc = await ctx.db.get(args.caseId);
    if (!caseDoc) throw new Error("no such case");

    const fetchedAt = Date.now();
    const contentHash = await sha256Hex(
      `${args.kind}|${args.source}|${args.value ?? ""}|${args.excerpt}`
    );
    const evidenceId = await ctx.db.insert("evidence", {
      caseId: args.caseId,
      kind: args.kind,
      sourceKind: "own_record",
      source: args.source,
      fetchedAt,
      contentHash,
      value: args.value,
      valueUnits: args.valueUnits,
      excerpt: args.excerpt,
      ingestedBy: args.ingestedBy,
    });

    const requirements = await ctx.db
      .query("requirements")
      .withIndex("by_case", (q) => q.eq("caseId", args.caseId))
      .collect();
    const newlySatisfied: string[] = [];
    for (const req of requirements) {
      if (req.satisfied) continue;
      const matches = requirementMatchedBy(
        { kind: req.kind },
        { kind: args.kind, sourceKind: "own_record", fetchedAt },
        caseDoc.openedAt
      );
      if (matches) {
        await ctx.db.patch(req._id, { satisfied: true, satisfiedByEvidenceId: evidenceId });
        newlySatisfied.push(req.key);
      }
    }

    await writeAudit(ctx, {
      caseId: args.caseId,
      actor: args.ingestedBy,
      action: "evidence.attached",
      detail: `${args.kind} from ${args.source} (hash ${contentHash.slice(0, 12)})${
        newlySatisfied.length ? ` satisfies ${newlySatisfied.join(", ")}` : ""
      }`,
    });
    return { evidenceId, contentHash, newlySatisfied, fresh: isFresh(fetchedAt, caseDoc.openedAt) };
  },
});

export const attemptClose = mutation({
  args: { caseId: v.id("cases"), actor: v.string() },
  handler: async (ctx, args) => {
    const result = await evaluateById(ctx, args.caseId);
    if (!result) throw new Error("no such case");
    const { caseDoc, evaluation } = result;

    if (!evaluation.ok) {
      await writeAudit(ctx, {
        caseId: args.caseId,
        actor: args.actor,
        action: "close.refused",
        detail: evaluation.unsatisfied.map((u) => `${u.key}: ${u.reason}`).join("; "),
      });
      return { closed: false as const, unsatisfied: evaluation.unsatisfied };
    }

    if (caseDoc.state === "VERIFIED") {
      return { closed: true as const, alreadyVerified: true, unsatisfied: [] };
    }

    // Close is only reachable from READBACK_PENDING; anything else is a bug in the caller.
    if (caseDoc.state === "REQUIREMENTS_FROZEN" || caseDoc.state === "CHASING") {
      await ctx.db.patch(args.caseId, { state: "READBACK_PENDING" });
    }
    const current = (await ctx.db.get(args.caseId))!;

    // A case's state and its requirement record have to tell one story. A reader who
    // sees the case marked verified and then finds the requirement it closed on still
    // marked unsatisfied has been handed two answers, and the board reads that flag.
    // The pointer is written here, in the same transaction as the move, and only when
    // it resolves to a real piece of evidence on this case.
    const evidenceRows = await ctx.db
      .query("evidence")
      .withIndex("by_case", (q) => q.eq("caseId", args.caseId))
      .collect();
    const requirementRows = await ctx.db
      .query("requirements")
      .withIndex("by_case", (q) => q.eq("caseId", args.caseId))
      .collect();
    for (const row of requirementRows) {
      const pointer = evaluation.satisfiedBy[row.key];
      if (!pointer || row.satisfied) continue;
      const match = evidenceRows.find(
        (e) => e._id === pointer || `${e.source}@${e.fetchedAt}` === pointer
      );
      if (!match) continue;
      await ctx.db.patch(row._id, { satisfied: true, satisfiedByEvidenceId: match._id });
    }

    await move(ctx, args.caseId, current.state, "VERIFIED", args.actor, true,
      `every requirement satisfied; ${Object.keys(evaluation.satisfiedBy).length} evidence pointers`);
    await ctx.db.patch(args.caseId, { verifiedAt: Date.now() });
    return { closed: true as const, alreadyVerified: false, unsatisfied: [] };
  },
});

export const reopenAsDisputed = mutation({
  args: { caseId: v.id("cases"), reason: v.string(), actor: v.string() },
  handler: async (ctx, args) => {
    const caseDoc = await ctx.db.get(args.caseId);
    if (!caseDoc) throw new Error("no such case");
    await move(ctx, args.caseId, caseDoc.state, "DISPUTED", args.actor, true, args.reason);
    await ctx.db.patch(args.caseId, { verifiedAt: undefined, closedReason: args.reason });
    return { state: "DISPUTED" as const };
  },
});

export const get = query({
  args: { ref: v.string() },
  handler: async (ctx, args) => {
    const caseDoc = await ctx.db
      .query("cases")
      .withIndex("by_ref", (q) => q.eq("ref", args.ref))
      .unique();
    if (!caseDoc) return null;
    const [requirements, evidence, claims, billing, calls] = await Promise.all([
      ctx.db.query("requirements").withIndex("by_case", (q) => q.eq("caseId", caseDoc._id)).collect(),
      ctx.db.query("evidence").withIndex("by_case", (q) => q.eq("caseId", caseDoc._id)).collect(),
      ctx.db.query("claims").withIndex("by_case", (q) => q.eq("caseId", caseDoc._id)).collect(),
      ctx.db.query("billingEvents").withIndex("by_case", (q) => q.eq("caseId", caseDoc._id)).collect(),
      ctx.db.query("calls").withIndex("by_case", (q) => q.eq("caseId", caseDoc._id)).collect(),
    ]);

    // A grade is recorded against the call it judged, so a case has to gather the
    // grades of its calls to show what decided its charge. Asking only for
    // case-level grades returned nothing, which made a graded case look ungraded —
    // the grade was there, the question was wrong.
    const subjects = ["call", "case"] as const;
    const refs = [caseDoc.ref, ...calls.map((call) => call.callRef)];
    const gradeSets = await Promise.all(
      subjects.flatMap((subjectKind) =>
        refs.map((subjectRef) =>
          ctx.db
            .query("grades")
            .withIndex("by_subject", (q) =>
              q.eq("subjectKind", subjectKind).eq("subjectRef", subjectRef)
            )
            .collect()
        )
      )
    );
    const grades = gradeSets.flat().sort((a, b) => b.gradedAt - a.gradedAt);

    return { case: caseDoc, requirements, evidence, claims, grades, billing, calls };
  },
});

export const board = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const rows = await ctx.db.query("cases").collect();
    return rows
      .sort((a, b) => b.openedAt - a.openedAt)
      .slice(0, args.limit ?? 50)
      .map((c) => ({
        ref: c.ref,
        state: c.state,
        counterparty: c.counterpartyName,
        openedAt: c.openedAt,
        verifiedAt: c.verifiedAt,
        amountClaimedUnits: c.amountClaimedUnits,
        currency: c.currency,
        channel: c.channel,
      }));
  },
});

export const evidenceFor = query({
  args: { caseId: v.id("cases") },
  handler: async (ctx, args) =>
    ctx.db.query("evidence").withIndex("by_case", (q) => q.eq("caseId", args.caseId)).collect(),
});

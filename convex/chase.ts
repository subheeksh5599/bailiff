import { v } from "convex/values";
import { internalAction, internalMutation, type ActionCtx } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { emailPath, ownerMailbox } from "./lib/config";
import { MAX_CHASES, chaseDue, chaseNumber } from "./lib/cadence";
import { abandonmentNotice, chaseMessage } from "./lib/messages";

/**
 * Chasing what is still outstanding, on a cadence, until it stops honestly.
 *
 * Two paths lead here and both matter. A sweep runs hourly so a case that was
 * frozen before this feature existed is still picked up, and every case schedules
 * its own first chase when its requirements are frozen, so the cadence is driven
 * by the case rather than by a poll that might not be running.
 *
 * Three rules hold, and they are the same three the rest of the pipeline holds:
 *
 *   A case is only chased while something is actually outstanding - the
 *   evaluation is re-read here, not a stored flag.
 *
 *   No mail path means no chase. The case is not advanced and the missing
 *   variable is written down, because moving it to "chasing" without chasing
 *   would be the board pretending.
 *
 *   The cadence runs out. After the last chase the case is abandoned with the
 *   reason and the outstanding requirements recorded, instead of staying open
 *   forever looking like work in progress.
 */

/** Cases that can be chased: frozen, or already being chased. */
const CHASEABLE = ["REQUIREMENTS_FROZEN", "CHASING"];

/** Find cases that are owed a chase and hand each one to the scheduler. */
export const sweep = internalMutation({
  args: { limit: v.optional(v.number()), now: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const now = args.now ?? Date.now();
    const rows = await ctx.db.query("cases").collect();
    const candidates = rows.filter((row) => CHASEABLE.includes(row.state));

    const scheduled: string[] = [];
    for (const row of candidates.slice(0, args.limit ?? 25)) {
      const decision = chaseDue({
        frozenAt: row.frozenAt ?? row.openedAt,
        chasedAt: row.chasedAt,
        chaseCount: row.chaseCount ?? 0,
        now,
      });
      if (!decision.due && !decision.abandon) continue;
      await ctx.scheduler.runAfter(0, internal.chase.one, { caseId: row._id, now });
      scheduled.push(row.ref);
    }

    return { examined: candidates.length, scheduled };
  },
});

/** One case: decide, and either chase it, abandon it, or leave it alone. */
export const one = internalAction({
  args: { caseId: v.id("cases"), now: v.optional(v.number()) },
  handler: async (ctx: ActionCtx, args): Promise<Record<string, unknown>> => {
    const now = args.now ?? Date.now();
    const snapshot = await ctx.runQuery(internal.ops.caseSnapshotById, { caseId: args.caseId });
    if (!snapshot) return { skipped: "no such case" };

    const doc = snapshot.case;
    if (!CHASEABLE.includes(doc.state)) {
      return { skipped: `a case in ${doc.state} is not chased` };
    }

    // The evaluation, not the stored flag: a requirement is satisfied by evidence
    // read after the case opened, and that is re-read every time it is asked.
    const evaluated = await ctx.runQuery(internal.ops.evaluateCaseById, { caseId: args.caseId });
    if (!evaluated) return { skipped: "the case could not be evaluated" };

    // The shape the close gate reads: ok, and what is still missing with its reason.
    const evaluation = evaluated.evaluation;
    if (evaluation.ok) {
      await ctx.runMutation(internal.ops.audit, {
        caseId: args.caseId,
        actor: "chase",
        action: "chase.not_needed",
        detail: "every requirement is satisfied by a read-back, so there is nothing to chase",
      });
      return { skipped: "every requirement is satisfied" };
    }

    const outstanding = evaluation.unsatisfied.map((u: { key: string; reason: string }) => `${u.key}: ${u.reason}`);
    const decision = chaseDue({
      frozenAt: doc.frozenAt ?? doc.openedAt,
      chasedAt: doc.chasedAt,
      chaseCount: doc.chaseCount ?? 0,
      now,
    });

    if (decision.abandon) {
      // The owner is told the case was given up on, in the same words the audit
      // trail uses, so the two never disagree about what happened.
      const notice = abandonmentNotice({
        caseRef: doc.ref,
        counterparty: doc.counterpartyName,
        attempts: doc.chaseCount ?? MAX_CHASES,
        outstanding: evaluation.unsatisfied,
      });
      await ctx.runMutation(internal.ops.audit, {
        caseId: args.caseId,
        actor: "chase",
        action: "abandonment.recorded",
        detail: notice.subject,
      });
      await ctx.runMutation(internal.cases.advance, {
        caseId: args.caseId,
        to: "ABANDONED",
        actor: "chase",
        detail: `${MAX_CHASES} chases went unanswered. Still outstanding: ${outstanding.join("; ")}`,
      });
      return { abandoned: true, outstanding };
    }

    if (!decision.due) return { skipped: decision.reason };

    // No mail path is a real answer, and the case does not move on the strength of
    // a message nobody sent.
    const path = emailPath();
    const owner = ownerMailbox();
    if (!path || !owner) {
      await ctx.runMutation(internal.ops.audit, {
        caseId: args.caseId,
        actor: "chase",
        action: "chase.skipped",
        detail:
          "no mail path is configured (AGENTMAIL_API_KEY with AGENTMAIL_INBOX_ID, or " +
          "RESEND_API_KEY with RESEND_FROM); the case is not advanced",
      });
      return { skipped: "no mail path is configured" };
    }

    const attempt = chaseNumber(doc.chaseCount ?? 0);
    const message = chaseMessage({
      caseRef: doc.ref,
      counterparty: doc.counterpartyName,
      attempt,
      outstanding: evaluation.unsatisfied,
    });
    const subject = message.subject;
    const body = message.text;
    // To the counterparty when a contact is known, otherwise to the owner as a
    // reminder - and the audit says which, so a chase is never assumed to have
    // reached anyone it did not reach.
    const to = doc.counterpartyContact ?? owner;
    const sent =
      path === "agentmail"
        ? await ctx.runAction(internal.integrations.agentmail.sendMessage, {
            to,
            subject,
            text: body,
            purpose: `chase ${doc.ref}`,
          })
        : await ctx.runAction(internal.integrations.resend.sendEmail, {
            to,
            subject,
            text: body,
            purpose: `chase ${doc.ref}`,
          });

    if (!sent.sent) {
      await ctx.runMutation(internal.ops.audit, {
        caseId: args.caseId,
        actor: path,
        action: "chase.failed",
        detail: `the chase could not be delivered to ${to}; the case is not advanced`,
      });
      return { skipped: "the chase could not be delivered" };
    }

    if (doc.state !== "CHASING") {
      await ctx.runMutation(internal.cases.advance, {
        caseId: args.caseId,
        to: "CHASING",
        actor: "chase",
        detail: decision.reason,
      });
    }

    const counted = await ctx.runMutation(internal.chase.markChased, {
      caseId: args.caseId,
      now,
      detail: `${attempt} sent to ${to}${doc.counterpartyContact ? "" : " (the owner: no counterparty contact on the case)"}; outstanding: ${outstanding.join("; ")}`,
    });

    return { chased: true, to, attempt, chaseCount: counted.chaseCount, outstanding };
  },
});

/** The attempt is counted only once the message was accepted by the provider. */
export const markChased = internalMutation({
  args: { caseId: v.id("cases"), now: v.number(), detail: v.string() },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.caseId);
    if (!doc) throw new Error("no such case");
    const chaseCount = (doc.chaseCount ?? 0) + 1;
    await ctx.db.patch(args.caseId, { chasedAt: args.now, chaseCount });
    await ctx.db.insert("audit", {
      caseId: args.caseId,
      actor: "chase",
      action: "chase.sent",
      detail: args.detail,
      at: args.now,
    });
    return { chaseCount };
  },
});

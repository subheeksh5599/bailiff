import { v } from "convex/values";
import { action, type ActionCtx } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { postJson } from "./integrations/http";
import { ENDPOINTS } from "./integrations/endpoints";
import { NotConfigured } from "./lib/config";

/**
 * The two things the board is allowed to start.
 *
 * Both are reads of the outside world that the operator asks for by name. The
 * work happens on the server, never in the browser: the board says which page
 * to read, and this reads it, times it and files it against the case. Nothing
 * here lets a browser assert what a page said, and nothing here can close a
 * case — a read only ever adds evidence, and the closure rules read it the same
 * way they read anything else.
 */

/**
 * Read a page as evidence on a case.
 *
 * The same path the phone line's read_source tool takes: one fetch, stamped
 * with when it happened, filed with the counterparty as its source kind, and
 * checked against the case's frozen requirements so the operator is told
 * immediately whether it satisfied one.
 */
/** Reading a page as evidence is an operator action, so it needs a session. */
export const readSource = action({
  args: { caseRef: v.string(), url: v.string(), kind: v.optional(v.string()), token: v.optional(v.string()) },
  handler: async (
    ctx: ActionCtx,
    args
  ): Promise<{
    source: string;
    readAt: number;
    satisfies: string[];
    excerpt: string;
  }> => {
    await ctx.runQuery(internal.auth.requireSession, { token: args.token });
    const snapshot = await ctx.runQuery(api.cases.get, { ref: args.caseRef });
    if (!snapshot) throw new Error(`no case ${args.caseRef}`);
    if (snapshot.case.state === "VERIFIED") {
      throw new Error("refused: this case is settled, and settled cases are not fed new evidence");
    }

    const url = args.url.trim();
    if (!/^https?:\/\//i.test(url)) {
      throw new Error("refused: a source has to be an http or https address");
    }

    const page = await ctx.runAction(internal.integrations.firecrawl.readPage, { url });
    const written = await ctx.runMutation(internal.ingest.evidenceFromFetch, {
      caseId: snapshot.case._id,
      kind: args.kind?.trim() || "page_read",
      // Read by us, of their page: the record of a read, not their submission.
      sourceKind: "counterparty",
      source: page.sourceUrl,
      excerpt: page.markdown.slice(0, 4000),
      ingestedBy: "board",
      fetchedAt: page.fetchedAt,
    });

    return {
      source: page.sourceUrl,
      readAt: page.fetchedAt,
      satisfies: written.newlySatisfied,
      excerpt: page.markdown.slice(0, 600),
    };
  },
});

/**
 * Start the call a case is built around.
 *
 * The board asks the phone line to dial, and the case reference rides along in
 * the call's metadata — that is what lets the finished call find its way back to
 * the right case when the end-of-call report arrives. Without this the product
 * could only be used by whoever dials the number by hand, which is not the same
 * product: a case would have to exist before anyone could know to call about it.
 *
 * A settled case is refused here too. Reopening it first is the way to say that
 * something new needs to be asked, and the audit trail records which of the two
 * happened.
 */
/** Dialling costs money on a real plan, so it needs a session too. */
export const startCall = action({
  args: { caseRef: v.string(), to: v.string(), token: v.optional(v.string()) },
  handler: async (ctx: ActionCtx, args): Promise<{ callId: string | null; to: string }> => {
    await ctx.runQuery(internal.auth.requireSession, { token: args.token });
    const snapshot = await ctx.runQuery(api.cases.get, { ref: args.caseRef });
    if (!snapshot) throw new Error(`no case ${args.caseRef}`);
    if (snapshot.case.state === "VERIFIED") {
      throw new Error("refused: this case is settled; reopen it as disputed before dialling again");
    }

    const to = args.to.trim();
    if (!/^\+[1-9][0-9]{6,15}$/.test(to)) {
      throw new Error("refused: a number to dial has to be in international form, starting with +");
    }

    const key = process.env.VAPI_API_KEY;
    const assistantId = process.env.VAPI_ASSISTANT_ID;
    const phoneNumberId = process.env.VAPI_PHONE_NUMBER_ID;
    if (!key || !assistantId || !phoneNumberId) {
      throw new NotConfigured("telephony", "VAPI_API_KEY / VAPI_ASSISTANT_ID / VAPI_PHONE_NUMBER_ID");
    }

    const response = await postJson<{ id?: string }>(
      `${ENDPOINTS.vapi.base}/call`,
      {
        assistantId,
        phoneNumberId,
        customer: { number: to },
        metadata: { caseRef: args.caseRef },
      },
      { token: key, timeoutMs: 30_000 }
    );
    if (!response.ok) {
      throw new Error(`the phone line refused the call: ${response.status} ${response.error}`);
    }

    const callId = response.data?.id ?? null;
    await ctx.runMutation(internal.ops.audit, {
      caseId: snapshot.case._id,
      actor: "board",
      action: "call.started",
      detail: `dialling ${to}; the case reference travels in the call's metadata`,
    });
    return { callId, to };
  },
});

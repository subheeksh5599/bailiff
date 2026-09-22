import { v } from "convex/values";
import { action, type ActionCtx } from "./_generated/server";
import { api, internal } from "./_generated/api";

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
export const readSource = action({
  args: { caseRef: v.string(), url: v.string(), kind: v.optional(v.string()) },
  handler: async (
    ctx: ActionCtx,
    args
  ): Promise<{
    source: string;
    readAt: number;
    satisfies: string[];
    excerpt: string;
  }> => {
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

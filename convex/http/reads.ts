import { httpAction } from "../_generated/server";
import { configured } from "../lib/config";
import { components } from "../_generated/api";
import { api } from "../_generated/api";
import { json } from "./json";
import type { HttpRouter } from "convex/server";

/**
 * The routes anyone may call.
 *
 * Everything here reads. `/health` reports which integrations carry a key, `/cases`
 * and `/case` return the same rows the board renders, and `/dashboard` serves the
 * app itself at the address a person would type. None of them can write, close a
 * case, or move a charge, which is what makes it safe to publish them: a claim
 * about the site can be checked with a request instead of taken on faith.
 */
export function registerReads(http: HttpRouter): void {
/** Which integrations are actually configured. Booleans only, never values. */
http.route({
  path: "/health",
  method: "GET",
  handler: httpAction(async () => {
    return json({ ok: true, integrations: configured(process.env) });
  }),
});

/**
 * The board's own address, in the form a person would type.
 *
 * The app is exported as one file and the static layer serves exact paths only,
 * so `/dashboard` would otherwise fall through to the landing page. Serving the
 * file's bytes here — rather than redirecting — keeps the address clean instead
 * of leaving a file extension in the bar for anyone who shortens it by hand.
 */
http.route({
  path: "/dashboard",
  method: "GET",
  handler: httpAction(async (ctx) => {
    // The same lookup the static layer uses, asked for the app's own file.
    const asset = await ctx.runQuery(components.staticHosting.lib.resolveAssetForHttp, {
      path: "/dashboard.html",
    });
    if (!asset) return new Response("Not Found", { status: 404 });

    const headers = { "content-type": "text/html; charset=utf-8" };
    if (asset.appStorageId) {
      const blob = await ctx.storage.get(asset.appStorageId);
      if (blob) return new Response(blob, { headers });
    }
    if (asset.storageUrl) {
      const upstream = await fetch(asset.storageUrl);
      if (upstream.ok) return new Response(upstream.body, { headers });
    }
    return new Response("Not Found", { status: 404 });
  }),
});

/**
 * The board, as JSON.
 *
 * Public on purpose: every case row here is the same row the site renders, so a
 * claim about what the board shows can be checked with a single request instead
 * of taken on faith. It reads; it cannot write.
 */
http.route({
  path: "/cases",
  method: "GET",
  handler: httpAction(async (ctx) => {
    const rows = await ctx.runQuery(api.cases.board, { limit: 50 });
    return json(rows);
  }),
});

/** One case, with everything attached to it: same snapshot the board renders. */
http.route({
  path: "/case",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const ref = new URL(request.url).searchParams.get("ref");
    if (!ref) return json({ ok: false, error: "ref is required" }, 400);
    const snapshot = await ctx.runQuery(api.cases.get, { ref });
    if (!snapshot) return json({ ok: false, error: `no case ${ref}` }, 404);
    const audit = await ctx.runQuery(api.ops.auditForCase, { caseRef: ref });
    return json({ case: snapshot.case, requirements: snapshot.requirements, evidence: snapshot.evidence, claims: snapshot.claims, grades: snapshot.grades, billing: snapshot.billing, audit });
  }),
});
}

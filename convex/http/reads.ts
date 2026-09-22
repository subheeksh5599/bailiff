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

/**
 * The deployment, asked to check itself.
 *
 * The same report the self-test action returns, at an address anyone can reach
 * with curl, so verifying it does not require the Convex CLI, an account or a
 * deploy key. It is a read in spirit: the one thing it writes is a four-byte file
 * it immediately deletes, because "storage works" cannot be answered by reading
 * configuration.
 */
http.route({
  path: "/selftest",
  method: "GET",
  handler: httpAction(async (ctx) => {
    return json(await ctx.runAction(api.selftest.run, {}));
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

    // The same rows again, reduced to the claim itself: this requirement was frozen
    // with this hash, it was satisfied by this piece of evidence with this hash, the
    // grade came back with these checks, and the charge is in this state. That is the
    // whole assertion, small enough to diff against what anyone else was told.
    const proof = {
      requirementSetHash: snapshot.case.requirementSetHash ?? null,
      openedAt: snapshot.case.openedAt,
      state: snapshot.case.state,
      requirements: snapshot.requirements.map((requirement) => {
        const found = snapshot.evidence.find(
          (item) => item._id === requirement.satisfiedByEvidenceId
        );
        return {
          key: requirement.key,
          kind: requirement.kind,
          satisfied: requirement.satisfied,
          satisfiedBy: found
            ? { source: found.source, sourceKind: found.sourceKind, readAt: found.fetchedAt, hash: found.contentHash }
            : null,
        };
      }),
      grades: snapshot.grades.map((grade) => ({
        subject: grade.subjectRef,
        verdict: grade.verdict,
        checks: grade.checks.map((check) => ({ name: check.name, passed: check.passed })),
      })),
      billing: snapshot.billing.map((row) => ({
        state: row.state,
        key: row.idempotencyKey,
        units: row.units,
      })),
    };

    return json({ proof, case: snapshot.case, requirements: snapshot.requirements, evidence: snapshot.evidence, claims: snapshot.claims, grades: snapshot.grades, billing: snapshot.billing, audit });
  }),
});
}

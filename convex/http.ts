import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { parseInbound } from "./integrations/agentmail";
import { configured } from "./lib/config";
import { registerStaticRoutes } from "@convex-dev/static-hosting";
import { components } from "./_generated/api";

/**
 * The only doors into the ledger.
 *
 * Both hooks are fail-closed: with no shared secret configured they refuse and
 * say so, rather than accepting anything and hoping. Nothing here invents data -
 * a payload that does not carry a transcript is rejected, not filled in.
 */
const http = httpRouter();

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** Which integrations are actually configured. Booleans only, never values. */
http.route({
  path: "/health",
  method: "GET",
  handler: httpAction(async () => {
    return json({ ok: true, integrations: configured(process.env) });
  }),
});

/** A finished call. The transcript is stored as evidence; it is never paraphrased into it. */
http.route({
  path: "/hooks/call-ended",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const secret = process.env.VAPI_WEBHOOK_SECRET;
    if (!secret) {
      return json({ ok: false, error: "VAPI_WEBHOOK_SECRET is not configured; refusing the webhook" }, 503);
    }
    if (request.headers.get("x-vapi-secret") !== secret) {
      return json({ ok: false, error: "bad signature" }, 401);
    }

    const payload = (await request.json()) as {
      message?: {
        type?: string;
        call?: { id?: string; startedAt?: string; endedAt?: string; metadata?: { caseRef?: string } };
        artifact?: { transcript?: string; recordingUrl?: string };
        analysis?: { structuredData?: unknown; summary?: string };
        endedReason?: string;
      };
    };

    const message = payload.message;
    const transcript = message?.artifact?.transcript;
    const caseRef = message?.call?.metadata?.caseRef;
    const callRef = message?.call?.id;

    if (!callRef || !caseRef) return json({ ok: false, error: "call id and metadata.caseRef are required" }, 400);
    if (!transcript || transcript.trim().length === 0) {
      return json({ ok: false, error: "no transcript on the payload; nothing to store" }, 400);
    }

    const startedAt = message?.call?.startedAt ? Date.parse(message.call.startedAt) : Date.now();
    const endedAt = message?.call?.endedAt ? Date.parse(message.call.endedAt) : Date.now();

    const result = await ctx.runMutation(internal.ingest.ingestCall, {
      caseRef,
      callRef,
      startedAt,
      endedAt,
      endedReason: message?.endedReason ?? "unknown",
      transcript,
      analysis: message?.analysis?.structuredData
        ? JSON.stringify(message.analysis.structuredData)
        : undefined,
    });
    return json({ ok: true, ...result });
  }),
});

/** An inbound reply from the counterparty, forwarded by the mail provider. */
http.route({
  path: "/hooks/inbound-email",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const secret = process.env.RESEND_WEBHOOK_SECRET;
    if (!secret) {
      return json({ ok: false, error: "RESEND_WEBHOOK_SECRET is not configured; refusing the webhook" }, 503);
    }
    if (request.headers.get("x-webhook-secret") !== secret) {
      return json({ ok: false, error: "bad signature" }, 401);
    }
    const payload = (await request.json()) as {
      caseRef?: string;
      from?: string;
      subject?: string;
      text?: string;
    };
    if (!payload.caseRef || !payload.text) {
      return json({ ok: false, error: "caseRef and text are required" }, 400);
    }
    const result = await ctx.runMutation(internal.ingest.ingestReply, {
      caseRef: payload.caseRef,
      from: payload.from ?? "unknown",
      subject: payload.subject ?? "",
      text: payload.text,
    });
    return json({ ok: true, ...result });
  }),
});

/**
 * The assistant's tools.
 *
 * This is the mechanism behind the instruction "call read_source before stating
 * any number": the only way a value reaches the call is through this handler, and
 * every read is written onto the case with the time it was read. A tool call that
 * cannot be filed against a case is refused, so a number can never be spoken from
 * a fetch that belongs to nothing.
 */
http.route({
  path: "/hooks/vapi-tools",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const secret = process.env.VAPI_WEBHOOK_SECRET;
    if (!secret) {
      return json({ ok: false, error: "VAPI_WEBHOOK_SECRET is not configured; refusing the tool call" }, 503);
    }
    if (request.headers.get("x-vapi-secret") !== secret) return json({ ok: false, error: "bad signature" }, 401);

    const payload = (await request.json()) as {
      message?: {
        type?: string;
        call?: { id?: string; metadata?: { caseRef?: string } };
        toolCallList?: Array<{ id?: string; function?: { name?: string; arguments?: string } }>;
      };
    };
    const message = payload.message;
    const caseRef = message?.call?.metadata?.caseRef;
    const toolCalls = message?.toolCallList ?? [];
    if (!caseRef) {
      return json({ ok: false, error: "metadata.caseRef is required so a read can be filed against a case" }, 400);
    }

    const snapshot = await ctx.runQuery(internal.ops.caseSnapshot, { caseRef });
    if (!snapshot) return json({ ok: false, error: `no case ${caseRef}` }, 404);

    const results: Array<{ toolCallId: string | undefined; result: string }> = [];
    for (const call of toolCalls) {
      const name = call.function?.name;
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(call.function?.arguments ?? "{}") as Record<string, unknown>;
      } catch {
        args = {};
      }

      if (name === "read_source") {
        const kind = typeof args.kind === "string" ? args.kind : "payment_record";
        try {
          const page = await ctx.runAction(internal.integrations.firecrawl.readPage, {
            url: String(args.url ?? ""),
          });
          const written = await ctx.runMutation(internal.ingest.evidenceFromFetch, {
            caseId: snapshot.case._id,
            kind,
            sourceKind: "counterparty",
            source: page.sourceUrl,
            excerpt: page.markdown.slice(0, 4000),
            ingestedBy: "call-tool",
            fetchedAt: page.fetchedAt,
          });
          results.push({
            toolCallId: call.id,
            result: JSON.stringify({
              read: page.markdown.slice(0, 2000),
              source: page.sourceUrl,
              readAt: new Date(page.fetchedAt).toISOString(),
              satisfies: written.newlySatisfied,
            }),
          });
        } catch (error) {
          results.push({
            toolCallId: call.id,
            result: JSON.stringify({
              error: error instanceof Error ? error.message : "the read failed",
              instruction: "say you cannot confirm it yet",
            }),
          });
        }
        continue;
      }

      if (name === "file_promise") {
        const claim = await ctx.runMutation(internal.ingest.recordClaim, {
          caseId: snapshot.case._id,
          text: String(args.text ?? ""),
          kind: "promise",
          actor: "call-tool",
        });
        results.push({ toolCallId: call.id, result: JSON.stringify({ recorded: claim.verdict }) });
        continue;
      }

      results.push({ toolCallId: call.id, result: JSON.stringify({ error: `unknown tool ${name}` }) });
    }

    return json({ results });
  }),
});

/**
 * The counterparty's reply, arriving by mail.
 *
 * This is the path that turns a chase into evidence: the reply is the other side's
 * own words, stored verbatim and hashed, and the case's requirements are
 * re-examined against it. A delivery with nothing readable in it is refused
 * rather than recorded as a reply.
 */
http.route({
  path: "/hooks/agentmail",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const secret = process.env.AGENTMAIL_WEBHOOK_SECRET;
    if (!secret) {
      return json({ ok: false, error: "AGENTMAIL_WEBHOOK_SECRET is not configured; refusing the delivery" }, 503);
    }
    const presented = request.headers.get("x-webhook-secret") ?? request.headers.get("x-agentmail-signature");
    if (presented !== secret) return json({ ok: false, error: "bad signature" }, 401);

    const payload = await request.json();
    const reply = parseInbound(payload);
    if (!reply) {
      return json({ ok: false, error: "no sender or no readable body; nothing recorded" }, 400);
    }

    // The case is found from the subject line or a header the sender kept, both of
    // which the outgoing message sets. Without a reference the reply cannot be filed.
    const envelope = payload as { caseRef?: string; message?: { case_ref?: string } };
    const caseRef = envelope.caseRef ?? envelope.message?.case_ref ?? extractCaseRef(reply.subject) ?? extractCaseRef(reply.text);
    if (!caseRef) {
      return json({ ok: false, error: "no case reference in the message; cannot file it against a case" }, 400);
    }

    const result = await ctx.runMutation(internal.ingest.ingestReply, {
      caseRef,
      from: reply.from,
      subject: reply.subject,
      text: reply.text,
    });
    return json({ ok: true, caseRef, ...result });
  }),
});

/** The reference is carried in the subject so any reply keeps it. */
export function extractCaseRef(text: string): string | null {
  const match = text.match(/\[case:([A-Za-z0-9._-]+)\]/);
  return match ? match[1] : null;
}

// Last, so every exact route above wins: unknown paths fall through to the built
// site, which is what makes a browser refresh on /board work.
registerStaticRoutes(http, components.staticHosting);

export default http;

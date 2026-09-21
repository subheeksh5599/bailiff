import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

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
    return json({
      ok: true,
      integrations: {
        convex: true,
        callTranscripts: Boolean(process.env.VAPI_WEBHOOK_SECRET),
        telephony: Boolean(process.env.VAPI_API_KEY),
        webReads: Boolean(process.env.FIRECRAWL_API_KEY),
        extraction: Boolean(process.env.OPENAI_API_KEY),
        grading: Boolean(process.env.SCORECARD_API_KEY),
        metering: Boolean(process.env.AUTUMN_SECRET_KEY),
        email: Boolean(process.env.RESEND_API_KEY),
        knowledge: Boolean(process.env.INKEEP_API_KEY),
      },
    });
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

export default http;

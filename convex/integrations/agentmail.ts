import { v } from "convex/values";
import { internalAction, type ActionCtx } from "../_generated/server";
import { postJson } from "./http";
import { NotConfigured, has, requireKey } from "../lib/config";

/**
 * Adapter: the case's mailbox.
 *
 * Chosen ahead of a plain mail API because a case needs both directions: the
 * message that goes out, and the reply that comes back. A reply is the
 * counterparty's own words, so it becomes evidence on the case rather than a
 * notification someone has to read. This module only talks to the vendor; the
 * orchestrator and the ingest hook do the writing.
 */
export const AGENTMAIL_BASE = process.env.AGENTMAIL_BASE_URL ?? "https://api.agentmail.to/v0";

export function buildSendRequest(input: { to: string; subject: string; text: string }) {
  return { to: [input.to], subject: input.subject, text: input.text };
}

export type MessageReport = { sent: true; messageId: string | null };

export const sendMessage = internalAction({
  args: {
    to: v.string(),
    subject: v.string(),
    text: v.string(),
    purpose: v.string(),
  },
  handler: async (_ctx: ActionCtx, args): Promise<MessageReport> => {
    if (!has(process.env, "agentmail")) {
      throw new NotConfigured("email", "AGENTMAIL_API_KEY");
    }
    const key = requireKey(process.env, "agentmail", "email");
    const inbox = process.env.AGENTMAIL_INBOX_ID;
    if (!inbox) throw new NotConfigured("email inbox", "AGENTMAIL_INBOX_ID");

    const response = await postJson<{ message_id?: string; id?: string }>(
      `${AGENTMAIL_BASE}/inboxes/${encodeURIComponent(inbox)}/messages/send`,
      buildSendRequest({ to: args.to, subject: args.subject, text: args.text }),
      { token: key, timeoutMs: 30_000 }
    );
    if (!response.ok) {
      throw new Error(`the message was not accepted: ${response.status} ${response.error}`);
    }
    return { sent: true, messageId: response.data?.message_id ?? response.data?.id ?? null };
  },
});

/**
 * A reply, read out of the provider's webhook.
 *
 * Kept as a pure function so the shape of what a reply must contain is testable
 * without a vendor: a sender, a subject and a body, or nothing is recorded.
 */
export type InboundReply = { from: string; subject: string; text: string; messageId: string | null };

export function parseInbound(payload: unknown): InboundReply | null {
  const p = payload as {
    message?: {
      from?: string | { address?: string };
      subject?: string;
      text?: string;
      extracted_text?: string;
      message_id?: string;
    };
    from?: string;
    subject?: string;
    text?: string;
  };
  const msg = p?.message ?? p;
  if (!msg) return null;
  const from =
    typeof msg.from === "string" ? msg.from : (msg.from as { address?: string } | undefined)?.address ?? "";
  const text = (msg.text ?? (msg as { extracted_text?: string }).extracted_text ?? "").trim();
  if (!from || text.length === 0) return null;
  return {
    from,
    subject: msg.subject ?? "(no subject)",
    text,
    messageId: (msg as { message_id?: string }).message_id ?? null,
  };
}

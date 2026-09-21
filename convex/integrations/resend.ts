import { v } from "convex/values";
import { internalAction, type ActionCtx } from "../_generated/server";
import { ENDPOINTS } from "./endpoints";
import { postJson } from "./http";
import { NotConfigured, has, requireKey } from "../lib/config";

/**
 * Adapter: send the written record.
 *
 * The text is composed by the caller from rows that already exist on the case, so
 * nothing can arrive in an email that is not also on the case. This module only
 * delivers it and reports whether delivery was accepted.
 */
export function buildEmailRequest(input: { from: string; to: string; subject: string; text: string }) {
  return { from: input.from, to: [input.to], subject: input.subject, text: input.text };
}

export type EmailReport = { sent: true; messageId: string | null };

export const sendEmail = internalAction({
  args: {
    to: v.string(),
    subject: v.string(),
    text: v.string(),
    purpose: v.string(),
  },
  handler: async (_ctx: ActionCtx, args): Promise<EmailReport> => {
    if (!has(process.env, "resend")) throw new NotConfigured("email", "RESEND_API_KEY");
    const key = requireKey(process.env, "resend", "email");
    const from = process.env.RESEND_FROM;
    if (!from) throw new NotConfigured("email sender", "RESEND_FROM");

    const response = await postJson<{ id?: string }>(
      `${ENDPOINTS.resend.base}${ENDPOINTS.resend.emails}`,
      buildEmailRequest({ from, to: args.to, subject: args.subject, text: args.text }),
      { token: key }
    );
    if (!response.ok) throw new Error(`email refused: ${response.status} ${response.error}`);
    return { sent: true, messageId: response.data?.id ?? null };
  },
});

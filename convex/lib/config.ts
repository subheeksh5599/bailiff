/**
 * Which integrations are actually switched on.
 *
 * Deliberately explicit: every module asks this before it acts, and when a key is
 * absent the caller stops and records why. There is no fallback value and no
 * placeholder - an unconfigured integration produces no data at all, because a
 * plausible-looking number that no vendor produced is worse than an empty screen.
 */

export type Env = Record<string, string | undefined>;

export const KEYS = {
  openai: "OPENAI_API_KEY",
  router: "ROUTER_API_KEY",
  firecrawl: "FIRECRAWL_API_KEY",
  scorecard: "SCORECARD_API_KEY",
  autumn: "AUTUMN_SECRET_KEY",
  resend: "RESEND_API_KEY",
  agentmail: "AGENTMAIL_API_KEY",
  inkeep: "INKEEP_API_KEY",
  vapi: "VAPI_API_KEY",
  vapiSecret: "VAPI_WEBHOOK_SECRET",
  resendSecret: "RESEND_WEBHOOK_SECRET",
  agentmailSecret: "AGENTMAIL_WEBHOOK_SECRET",
  turnstile: "TURNSTILE_SECRET_KEY",
} as const;

export function has(env: Env, key: keyof typeof KEYS): boolean {
  const value = env[KEYS[key]];
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Which way the case's mail goes.
 *
 * A mailbox that can also receive is preferred, because a reply from the
 * counterparty is evidence and a one-way sender cannot deliver one. Returning
 * null is a real answer: no mail path is configured, so the pipeline says so
 * rather than pretending a message was sent.
 */
export function emailPath(env: Env = process.env): "agentmail" | "resend" | null {
  if (has(env, "agentmail") && (env.AGENTMAIL_INBOX_ID ?? "").trim().length > 0) return "agentmail";
  if (has(env, "resend") && (env.RESEND_FROM ?? "").trim().length > 0) return "resend";
  return null;
}

/**
 * Where the report goes.
 *
 * The case mailbox is the owner's fallback rather than an error: if no separate
 * owner address is configured, the mailbox that already holds the case's mail is
 * the right place for its reports, and nothing is silently dropped.
 */
export function ownerMailbox(env: Env = process.env): string | null {
  const explicit = (env.OWNER_EMAIL ?? "").trim();
  if (explicit.length > 0) return explicit;
  const inbox = (env.AGENTMAIL_INBOX_ID ?? "").trim();
  return inbox.length > 0 ? inbox : null;
}

export function configured(env: Env = process.env): Record<string, boolean> {
  return {
    convex: true,
    firecrawl: has(env, "firecrawl"),
    // Any reader that will answer makes extraction configured: a transcript still
    // has to be read, and a second reader is not a lesser one.
    extraction: has(env, "openai") || has(env, "router"),
    grading: has(env, "scorecard"),
    metering: has(env, "autumn"),
    email: emailPath(env) !== null,
    mailReceives: emailPath(env) === "agentmail",
    knowledge: has(env, "inkeep"),
    telephony: has(env, "vapi"),
    hooks:
      has(env, "vapiSecret") &&
      (has(env, "resendSecret") || has(env, "agentmailSecret")),
  };
}

export class NotConfigured extends Error {
  constructor(public readonly integration: string, public readonly variable: string) {
    super(`${integration} is not configured: set ${variable}`);
    this.name = "NotConfigured";
  }
}

/**
 * The single door to a vendor. Callers get either a value the vendor produced or
 * an exception naming the missing key - never a stand-in.
 */
export function requireKey(env: Env, key: keyof typeof KEYS, integration: string): string {
  const value = env[KEYS[key]];
  if (!value || value.trim().length === 0) {
    throw new NotConfigured(integration, KEYS[key]);
  }
  return value;
}

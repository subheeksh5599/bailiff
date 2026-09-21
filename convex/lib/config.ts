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
  firecrawl: "FIRECRAWL_API_KEY",
  scorecard: "SCORECARD_API_KEY",
  autumn: "AUTUMN_SECRET_KEY",
  resend: "RESEND_API_KEY",
  inkeep: "INKEEP_API_KEY",
  vapi: "VAPI_API_KEY",
  vapiSecret: "VAPI_WEBHOOK_SECRET",
  resendSecret: "RESEND_WEBHOOK_SECRET",
  turnstile: "TURNSTILE_SECRET_KEY",
} as const;

export function has(env: Env, key: keyof typeof KEYS): boolean {
  const value = env[KEYS[key]];
  return typeof value === "string" && value.trim().length > 0;
}

export function configured(env: Env = process.env): Record<string, boolean> {
  return {
    convex: true,
    firecrawl: has(env, "firecrawl"),
    extraction: has(env, "openai"),
    grading: has(env, "scorecard"),
    metering: has(env, "autumn"),
    email: has(env, "resend"),
    knowledge: has(env, "inkeep"),
    telephony: has(env, "vapi"),
    hooks: has(env, "vapiSecret") && has(env, "resendSecret"),
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

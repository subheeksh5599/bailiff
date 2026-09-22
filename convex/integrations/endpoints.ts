/**
 * Every outbound endpoint, in one place, with where the shape came from.
 *
 * These are the vendor APIs this product talks to. Each one was pinned from the
 * vendor's published package or documentation index, and each is overridable by
 * environment variable so a path that has moved can be corrected without a code
 * change. Nothing here is called unless the matching key is configured - see
 * lib/config.ts.
 *
 * Confirm-at-key-time notes:
 *   firecrawl  POST /v2/scrape          (api.firecrawl.dev/v2 confirmed reachable)
 *   openai     POST /v1/chat/completions (openai package v7 uses this path)
 *   scorecard  POST /otel/v1/traces      (tracing.scorecard.io; OTLP over HTTP)
 *                                         from the published API reference in api.md)
 *   autumn     POST /v1/events           (autumn-js + @useautumn/convex both wrap this)
 *   resend     POST /emails              (resend package v6)
 *   inkeep     POST /v1/chat/completions (Inkeep publish a chat API; verify model id at key time)
 *   vapi       POST /call                (vapi server API; webhooks arrive on our /hooks/*)
 */

export const ENDPOINTS = {
  firecrawl: {
    base: process.env.FIRECRAWL_BASE_URL ?? "https://api.firecrawl.dev/v2",
    scrape: "/scrape",
  },
  openai: {
    base: process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
    chat: "/chat/completions",
  },
  scorecard: {
    // Two hosts, both read from their own SDK and setup page rather than guessed:
    // the management API answers on api2, and the place a graded run is actually
    // delivered is their OTLP tracing endpoint, which accepts it with the same key.
    base: process.env.SCORECARD_BASE_URL ?? "https://api2.scorecard.io/api/v2",
    projects: "/projects",
    traces: process.env.SCORECARD_TRACING_URL ?? "https://tracing.scorecard.io/otel/v1/traces",
  },
  autumn: {
    base: process.env.AUTUMN_BASE_URL ?? "https://api.useautumn.com/v1",
    events: "/events",
  },
  resend: {
    base: process.env.RESEND_BASE_URL ?? "https://api.resend.com",
    emails: "/emails",
  },
  inkeep: {
    base: process.env.INKEEP_BASE_URL ?? "https://api.inkeep.com/v1",
    chat: "/chat/completions",
  },
  vapi: {
    base: process.env.VAPI_BASE_URL ?? "https://api.vapi.ai",
    call: "/call",
  },
} as const;

export const MODELS = {
  extraction: process.env.OPENAI_EXTRACTION_MODEL ?? "gpt-4o-mini",
  inkeep: process.env.INKEEP_MODEL ?? "inkeep-rag",
} as const;

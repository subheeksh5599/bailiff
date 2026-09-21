import { v } from "convex/values";
import { internalAction, type ActionCtx } from "../_generated/server";
import { ENDPOINTS, MODELS } from "./endpoints";
import { postJson } from "./http";
import { NotConfigured, has, requireKey } from "../lib/config";

/**
 * Adapter: read a transcript into claims.
 *
 * The model is asked for a fixed shape and nothing else: what the caller wanted,
 * what was promised, which statements were presented as fact, and whether the
 * issue was resolved. It is never asked whether those statements are true - that
 * is decided against evidence in rules.ts. This module writes nothing: it returns
 * claims and the orchestrator records them, which is also where the promise/fact
 * distinction gets applied.
 */
export const EXTRACTION_SCHEMA = {
  type: "json_schema",
  json_schema: {
    name: "call_claims",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        caller_wanted: { type: "string" },
        resolved: { type: "boolean" },
        promises: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              text: { type: "string" },
              promised_when: { type: ["string", "null"] },
            },
            required: ["text", "promised_when"],
          },
        },
        facts: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              text: { type: "string" },
              subject: { type: "string" },
            },
            required: ["text", "subject"],
          },
        },
      },
      required: ["caller_wanted", "resolved", "promises", "facts"],
    },
  },
} as const;

export function buildExtractionRequest(transcript: string) {
  return {
    model: MODELS.extraction,
    temperature: 0,
    response_format: EXTRACTION_SCHEMA,
    messages: [
      {
        role: "system",
        content:
          "You read one customer service call transcript and report only what it contains. " +
          "A promise is a commitment about the future. A fact is a statement about something " +
          "that already happened or already exists. Do not judge whether either is true. If the " +
          "transcript is truncated or unintelligible, report the claims you can see and set " +
          "resolved to false.",
      },
      { role: "user", content: transcript.slice(0, 60_000) },
    ],
  };
}

export type Extracted = {
  caller_wanted: string;
  resolved: boolean;
  promises: Array<{ text: string; promised_when: string | null }>;
  facts: Array<{ text: string; subject: string }>;
};

export const extractClaims = internalAction({
  args: { transcript: v.string() },
  handler: async (_ctx: ActionCtx, args): Promise<Extracted> => {
    if (!has(process.env, "openai")) throw new NotConfigured("extraction", "OPENAI_API_KEY");
    const key = requireKey(process.env, "openai", "extraction");

    const response = await postJson<{ choices?: Array<{ message?: { content?: string } }> }>(
      `${ENDPOINTS.openai.base}${ENDPOINTS.openai.chat}`,
      buildExtractionRequest(args.transcript),
      { token: key, timeoutMs: 60_000 }
    );
    if (!response.ok) throw new Error(`extraction failed: ${response.status} ${response.error}`);

    const content = response.data?.choices?.[0]?.message?.content;
    if (!content) throw new Error("extraction returned nothing to read");

    const parsed = JSON.parse(content) as Extracted;
    if (!Array.isArray(parsed.promises) || !Array.isArray(parsed.facts)) {
      throw new Error("extraction returned a shape we do not recognise; nothing is recorded");
    }
    return parsed;
  },
});

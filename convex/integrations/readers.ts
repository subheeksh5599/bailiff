/**
 * Who reads a transcript into claims, and in what order.
 *
 * Reading a call is the only place a model is used, and a model is not a fact about
 * the world: it is a second pass over the same words. That makes the reader
 * replaceable in a way the rest of the pipeline is not, so the reader is a list
 * rather than a constant. A provider that refuses — no key, no quota, an outage, a
 * model id that has moved — is a statement about that provider, not about the call,
 * and it must not end the run while another reader is configured and willing.
 *
 * Two rules keep this honest. The reader is named in the result, so a claim can be
 * traced to the thing that read it rather than to "a model". And a refusal from
 * every reader is reported with each provider's own words, because a run that
 * stopped is a fact worth recording rather than a failure to hide.
 */

import { postJson, type HttpResult } from "./http";
import { KEYS, NotConfigured, has, requireKey, type Env } from "../lib/config";

export type Reader = {
  /** The name this reader is recorded under. */
  name: string;
  base: string;
  /** The key it needs, by the name config.ts knows it by. Never a value. */
  key: keyof typeof KEYS;
  /** Where its model id comes from, so a model that moves is an env change. */
  modelEnv: string;
  defaultModel: string;
  /**
   * Whether it can be trusted with a JSON schema. Providers that speak the OpenAI
   * shape are asked for one; a router is asked for plain JSON and told the keys,
   * because a schema is an extension a router may not carry.
   */
  schema: boolean;
};

/**
 * The readers, in the order they are tried.
 *
 * The event's own stack names the first, so it leads whenever it will answer. The
 * second is the operator's own subscription to a model router: it is not a sponsor
 * and is never claimed as one. It exists so a quota problem on the first is a
 * footnote instead of an outage. Adding a third is a configuration change, which is
 * the reason this is a list at all.
 */
export function readerCatalogue(env: Env): Reader[] {
  return [
    {
      name: "openai",
      base: env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
      key: "openai",
      modelEnv: "OPENAI_EXTRACTION_MODEL",
      defaultModel: "gpt-4o-mini",
      schema: true,
    },
    {
      name: "router",
      base: env.ROUTER_BASE_URL ?? "https://api.commandcode.ai/provider/v1",
      key: "router",
      modelEnv: "ROUTER_MODEL",
      defaultModel: "gpt-5.4-mini",
      schema: false,
    },
  ];
}

/** The readers that hold a key, in order. An empty list is a real answer. */
export function readersReady(env: Env): Reader[] {
  return readerCatalogue(env).filter((reader) => has(env, reader.key));
}

export function modelFor(reader: Reader, env: Env): string {
  return (env[reader.modelEnv] ?? "").trim() || reader.defaultModel;
}

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

const READING_RULES =
  "You read one customer service call transcript and report only what it contains. " +
  "A promise is a commitment about the future. A fact is a statement about something " +
  "that already happened or already exists. Do not judge whether either is true. If the " +
  "transcript is truncated or unintelligible, report the claims you can see and set " +
  "resolved to false.";

export function buildExtractionRequest(
  transcript: string,
  model: string,
  schema = true
): Record<string, unknown> {
  return {
    model,
    temperature: 0,
    ...(schema
      ? { response_format: EXTRACTION_SCHEMA }
      : {
          response_format: { type: "json_object" },
          messages_note: "JSON object with keys caller_wanted, resolved, promises, facts",
        }),
    messages: [
      {
        role: "system" as const,
        content: schema
          ? READING_RULES
          : `${READING_RULES} Answer with a single JSON object with exactly the keys ` +
            `caller_wanted (string), resolved (boolean), promises (array of objects with ` +
            `text and promised_when), and facts (array of objects with text and subject). ` +
            `No prose outside the JSON.`,
      },
      { role: "user" as const, content: transcript.slice(0, 60_000) },
    ],
  };
}

export type Extracted = {
  caller_wanted: string;
  resolved: boolean;
  promises: Array<{ text: string; promised_when: string | null }>;
  facts: Array<{ text: string; subject: string }>;
};

export type ReadOutcome = {
  /** Which reader produced this. Recorded on the case so a claim is traceable. */
  provider: string;
  model: string;
  claims: Extracted;
};

/**
 * The JSON object inside an answer, if there is one.
 *
 * A reader that answers correctly but wraps the object in a code fence, or puts a
 * sentence before it, has still answered: the text is the same text, and discarding
 * it would turn a working reader into a refusal. So the object is looked for in the
 * answer, fenced or bare, and the shape check below still decides whether it counts.
 * Observed in the field: one router model replies with a fenced block every time.
 */
function objectIn(content: string): unknown | null {
  const text = content.trim();
  const candidates = [text];
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) candidates.push(fenced[1].trim());
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first >= 0 && last > first) candidates.push(text.slice(first, last + 1));

  for (const candidate of candidates) {
    try {
      const value = JSON.parse(candidate);
      if (value && typeof value === "object") return value;
    } catch {
      // try the next reading of the same answer
    }
  }
  return null;
}

/** Nothing a reader says counts until it has the shape the rest of the pipeline reads. */
export function parseExtracted(content: string): Extracted | null {
  const parsed = objectIn(content);
  if (!parsed) return null;
  if (!parsed || typeof parsed !== "object") return null;
  const value = parsed as Partial<Extracted>;
  if (!Array.isArray(value.promises) || !Array.isArray(value.facts)) return null;
  if (typeof value.caller_wanted !== "string" || typeof value.resolved !== "boolean") return null;
  return {
    caller_wanted: value.caller_wanted,
    resolved: value.resolved,
    promises: value.promises.map((p) => ({
      text: String(p?.text ?? ""),
      promised_when: p?.promised_when == null ? null : String(p.promised_when),
    })),
    facts: value.facts.map((f) => ({ text: String(f?.text ?? ""), subject: String(f?.subject ?? "") })),
  };
}

/**
 * Try each configured reader until one answers with something we can parse.
 *
 * `post` is injected so ordering, fall-through and the reporting can be tested
 * against refusals a real provider will not produce on demand.
 */
export async function readWithReaders(
  env: Env,
  transcript: string,
  post: typeof postJson = postJson
): Promise<ReadOutcome> {
  const ready = readersReady(env);
  if (ready.length === 0) throw new NotConfigured("extraction", KEYS.openai);

  const refusals: string[] = [];
  for (const reader of ready) {
    const model = modelFor(reader, env);
    let response: HttpResult<{ choices?: Array<{ message?: { content?: string } }> }>;
    try {
      response = await post<{ choices?: Array<{ message?: { content?: string } }> }>(
        `${reader.base}/chat/completions`,
        buildExtractionRequest(transcript, model, reader.schema),
        { token: requireKey(env, reader.key, "extraction"), timeoutMs: 60_000 }
      );
    } catch (error) {
      refusals.push(`${reader.name}: ${error instanceof Error ? error.message : "unreachable"}`);
      continue;
    }

    if (!response.ok) {
      refusals.push(`${reader.name}: ${response.status} ${response.error}`);
      continue;
    }

    const content = response.data?.choices?.[0]?.message?.content;
    if (!content) {
      refusals.push(`${reader.name}: answered with nothing to read`);
      continue;
    }

    const claims = parseExtracted(content);
    if (!claims) {
      refusals.push(`${reader.name}: answered with a shape we do not recognise, so nothing is recorded`);
      continue;
    }
    return { provider: reader.name, model, claims };
  }

  throw new Error(`every reader refused: ${refusals.join(" | ")}`);
}

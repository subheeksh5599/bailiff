import { describe, expect, it } from "vitest";
import {
  EXTRACTION_SCHEMA,
  buildExtractionRequest,
  modelFor,
  parseExtracted,
  readerCatalogue,
  readersReady,
  readWithReaders,
} from "../convex/integrations/readers";
import type { postJson } from "../convex/integrations/http";

/**
 * Who reads a transcript, and what happens when they will not.
 *
 * The reader sits between a vendor's availability and money being decided, so the
 * parts worth pinning are the ones a live deployment taught: a provider that
 * refuses must not end the run while another reader is configured, a reader that
 * answers with something unreadable is a refusal rather than data, the reader that
 * answered is recorded, and a run where everything refused says so with each
 * provider's own words.
 */

const GOOD = JSON.stringify({
  caller_wanted: "a refund of the delivery fee",
  resolved: false,
  promises: [{ text: "we will refund the fee", promised_when: "3 working days" }],
  facts: [{ text: "the parcel was returned", subject: "the parcel" }],
});

type Call = { url: string; body: Record<string, unknown>; token?: string };

/** A post that answers from a queue, and records what it was asked. */
function fakePost(answers: Array<{ status: number; body?: unknown; error?: string; throws?: string }>) {
  const calls: Call[] = [];
  const post = (async (url: string, body: unknown, opts: { token?: string }) => {
    calls.push({ url, body: body as Record<string, unknown>, token: opts?.token });
    const answer = answers.shift() ?? { status: 500, error: "ran out of answers" };
    if (answer.throws) throw new Error(answer.throws);
    if (answer.status >= 400) return { ok: false as const, status: answer.status, error: answer.error ?? "refused" };
    return { ok: true as const, status: answer.status, data: answer.body };
  }) as unknown as typeof postJson;
  return { post, calls };
}

const both = { OPENAI_API_KEY: "k-openai", ROUTER_API_KEY: "k-router" };
const onlyRouter = { ROUTER_API_KEY: "k-router" };

describe("which readers are ready", () => {
  it("is empty when no reader holds a key", () => {
    expect(readersReady({})).toEqual([]);
    expect(readersReady({ OPENAI_API_KEY: "   " })).toEqual([]);
  });

  it("keeps the order, with the event's own stack first", () => {
    expect(readersReady(both).map((r) => r.name)).toEqual(["openai", "router"]);
    expect(readersReady(onlyRouter).map((r) => r.name)).toEqual(["router"]);
  });

  it("reads a model id from the environment so a moved model is not a code change", () => {
    const [openai] = readerCatalogue({});
    expect(modelFor(openai, {})).toBe(openai.defaultModel);
    expect(modelFor(openai, { OPENAI_EXTRACTION_MODEL: "gpt-elsewhere" })).toBe("gpt-elsewhere");
  });
});

describe("a reader that refuses", () => {
  it("falls through to the one behind it, and names who answered", async () => {
    const { post, calls } = fakePost([
      { status: 402, error: "insufficient_quota" },
      { status: 200, body: { choices: [{ message: { content: GOOD } }] } },
    ]);

    const outcome = await readWithReaders(both, "agent: your refund was issued", post);

    expect(outcome.provider).toBe("router");
    expect(outcome.claims.promises[0].text).toBe("we will refund the fee");
    expect(calls).toHaveLength(2);
    expect(calls[0].url).toContain("api.openai.com");
    expect(calls[1].url).toContain("commandcode");
    expect(calls[1].token).toBe("k-router");
  });

  it("does not reach past the first reader when the first one answers", async () => {
    const { post, calls } = fakePost([{ status: 200, body: { choices: [{ message: { content: GOOD } }] } }]);
    const outcome = await readWithReaders(both, "transcript", post);
    expect(outcome.provider).toBe("openai");
    expect(calls).toHaveLength(1);
  });

  it("treats an unreadable answer as a refusal rather than as data", async () => {
    const { post } = fakePost([
      { status: 200, body: { choices: [{ message: { content: "I'm sorry, I can't help with that." } }] } },
      { status: 200, body: { choices: [{ message: { content: JSON.stringify({ hello: "world" }) } }] } },
    ]);
    await expect(readWithReaders(both, "transcript", post)).rejects.toThrow(/every reader refused/);
  });

  it("reports every provider's own words when they all refuse", async () => {
    const { post } = fakePost([
      { status: 402, error: "insufficient_quota" },
      { status: 500, error: "upstream is unwell" },
    ]);
    await expect(readWithReaders(both, "transcript", post)).rejects.toThrow(
      /openai: 402 insufficient_quota \| router: 500 upstream is unwell/
    );
  });

  it("counts a thrown request as a refusal and keeps going", async () => {
    const { post } = fakePost([
      { status: 0, throws: "fetch failed" },
      { status: 200, body: { choices: [{ message: { content: GOOD } }] } },
    ]);
    const outcome = await readWithReaders(both, "transcript", post);
    expect(outcome.provider).toBe("router");
  });

  it("says nothing is configured when neither reader has a key", async () => {
    const { post, calls } = fakePost([]);
    await expect(readWithReaders({}, "transcript", post)).rejects.toThrow(/not configured/);
    expect(calls).toHaveLength(0);
  });
});

describe("the request each reader is sent", () => {
  it("asks a provider that speaks the schema shape for the schema", async () => {
    const { post, calls } = fakePost([{ status: 200, body: { choices: [{ message: { content: GOOD } }] } }]);
    await readWithReaders(onlyRouter, "transcript", post);
    const [routerCall] = calls;
    expect(routerCall.body.response_format).toEqual({ type: "json_object" });
    expect(String((routerCall.body.messages as Array<{ content: string }>)[0].content)).toMatch(/caller_wanted/);
  });

  it("keeps the pinned schema on the module's own builder", () => {
    const request = buildExtractionRequest("transcript", "gpt-4o-mini", true);
    expect(request.response_format).toBe(EXTRACTION_SCHEMA);
    expect(JSON.stringify(EXTRACTION_SCHEMA)).not.toMatch(/verdict|is_true|guilty/);
  });
});

describe("parsing what came back", () => {
  it("accepts the shape the pipeline reads", () => {
    const parsed = parseExtracted(GOOD);
    expect(parsed?.caller_wanted).toBe("a refund of the delivery fee");
    expect(parsed?.promises).toHaveLength(1);
  });

  it("refuses a shape with pieces missing, rather than half-using it", () => {
    expect(parseExtracted(JSON.stringify({ caller_wanted: "x", resolved: true }))).toBeNull();
    expect(parseExtracted("not json at all")).toBeNull();
    expect(parseExtracted("")).toBeNull();
  });

  it("reads an answer wrapped in a code fence, because that is still the answer", () => {
    // Observed live: one router model replies with a fenced block every single time.
    const fenced = "```json\n" + GOOD + "\n```";
    expect(parseExtracted(fenced)?.caller_wanted).toBe("a refund of the delivery fee");
  });

  it("ignores a sentence before the object, and refuses when there is no object", () => {
    expect(parseExtracted("Sure, here it is: " + GOOD)?.resolved).toBe(false);
    expect(parseExtracted("I cannot help with that request.")).toBeNull();
    expect(parseExtracted("```json\n{ not json }\n```")).toBeNull();
  });

  it("keeps a missing promised date as null instead of inventing one", () => {
    const parsed = parseExtracted(
      JSON.stringify({
        caller_wanted: "x",
        resolved: false,
        promises: [{ text: "we will call back" }],
        facts: [{ text: "the ticket was closed" }],
      })
    );
    expect(parsed?.promises[0].promised_when).toBeNull();
    // A fact with no subject is stored with an empty one, never with the word "undefined".
    expect(parsed?.facts[0].subject).toBe("");
  });
});

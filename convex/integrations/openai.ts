import { v } from "convex/values";
import { internalAction, type ActionCtx } from "../_generated/server";
import { MODELS } from "./endpoints";
import { readWithReaders, EXTRACTION_SCHEMA, buildExtractionRequest as build, type Extracted } from "./readers";

/**
 * The action the pipeline calls to read a transcript.
 *
 * It is a thin wrapper now: the readers, their order and the request shape live in
 * ./readers.ts, and this exposes one entry point plus the test-visible builders so
 * the shape stays pinned without the chain being duplicated.
 */
export { EXTRACTION_SCHEMA };

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
export function buildExtractionRequest(transcript: string, model = MODELS.extraction, schema = true) {
  return build(transcript, model, schema);
}

export type { Extracted };

export const extractClaims = internalAction({
  args: { transcript: v.string() },
  handler: async (_ctx: ActionCtx, args): Promise<Extracted & { read_by: string }> => {
    const outcome = await readWithReaders(process.env, args.transcript);
    return { ...outcome.claims, read_by: outcome.provider };
  },
});

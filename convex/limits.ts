/**
 * The limiter, as the hooks reach it.
 *
 * A hook runs in an HTTP action, which has no database handle of its own, so the
 * check happens in an internal mutation. That also means a refusal is transactional:
 * the allowance is only spent if the call the hook makes afterwards is not itself
 * rolled back with it.
 */

import { internalMutation, query } from "./_generated/server";
import { v } from "convex/values";
import { POLICIES, policyTable, rateLimiter, type LimitName } from "./lib/limits";
import { requireOperator } from "./lib/session";

const limitName = v.union(v.literal("hookAll"), v.literal("hookPerCase"), v.literal("operatorAction"));

export const consume = internalMutation({
  args: { name: limitName, key: v.string() },
  handler: async (ctx, args): Promise<{ ok: boolean; retryAfter: number | null; limit: string }> => {
    const status = await rateLimiter.limit(ctx, args.name as LimitName, {
      key: args.key,
      throws: false,
    });
    return {
      ok: status.ok,
      retryAfter: status.retryAfter ?? null,
      limit: args.name,
    };
  },
});

/** What the ceilings are, for an operator looking at the board. */
export const ceilings = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireOperator(ctx, args.token);
    return {
      table: policyTable(),
      policies: Object.keys(POLICIES) as string[],
    };
  },
});

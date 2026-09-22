/**
 * Operator sessions.
 *
 * The board used to be open: anyone who found the deployment could close a case or
 * move a charge. The JSON routes stay public on purpose - they are how a skeptic
 * checks the product - but the actions that change a case, spend a call, or take a
 * file now require a session.
 *
 * The model is deliberately small and first-party: a passphrase is compared against its
 * own hash - one the operator set from the browser, or one the deployment was given in
 * its environment - and a random token is issued. Only
 * the token's hash is stored, so a copy of the database is not a set of live session
 * tokens, and sessions expire on their own.
 */

import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { sha256Hex } from "./hash";
import { operatorState } from "./operator";

/** A working day, so a forgotten tab is not a permanent key. */
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

export function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function tokenHash(token: string): Promise<string> {
  return await sha256Hex(token);
}

export function expired(session: { expiresAt: number }, now = Date.now()): boolean {
  return session.expiresAt <= now;
}

export type OperatorSession = Doc<"operatorSessions">;

/**
 * The gate itself. Every refusal names what is wrong rather than pretending the
 * caller is unauthorised in general, and an unconfigured deployment refuses
 * everyone rather than letting everyone through.
 */
export async function requireOperator(
  ctx: QueryCtx | MutationCtx,
  token: string | undefined
): Promise<OperatorSession> {
  const state = await operatorState(ctx);
  if (!state.configured) {
    throw new Error("refused: this deployment has no operator passphrase yet — claim it from the board");
  }
  if (!token || token.trim().length < 32) {
    throw new Error("refused: an operator session is required for this action");
  }
  const hashed = await tokenHash(token);
  const row = await ctx.db
    .query("operatorSessions")
    .withIndex("by_token", (q) => q.eq("tokenHash", hashed))
    .first();
  if (!row) throw new Error("refused: that session is not one this deployment issued");
  if (expired(row)) throw new Error("refused: that session has expired");
  return row;
}

/** True when the caller holds a live session, without throwing. */
export async function isOperator(
  ctx: QueryCtx | MutationCtx,
  token: string | undefined
): Promise<boolean> {
  try {
    await requireOperator(ctx, token);
    return true;
  } catch {
    return false;
  }
}

/**
 * Who may act, and how that is decided.
 *
 * Two ways in, and the order between them matters:
 *
 *   1. a passphrase the operator set from the browser, stored as a hash in the database;
 *   2. a passphrase hash in the deployment's environment, for setting one up from a shell.
 *
 * The database wins when both exist, because that is the one the operator chose most
 * recently and can change without a deploy.
 *
 * A deployment with neither is *claimable*: the first person to open the board can set
 * the passphrase. That is the only moment the board is open, and it is deliberate — a
 * self-hosted deployment should be set up from its own website, not from a terminal.
 */

import type { MutationCtx, QueryCtx } from "../_generated/server";
import { sha256Hex } from "./hash";

export type OperatorState =
  | { configured: true; claimable: false; source: "browser" | "environment" }
  | { configured: false; claimable: true; source: null };

export function environmentHash(): string | null {
  const value = process.env.OPERATOR_PASSPHRASE_HASH;
  return value && value.trim().length === 64 ? value.trim().toLowerCase() : null;
}

/** The hash this deployment expects, from the database or the environment. */
export async function expectedHash(
  ctx: QueryCtx | MutationCtx
): Promise<{ hash: string; source: "browser" | "environment" } | null> {
  const settings = await ctx.db.query("operatorSettings").first();
  if (settings) return { hash: settings.passphraseHash, source: "browser" };
  const fromEnv = environmentHash();
  if (fromEnv) return { hash: fromEnv, source: "environment" };
  return null;
}

export async function operatorState(ctx: QueryCtx | MutationCtx): Promise<OperatorState> {
  const expected = await expectedHash(ctx);
  if (!expected) return { configured: false, claimable: true, source: null };
  return { configured: true, claimable: false, source: expected.source };
}

/** Does this passphrase match what the deployment expects? */
export async function passphraseMatches(
  ctx: QueryCtx | MutationCtx,
  passphrase: string
): Promise<boolean> {
  const expected = await expectedHash(ctx);
  if (!expected) return false;
  const offered = await sha256Hex(passphrase);
  return offered.length === expected.hash.length && offered === expected.hash;
}

export async function hashOf(passphrase: string): Promise<string> {
  return await sha256Hex(passphrase);
}

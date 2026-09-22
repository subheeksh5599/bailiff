/**
 * Signing in to the board.
 *
 * There is one operator, and the deployment holds the hash of their passphrase. This
 * is not a user directory and does not pretend to be: it is the smallest thing that
 * makes the board a private surface instead of a public one, with sessions that
 * expire and tokens that are stored only as hashes.
 */

import { internalQuery, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import {
  SESSION_TTL_MS,
  configuredPassphraseHash,
  expired,
  randomToken,
  requireOperator,
  tokenHash,
} from "./lib/session";
import { sha256Hex } from "./lib/hash";

/**
 * The same gate, reachable from an action. An action has no database handle of its
 * own, so it asks this instead of checking a session itself.
 */
export const requireSession = internalQuery({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, args): Promise<{ ok: true }> => {
    await requireOperator(ctx, args.token);
    return { ok: true };
  },
});

export const signIn = mutation({
  args: { passphrase: v.string(), label: v.optional(v.string()) },
  handler: async (ctx, args): Promise<{ token: string; expiresAt: number }> => {
    const expected = configuredPassphraseHash();
    if (!expected) {
      throw new Error("refused: this deployment has no operator passphrase configured");
    }
    const offered = await sha256Hex(args.passphrase);
    // Constant-time-ish: compare the hashes, never the passphrases.
    if (offered.length !== expected.length || offered !== expected) {
      throw new Error("refused: that passphrase is not the one this deployment expects");
    }

    const token = randomToken();
    const now = Date.now();
    const expiresAt = now + SESSION_TTL_MS;
    await ctx.db.insert("operatorSessions", {
      tokenHash: await tokenHash(token),
      label: args.label?.slice(0, 60),
      createdAt: now,
      expiresAt,
    });
    return { token, expiresAt };
  },
});

export const signOut = mutation({
  args: { token: v.string() },
  handler: async (ctx, args): Promise<{ signedOut: boolean }> => {
    const hashed = await tokenHash(args.token);
    const session = await ctx.db
      .query("operatorSessions")
      .withIndex("by_token", (q) => q.eq("tokenHash", hashed))
      .first();
    if (!session) return { signedOut: false };
    await ctx.db.delete(session._id);
    return { signedOut: true };
  },
});

/** Whether this token is a live session. The token itself is never returned. */
export const current = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (!args.token) return { signedIn: false, expiresAt: null, label: null };
    const hashed = await tokenHash(args.token);
    const session = await ctx.db
      .query("operatorSessions")
      .withIndex("by_token", (q) => q.eq("tokenHash", hashed))
      .first();
    if (!session || expired(session)) {
      return { signedIn: false, expiresAt: session?.expiresAt ?? null, label: null };
    }
    return { signedIn: true, expiresAt: session.expiresAt, label: session.label ?? null };
  },
});

/** Every live session, for an operator who wants to see and end them. */
export const sessions = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireOperator(ctx, args.token);
    const rows = await ctx.db.query("operatorSessions").collect();
    const now = Date.now();
    return rows
      .filter((r) => !expired(r, now))
      .map((r) => ({
        _id: r._id,
        label: r.label ?? null,
        createdAt: r.createdAt,
        expiresAt: r.expiresAt,
      }))
      .sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const endSession = mutation({
  args: { token: v.string(), sessionId: v.id("operatorSessions") },
  handler: async (ctx, args) => {
    await requireOperator(ctx, args.token);
    await ctx.db.delete(args.sessionId);
    return { ended: true };
  },
});

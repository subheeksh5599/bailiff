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
  expired,
  randomToken,
  requireOperator,
  tokenHash,
} from "./lib/session";
import { hashOf, operatorState, passphraseMatches } from "./lib/operator";

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
    const state = await operatorState(ctx);
    if (!state.configured) {
      throw new Error("refused: this deployment has no operator passphrase yet — claim it from the board");
    }
    // Compare hashes, never passphrases.
    if (!(await passphraseMatches(ctx, args.passphrase))) {
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

/**
 * What this deployment expects before anyone signs in.
 *
 * `claimable` is true only when no passphrase exists at all - neither the one an
 * operator set here nor one the deployment was given in its environment. That is the
 * one moment the board is open, and it is how a deployment is set up from its own
 * website rather than from a terminal.
 */
export const state = query({
  args: {},
  handler: async (ctx) => {
    const current = await operatorState(ctx);
    return {
      configured: current.configured,
      claimable: current.claimable,
      source: current.source,
    };
  },
});

/**
 * Claim the deployment: set the operator passphrase from the browser.
 *
 * Allowed only while nothing is configured, so it cannot be used to take a board that
 * already has an operator. The passphrase is hashed before it is written, and the
 * caller is signed in as the operator they just became.
 */
export const claim = mutation({
  args: { passphrase: v.string(), label: v.optional(v.string()) },
  handler: async (ctx, args): Promise<{ token: string; expiresAt: number }> => {
    const current = await operatorState(ctx);
    if (!current.claimable) {
      throw new Error(
        "refused: this deployment already has an operator passphrase, so it cannot be claimed again"
      );
    }
    if (args.passphrase.trim().length < 8) {
      throw new Error("refused: a passphrase under eight characters is not worth having");
    }

    const now = Date.now();
    await ctx.db.insert("operatorSettings", {
      passphraseHash: await hashOf(args.passphrase),
      updatedAt: now,
      setFrom: "browser",
    });

    const token = randomToken();
    const expiresAt = now + SESSION_TTL_MS;
    await ctx.db.insert("operatorSessions", {
      tokenHash: await tokenHash(token),
      label: args.label?.slice(0, 60) ?? "claimed from the board",
      createdAt: now,
      expiresAt,
    });
    return { token, expiresAt };
  },
});

/** Change the passphrase from the board. Requires a session and the current passphrase. */
export const changePassphrase = mutation({
  args: { token: v.optional(v.string()), current: v.string(), next: v.string() },
  handler: async (ctx, args): Promise<{ changed: true; otherSessionsEnded: number }> => {
    const session = await requireOperator(ctx, args.token);
    if (!(await passphraseMatches(ctx, args.current))) {
      throw new Error("refused: that is not the current passphrase");
    }
    if (args.next.trim().length < 8) {
      throw new Error("refused: a passphrase under eight characters is not worth having");
    }

    const settings = await ctx.db.query("operatorSettings").first();
    const now = Date.now();
    if (settings) {
      await ctx.db.patch(settings._id, { passphraseHash: await hashOf(args.next), updatedAt: now });
    } else {
      // The deployment was configured from its environment; the browser now takes over.
      await ctx.db.insert("operatorSettings", {
        passphraseHash: await hashOf(args.next),
        updatedAt: now,
        setFrom: "browser",
      });
    }

    // Every other session ends: a passphrase change is also a revocation.
    const all = await ctx.db.query("operatorSessions").collect();
    let ended = 0;
    for (const row of all) {
      if (row._id !== session._id) {
        await ctx.db.delete(row._id);
        ended += 1;
      }
    }
    return { changed: true, otherSessionsEnded: ended };
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

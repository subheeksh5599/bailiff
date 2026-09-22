import { v } from "convex/values";
import { query } from "./_generated/server";
import { summarise, type Insights } from "./lib/metrics";

/**
 * What the operator actually wants to know, computed from the board's own rows.
 *
 * The question the product exists to answer is not "how many cases are there" but
 * "is this working, and where is it stuck". So the numbers here are about
 * outcomes: how long a case takes to close, how many were given up on and why,
 * how much chasing it took, and which counterparties keep coming back.
 */
export const overview = query({
  args: {},
  handler: async (ctx): Promise<Insights & { refusalReasons: Array<{ reason: string; count: number }> }> => {
    const cases = await ctx.db.query("cases").collect();
    const insights = summarise(
      cases.map((row) => ({
        state: row.state,
        openedAt: row.openedAt,
        ...(row.verifiedAt !== undefined ? { verifiedAt: row.verifiedAt } : {}),
        ...(row.chaseCount !== undefined ? { chaseCount: row.chaseCount } : {}),
        counterparty: row.counterpartyName,
      }))
    );

    // Why cases are being refused, ranked: the reasons are stored on the audit
    // rows the refusal writes, so this is the product's own words rather than a
    // second taxonomy invented for a dashboard.
    const refusals = await ctx.db.query("audit").collect();
    const counted = new Map<string, number>();
    for (const row of refusals) {
      if (row.action !== "close.refused" || !row.detail) continue;
      for (const part of row.detail.split(";")) {
        const reason = part.split(":").slice(1).join(":").trim();
        if (!reason) continue;
        counted.set(reason, (counted.get(reason) ?? 0) + 1);
      }
    }

    return {
      ...insights,
      refusalReasons: [...counted.entries()]
        .map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
    };
  },
});

/**
 * What the board's numbers mean.
 *
 * Pure functions over the rows the board already reads, so the arithmetic can be
 * tested without a deployment and the same numbers appear wherever they are
 * asked for. Anything that cannot be computed from what is there returns null
 * rather than a zero that reads like an answer.
 */

export type CaseLike = {
  state: string;
  openedAt: number;
  verifiedAt?: number;
  chaseCount?: number;
  counterparty: string;
};

export type Insights = {
  total: number;
  byState: Record<string, number>;
  verified: number;
  abandoned: number;
  open: number;
  medianHoursToClosure: number | null;
  chases: { cases: number; total: number };
  counterparties: Array<{ name: string; cases: number }>;
};

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const value =
    sorted.length % 2 === 0 ? (sorted[middle - 1]! + sorted[middle]!) / 2 : sorted[middle]!;
  return value;
}

export function summarise(cases: CaseLike[]): Insights {
  const byState: Record<string, number> = {};
  for (const row of cases) byState[row.state] = (byState[row.state] ?? 0) + 1;

  const closed = cases.filter((row) => row.state === "VERIFIED" && row.verifiedAt);
  const hours = closed.map((row) => (row.verifiedAt! - row.openedAt) / 3_600_000);

  const chased = cases.filter((row) => (row.chaseCount ?? 0) > 0);
  const counts = new Map<string, number>();
  for (const row of cases) counts.set(row.counterparty, (counts.get(row.counterparty) ?? 0) + 1);

  return {
    total: cases.length,
    byState,
    verified: closed.length,
    abandoned: byState.ABANDONED ?? 0,
    open: cases.length - closed.length - (byState.ABANDONED ?? 0),
    medianHoursToClosure: median(hours),
    chases: {
      cases: chased.length,
      total: chased.reduce((sum, row) => sum + (row.chaseCount ?? 0), 0),
    },
    counterparties: [...counts.entries()]
      .map(([name, count]) => ({ name, cases: count }))
      .sort((a, b) => b.cases - a.cases)
      .slice(0, 5),
  };
}

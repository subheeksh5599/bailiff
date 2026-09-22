/**
 * How long a case waits before it is chased, and when chasing stops.
 *
 * The product opens on the problem that a chase has no end condition: it stops
 * either because the money moved or because somebody gives up. So the cadence is
 * finite and written down here rather than left to whoever remembers: a case is
 * chased at a fixed interval, a fixed number of times, and then abandoned with
 * the reason recorded. An open case that nothing is doing about is a lie the
 * board would otherwise keep telling.
 *
 * The rules are pure so they can be read and tested without a clock.
 */

export const CHASE_INTERVAL_MS = 48 * 60 * 60 * 1000;
export const MAX_CHASES = 3;

export type ChaseDecision = { due: boolean; abandon: boolean; reason: string };

export function chaseDue(input: {
  frozenAt: number;
  chasedAt?: number | undefined;
  chaseCount: number;
  now: number;
}): ChaseDecision {
  if (input.chaseCount >= MAX_CHASES) {
    return {
      due: false,
      abandon: true,
      reason: `${MAX_CHASES} chases have gone unanswered`,
    };
  }

  const anchor = input.chasedAt ?? input.frozenAt;
  const waited = input.now - anchor;
  if (waited < CHASE_INTERVAL_MS) {
    const hours = Math.max(1, Math.ceil((CHASE_INTERVAL_MS - waited) / 3_600_000));
    return { due: false, abandon: false, reason: `next chase in about ${hours}h` };
  }

  return {
    due: true,
    abandon: false,
    reason:
      input.chasedAt === undefined
        ? "the interval since the requirements were frozen has passed"
        : "the interval since the last chase has passed",
  };
}

/** Chase N of the maximum, in words a reader sees in the message and the audit. */
export function chaseNumber(chaseCount: number): string {
  return `chase ${Math.min(chaseCount + 1, MAX_CHASES)} of ${MAX_CHASES}`;
}

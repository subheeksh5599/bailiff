/**
 * The states a case can be in, and which moves are legal.
 *
 * A case is not a ticket queue. It is an argument about whether something that
 * was promised actually happened, so the states are chosen around that claim:
 * nothing may reach VERIFIED except through the verifier, and nothing may leave
 * VERIFIED except through a contradiction found later.
 */

export const STATES = [
  "INTAKE",
  "REQUIREMENTS_FROZEN",
  "CHASING",
  "READBACK_PENDING",
  "VERIFIED",
  "DISPUTED",
  "ABANDONED",
] as const;

export type CaseState = (typeof STATES)[number];

/** Ordered rank, used only for display and for reasoning about progress. */
export const RANK: Record<CaseState, number> = {
  INTAKE: 0,
  REQUIREMENTS_FROZEN: 1,
  CHASING: 2,
  READBACK_PENDING: 3,
  VERIFIED: 4,
  DISPUTED: 4,
  ABANDONED: 9,
};

export const TERMINAL: readonly CaseState[] = ["ABANDONED"];
export const SUSPENDED: readonly CaseState[] = ["ABANDONED"];

/** Moves that are always legal, independent of guards. */
const BASE_TRANSITIONS: ReadonlyArray<readonly [CaseState, CaseState]> = [
  ["INTAKE", "REQUIREMENTS_FROZEN"],
  ["REQUIREMENTS_FROZEN", "CHASING"],
  ["CHASING", "READBACK_PENDING"],
  ["READBACK_PENDING", "CHASING"],
  ["READBACK_PENDING", "VERIFIED"],
  // Anything that has not settled can be given up on. Without this a case whose
  // requirements will never be read back could only sit open forever, which is the
  // failure this whole product is about.
  ["REQUIREMENTS_FROZEN", "ABANDONED"],
  ["CHASING", "ABANDONED"],
  ["READBACK_PENDING", "ABANDONED"],
  ["VERIFIED", "DISPUTED"],
  ["DISPUTED", "CHASING"],
];

const LEGAL = new Set(BASE_TRANSITIONS.map(([a, b]) => `${a}->${b}`));

/**
 * Transitions that additionally require a guard to have been evaluated by the
 * caller. `checkTransition` answers legality only; the mutation that performs
 * the move must still prove the guard.
 */
export const GUARDED: ReadonlyArray<readonly [CaseState, CaseState]> = [
  ["READBACK_PENDING", "VERIFIED"],
  ["VERIFIED", "DISPUTED"],
];

export type TransitionResult =
  | { ok: true }
  | { ok: false; reason: string };

export function isState(value: string): value is CaseState {
  return (STATES as readonly string[]).includes(value);
}

export function checkTransition(from: string, to: string): TransitionResult {
  if (!isState(from)) return { ok: false, reason: `unknown state ${from}` };
  if (!isState(to)) return { ok: false, reason: `unknown state ${to}` };
  if (from === to) return { ok: false, reason: "no-op transition" };
  if (TERMINAL.includes(from)) {
    return { ok: false, reason: `${from} is terminal` };
  }
  if (to === "VERIFIED" && from !== "READBACK_PENDING") {
    return {
      ok: false,
      reason: `VERIFIED may only be entered from READBACK_PENDING, not ${from}`,
    };
  }
  if (!LEGAL.has(`${from}->${to}`)) {
    return { ok: false, reason: `illegal transition ${from} -> ${to}` };
  }
  return { ok: true };
}

/** True when the move additionally requires an evaluated guard. */
export function requiresGuard(from: string, to: string): boolean {
  return GUARDED.some(([a, b]) => a === from && b === to);
}

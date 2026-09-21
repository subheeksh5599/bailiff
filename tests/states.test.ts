import { describe, expect, it } from "vitest";
import {
  checkTransition,
  isState,
  requiresGuard,
  RANK,
  STATES,
  type CaseState,
} from "../convex/lib/states";

describe("legal forward transitions", () => {
  const legal: Array<[CaseState, CaseState]> = [
    ["INTAKE", "REQUIREMENTS_FROZEN"],
    ["REQUIREMENTS_FROZEN", "CHASING"],
    ["CHASING", "READBACK_PENDING"],
    ["READBACK_PENDING", "CHASING"],
    ["READBACK_PENDING", "VERIFIED"],
    ["CHASING", "ABANDONED"],
    ["READBACK_PENDING", "ABANDONED"],
    ["VERIFIED", "DISPUTED"],
    ["DISPUTED", "CHASING"],
  ];

  for (const [from, to] of legal) {
    it(`${from} -> ${to}`, () => {
      expect(checkTransition(from, to).ok).toBe(true);
    });
  }
});

describe("closed is only reachable with the read-back in hand", () => {
  it("refuses VERIFIED from INTAKE, REQUIREMENTS_FROZEN and CHASING", () => {
    for (const from of ["INTAKE", "REQUIREMENTS_FROZEN", "CHASING"] as CaseState[]) {
      const result = checkTransition(from, "VERIFIED");
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toMatch(/READBACK_PENDING|illegal/);
    }
  });

  it("marks the guarded moves", () => {
    expect(requiresGuard("READBACK_PENDING", "VERIFIED")).toBe(true);
    expect(requiresGuard("VERIFIED", "DISPUTED")).toBe(true);
    expect(requiresGuard("INTAKE", "REQUIREMENTS_FROZEN")).toBe(false);
  });
});

describe("terminal and malformed input", () => {
  it("nothing leaves ABANDONED", () => {
    for (const to of STATES) {
      if (to === "ABANDONED") continue;
      expect(checkTransition("ABANDONED", to).ok).toBe(false);
    }
  });

  it("refuses a no-op and an unknown state", () => {
    expect(checkTransition("CHASING", "CHASING").ok).toBe(false);
    expect(checkTransition("CHASING", "CLOSED").ok).toBe(false);
    expect(checkTransition("OPEN", "CHASING").ok).toBe(false);
    expect(isState("CHASING")).toBe(true);
    expect(isState("closed")).toBe(false);
  });

  it("cannot go backwards past intake", () => {
    expect(checkTransition("REQUIREMENTS_FROZEN", "INTAKE").ok).toBe(false);
    expect(checkTransition("CHASING", "REQUIREMENTS_FROZEN").ok).toBe(false);
  });

  it("keeps VERIFIED and DISPUTED at the same rank so neither reads as progress", () => {
    expect(RANK.VERIFIED).toBe(RANK.DISPUTED);
  });
});

/**
 * The invariants, as pure functions so they can be tested without a database.
 *
 * Three rules carry the whole product:
 *   1. A requirement is only satisfied by evidence that was read back after the
 *      case opened, from the counterparty or from the customer's own record.
 *   2. A claim is verified only if such evidence backs it; otherwise it is
 *      unverifiable, and unverifiable is not a soft failure - it bills nothing.
 *   3. A case may only be called VERIFIED when every frozen requirement is
 *      satisfied. Anything else stays open.
 */

export type EvidenceKind =
  | "page_fetch"
  | "email_reply"
  | "call_transcript"
  | "portal_read"
  | "payment_record";

export type Evidence = {
  _id?: string;
  kind: string;
  sourceKind: string;
  source: string;
  fetchedAt: number;
  value?: string;
  valueUnits?: number;
  excerpt: string;
};

export type Requirement = {
  key: string;
  label: string;
  kind: string;
  satisfied: boolean;
  satisfiedByEvidenceId?: string;
};

export type GradeCheck = { name: string; passed: boolean; detail: string };
export type Verdict = "verified" | "unverifiable" | "contradicted";
export type GradeVerdict = "pass" | "fail" | "unverified";

/** Evidence must have been read after the case opened, or it describes a world that has moved. */
export function isFresh(evidenceFetchedAt: number, caseOpenedAt: number): boolean {
  return evidenceFetchedAt >= caseOpenedAt;
}

/** Evidence that the counterparty itself published, or that the customer read back from them. */
export function isAuthoritative(sourceKind: string): boolean {
  return sourceKind === "counterparty" || sourceKind === "own_record";
}

export function requirementMatchedBy(
  requirement: Pick<Requirement, "kind">,
  evidence: Pick<Evidence, "kind" | "sourceKind" | "fetchedAt">,
  caseOpenedAt: number
): boolean {
  if (requirement.kind !== evidence.kind) return false;
  if (!isFresh(evidence.fetchedAt, caseOpenedAt)) return false;
  // A third party's page may corroborate a requirement but can never satisfy it:
  // otherwise a forum post could close a case about someone else's money.
  return isAuthoritative(evidence.sourceKind);
}

export type CaseEvaluation = {
  ok: boolean;
  unsatisfied: Array<{ key: string; label: string; reason: string }>;
  satisfiedBy: Record<string, string>;
};

export function evaluateCase(
  caseOpenedAt: number,
  requirements: Requirement[],
  evidence: Evidence[]
): CaseEvaluation {
  const unsatisfied: CaseEvaluation["unsatisfied"] = [];
  const satisfiedBy: Record<string, string> = {};

  for (const req of requirements) {
    const candidates = evidence.filter((e) =>
      requirementMatchedBy(req, e, caseOpenedAt)
    );
    if (candidates.length === 0) {
      const stale = evidence.some((e) => e.kind === req.kind);
      unsatisfied.push({
        key: req.key,
        label: req.label,
        reason: stale
          ? "evidence of this kind exists but was read before the case opened"
          : "no evidence of this kind has been read back",
      });
      continue;
    }
    const chosen = candidates.sort((a, b) => b.fetchedAt - a.fetchedAt)[0];
    satisfiedBy[req.key] = chosen._id ?? `${chosen.source}@${chosen.fetchedAt}`;
  }

  return { ok: unsatisfied.length === 0, unsatisfied, satisfiedBy };
}

export function claimVerdict(
  claim: { assertedAt: number },
  evidence: Evidence | undefined,
  caseOpenedAt: number
): { verdict: Verdict; reason: string } {
  if (!evidence) {
    return {
      verdict: "unverifiable",
      reason: "no evidence attached at the time the claim was recorded",
    };
  }
  if (!isFresh(evidence.fetchedAt, caseOpenedAt)) {
    return {
      verdict: "unverifiable",
      reason: "the attached evidence was read before the case opened, so it cannot speak for now",
    };
  }
  if (!isAuthoritative(evidence.sourceKind)) {
    return {
      verdict: "unverifiable",
      reason: "the attached evidence is not from the counterparty or the customer's own record",
    };
  }
  return { verdict: "verified", reason: `backed by ${evidence.source}` };
}

/** A failing check always dominates; an unverified check outranks a clean pass. */
export function gradeVerdict(checks: GradeCheck[]): GradeVerdict {
  if (checks.some((c) => !c.passed && c.name !== "unverified")) return "fail";
  if (checks.some((c) => c.name === "unverified" && !c.passed)) return "unverified";
  return "pass";
}

export function canBill(verdict: string): boolean {
  return verdict === "pass";
}

export const BILLING_REFUSAL = {
  noGrade: "no grade exists for this subject, so there is nothing that can release a charge",
  fail: "the grade failed, so this call is not billable",
  unverified: "the grade is unverified, and unverified bills nothing",
} as const;

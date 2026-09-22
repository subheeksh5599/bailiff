import { makeFunctionReference } from "convex/server";

/**
 * The functions this site calls, with their shapes written down here.
 *
 * The site is a separate application from the backend and builds on its own, so
 * it references functions by name instead of importing generated types across the
 * tree boundary. Naming them through makeFunctionReference keeps the hooks typed
 * the way the generated api would: a wrong argument is a compile error, and a
 * wrong function name fails loudly on the screen the first time it is called.
 */

export type CaseRow = {
  ref: string;
  state: string;
  counterparty: string;
  openedAt: number;
  chasedAt?: number;
  chaseCount?: number;
  verifiedAt?: number;
  amountClaimedUnits?: number;
  currency?: string;
  channel?: string;
};

export type Requirement = {
  _id: string;
  key: string;
  label: string;
  kind: string;
  satisfied: boolean;
  satisfiedByEvidenceId?: string;
  frozenAt: number;
};

export type Evidence = {
  _id: string;
  kind: string;
  sourceKind: string;
  source: string;
  fetchedAt: number;
  contentHash: string;
  value?: string;
  excerpt: string;
  ingestedBy: string;
};

export type Claim = {
  _id: string;
  kind: string;
  text: string;
  verdict: string;
  verdictReason: string;
};

export type Grade = {
  _id: string;
  subjectKind: string;
  subjectRef: string;
  verdict: string;
  checks: Array<{ name: string; passed: boolean; detail: string }>;
  gradedAt: number;
};

export type BillingRow = {
  _id: string;
  idempotencyKey: string;
  gradeId?: string;
  units: number;
  reason: string;
  state: string;
  meterEventId?: string;
  attempts: number;
  createdAt: number;
};

export type AuditRow = {
  _id: string;
  actor: string;
  action: string;
  detail?: string;
  from?: string;
  to?: string;
  at: number;
};

export type Snapshot = {
  case: {
    _id: string;
    ref: string;
    state: string;
    counterpartyName: string;
    counterpartyDomain?: string;
    counterpartyContact?: string;
    customerRef: string;
    channel: string;
    currency?: string;
    amountClaimedUnits?: number;
    openedAt: number;
    chasedAt?: number;
    chaseCount?: number;
    frozenAt?: number;
    requirementSetHash?: string;
    verifiedAt?: number;
  };
  requirements: Requirement[];
  evidence: Evidence[];
  claims: Claim[];
  grades: Grade[];
  billing: BillingRow[];
  calls: Array<{ _id: string; callRef: string; endedAt: number }>;
};

export type Unsatisfied = { key: string; label: string; reason: string };

export type RunResult = {
  stopped: string | null;
  grade?: string;
  checks?: Array<{ name: string; passed: boolean; detail: string }>;
  claimsRecorded?: number;
  billing?: { sent?: boolean; meterEventId?: string | null } | null;
  emailed?: boolean;
};

export type ReadResult = { source: string; readAt: number; satisfies: string[]; excerpt: string };

const query = makeFunctionReference;
const mutation = makeFunctionReference;
const actionRef = makeFunctionReference;

export const api = {
  board: query<"query", { limit?: number }, CaseRow[]>("cases:board"),
  snapshot: query<"query", { ref: string }, Snapshot | null>("cases:get"),
  audit: query<"query", { caseRef: string }, AuditRow[]>("ops:auditForCase"),
  health: query<"query", Record<string, never>, Record<string, boolean>>("ops:integrationHealth"),

  openCase: mutation<
    "mutation",
    {
      ref: string;
      customerRef: string;
      counterpartyName: string;
      counterpartyDomain?: string;
      counterpartyContact?: string;
      channel: string;
      currency?: string;
      amountClaimedUnits?: number;
    },
    { caseId: string; duplicate: boolean }
  >("cases:openCase"),

  freeze: mutation<
    "mutation",
    { caseId: string; requirements: Array<{ key: string; label: string; kind: string }>; actor: string },
    { hash: string; count: number }
  >("cases:freezeRequirements"),

  attach: mutation<
    "mutation",
    {
      caseId: string;
      kind: string;
      source: string;
      excerpt: string;
      ingestedBy: string;
      value?: string;
      valueUnits?: number;
    },
    { evidenceId: string; newlySatisfied: string[] }
  >("cases:attachOwnEvidence"),

  close: mutation<
    "mutation",
    { caseId: string; actor: string },
    { closed: boolean; unsatisfied?: Unsatisfied[]; alreadyVerified?: boolean }
  >("cases:attemptClose"),

  reopen: mutation<"mutation", { caseId: string; reason: string; actor: string }, { state: string }>(
    "cases:reopenAsDisputed"
  ),

  run: actionRef<"action", { caseRef: string; callRef: string }, RunResult>("orchestrator:resolveCall"),

  readSource: actionRef<"action", { caseRef: string; url: string; kind?: string }, ReadResult>(
    "board:readSource"
  ),

  startCall: actionRef<"action", { caseRef: string; to: string }, { callId: string | null; to: string }>(
    "board:startCall"
  ),
};

/** Where the deployment answers: the site and the backend share one address. */
export const siteConfig = {
  cloud: process.env.NEXT_PUBLIC_CONVEX_URL ?? "",
  health: "/health",
  cases: "/cases",
  case: "/case",
  phone: "+1 458 276 5251",
};

/** A case state, in the words a reader would use rather than the enum. */
export function stateLabel(state: string): string {
  switch (state) {
    case "INTAKE":
      return "Intake";
    case "REQUIREMENTS_FROZEN":
      return "Requirements frozen";
    case "CHASING":
      return "Chasing";
    case "READBACK_PENDING":
      return "Read-back pending";
    case "VERIFIED":
      return "Verified";
    case "DISPUTED":
      return "Disputed";
    case "ABANDONED":
      return "Given up on";
    default:
      return state;
  }
}

/** Only two tones exist: settled, and still open. Nothing in between. */
export function stateSettled(state: string): boolean {
  return state === "VERIFIED";
}

/**
 * What a person should read when a call to the backend fails.
 *
 * A Convex error arrives wrapped in a request envelope and a stack frame. None of
 * that is the reason: the reason is the provider's own sentence in the middle. The
 * envelope is stripped so a refusal reads as a refusal, and the full text is still
 * what the backend recorded.
 */
export function readableError(input: unknown): string {
  const message = input instanceof Error ? input.message : String(input);
  return message
    .replace(/^\[CONVEX[^\]]*\]\s*/i, "")
    .replace(/\[Request ID:[^\]]*\]\s*/i, "")
    .replace(/^(Server Error|Uncaught Error):\s*/i, "")
    .replace(/\s*at handler \([^)]*\)/g, "")
    .replace(/\s*Called by client\.?\s*$/i, "")
    .trim();
}

export function when(value: number | null | undefined): string {
  if (!value) return "—";
  const at = new Date(value);
  return `${at.toISOString().slice(0, 10)} ${at.toISOString().slice(11, 16)}Z`;
}

export function money(
  units: number | null | undefined,
  currency: string | null | undefined
): string {
  if (units == null) return "—";
  return `${currency ?? ""} ${(units / 100).toFixed(2)}`.trim();
}

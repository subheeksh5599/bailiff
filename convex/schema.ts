import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Every table here is a piece of one argument: what is owed, what was claimed,
 * what the counterparty itself said, and whether the two agree.
 *
 * Nothing is stored twice and nothing is stored as free text when a machine has
 * to judge it later. Evidence rows are immutable; a claim points at the evidence
 * that backs it and carries the verdict that follows from it.
 */
export default defineSchema({
  cases: defineTable({
    ref: v.string(),
    state: v.string(),
    customerRef: v.string(),
    counterpartyName: v.string(),
    counterpartyDomain: v.optional(v.string()),
    counterpartyContact: v.optional(v.string()),
    amountClaimedUnits: v.optional(v.number()),
    currency: v.optional(v.string()),
    channel: v.string(),
    openedAt: v.number(),
    // The chase cadence: when it last went out, and how many have. Both live on the
    // case so an interrupted sweep resumes where it left off rather than restarting.
    chasedAt: v.optional(v.number()),
    chaseCount: v.optional(v.number()),
    frozenAt: v.optional(v.number()),
    requirementSetHash: v.optional(v.string()),
    verifiedAt: v.optional(v.number()),
    closedReason: v.optional(v.string()),
  })
    .index("by_ref", ["ref"])
    .index("by_state", ["state"])
    .index("by_customer", ["customerRef"]),

  requirements: defineTable({
    caseId: v.id("cases"),
    key: v.string(),
    label: v.string(),
    kind: v.string(),
    satisfied: v.boolean(),
    satisfiedByEvidenceId: v.optional(v.id("evidence")),
    frozenAt: v.number(),
  })
    .index("by_case", ["caseId"])
    .index("by_case_key", ["caseId", "key"]),

  evidence: defineTable({
    caseId: v.id("cases"),
    kind: v.string(),
    sourceKind: v.string(),
    source: v.string(),
    fetchedAt: v.number(),
    contentHash: v.string(),
    value: v.optional(v.string()),
    valueUnits: v.optional(v.number()),
    excerpt: v.string(),
    ingestedBy: v.string(),
    // A document that was uploaded rather than read: the file itself, kept in
    // storage, with what it was when it arrived.
    storageId: v.optional(v.id("_storage")),
    fileName: v.optional(v.string()),
    mimeType: v.optional(v.string()),
    sizeBytes: v.optional(v.number()),
  })
    .index("by_case", ["caseId"])
    .index("by_case_fetched", ["caseId", "fetchedAt"])
    .index("by_hash", ["contentHash"]),

  claims: defineTable({
    caseId: v.id("cases"),
    text: v.string(),
    kind: v.string(),
    evidenceId: v.optional(v.id("evidence")),
    assertedAt: v.number(),
    verdict: v.string(),
    verdictReason: v.string(),
  })
    .index("by_case", ["caseId"])
    .index("by_verdict", ["verdict"]),

  messages: defineTable({
    caseId: v.id("cases"),
    direction: v.string(),
    channel: v.string(),
    body: v.string(),
    at: v.number(),
    evidenceId: v.optional(v.id("evidence")),
  }).index("by_case", ["caseId"]),

  calls: defineTable({
    caseId: v.id("cases"),
    callRef: v.string(),
    startedAt: v.number(),
    endedAt: v.optional(v.number()),
    endedReason: v.optional(v.string()),
    transcriptHash: v.optional(v.string()),
    durationSeconds: v.optional(v.number()),
  })
    .index("by_call_ref", ["callRef"])
    .index("by_case", ["caseId"]),

  grades: defineTable({
    subjectKind: v.string(),
    subjectRef: v.string(),
    rubricRef: v.string(),
    verdict: v.string(),
    score: v.number(),
    checks: v.array(
      v.object({
        name: v.string(),
        passed: v.boolean(),
        detail: v.string(),
      })
    ),
    gradedBy: v.string(),
    gradedAt: v.number(),
  })
    .index("by_subject", ["subjectKind", "subjectRef"])
    .index("by_verdict", ["verdict"]),

  billingEvents: defineTable({
    idempotencyKey: v.string(),
    caseId: v.id("cases"),
    gradeId: v.optional(v.id("grades")),
    units: v.number(),
    reason: v.string(),
    state: v.string(),
    meterEventId: v.optional(v.string()),
    attempts: v.number(),
    createdAt: v.number(),
  })
    .index("by_key", ["idempotencyKey"])
    .index("by_case", ["caseId"])
    .index("by_state", ["state"]),

  audit: defineTable({
    caseId: v.optional(v.id("cases")),
    actor: v.string(),
    action: v.string(),
    from: v.optional(v.string()),
    to: v.optional(v.string()),
    detail: v.optional(v.string()),
    at: v.number(),
  }).index("by_case", ["caseId"]),
});

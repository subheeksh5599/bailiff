/**
 * What the product says, in one place.
 *
 * Every message that leaves the deployment is built here so the wording is
 * reviewable next to the rules it describes, and so the case reference is added
 * the same way every time: a reply that carries it finds its way back onto the
 * case, and a reply without it does not.
 *
 * These are not marketing copy. Each one states what the case itself now holds -
 * which checks passed, which requirement is still outstanding, what the charge did.
 */

export type CaseReport = { subject: string; text: string };

/** The reference is what turns a reply into evidence, so it is never optional. */
export function withReference(subject: string, caseRef: string): string {
  return `${subject} [case:${caseRef}]`;
}

export function callReport(input: {
  caseRef: string;
  verdict: string;
  checks: Array<{ name: string; passed: boolean; detail: string }>;
  billing: { released: boolean; note: string };
}): CaseReport {
  const passed = input.checks.filter((c) => c.passed).length;
  const subject = withReference(
    input.verdict === "pass"
      ? `Call graded pass, charge released: ${input.caseRef}`
      : `Call not billable (${input.verdict}): ${input.caseRef}`,
    input.caseRef
  );

  const text = [
    `A call on case ${input.caseRef} came back ${input.verdict}: ${passed} of ${input.checks.length} checks passed.`,
    "",
    ...input.checks.map((c) => `  ${c.passed ? "pass" : "FAIL"}  ${c.name} - ${c.detail}`),
    "",
    input.billing.released
      ? `The charge was released: ${input.billing.note}`
      : `No charge was released. ${input.billing.note}`,
    "",
    "Reply to this message and the reply is filed against the case.",
  ].join("\n");

  return { subject, text };
}

export function chaseMessage(input: {
  caseRef: string;
  counterparty: string;
  attempt: string;
  outstanding: Array<{ key: string; label: string; reason: string }>;
}): CaseReport {
  return {
    subject: withReference(`Still outstanding on ${input.counterparty}`, input.caseRef),
    text: [
      `${input.attempt} on case ${input.caseRef} against ${input.counterparty}.`,
      "",
      "What the case is still waiting for:",
      ...input.outstanding.map((u) => `  - ${u.label} (${u.key}): ${u.reason}`),
      "",
      "What would close it: evidence of the same kind, read back after the case opened.",
      `Reply to this message and the reply is filed against ${input.caseRef} automatically.`,
      "",
      "When the cadence runs out the case is abandoned and says so, rather than staying open.",
    ].join("\n"),
  };
}

export function abandonmentNotice(input: {
  caseRef: string;
  counterparty: string;
  attempts: number;
  outstanding: Array<{ key: string; label: string }>;
}): CaseReport {
  return {
    subject: withReference(`Given up on: ${input.counterparty}`, input.caseRef),
    text: [
      `Case ${input.caseRef} has been abandoned after ${input.attempts} chases went unanswered.`,
      "",
      "What was never read back:",
      ...input.outstanding.map((u) => `  - ${u.label} (${u.key})`),
      "",
      "The case is not closed and nothing about it is settled. It is recorded as given up",
      "on, with the reason, so the board stops counting it as work in progress.",
    ].join("\n"),
  };
}

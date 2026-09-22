/**
 * Reading the call platform's own view of a call.
 *
 * A telephony platform can return its analysis of a finished call alongside the
 * transcript. When it does, that reading is better evidence about the call than a
 * second model's pass over the same text: it was produced from the call itself, in
 * the same system, at the time. It is treated as a source with a name, never as
 * authority - every claim it yields still has to pass the same rules, where a
 * promise is checked against our own recording and a fact needs the counterparty's.
 *
 * Nothing here is trusted for shape either. A payload we cannot read is discarded
 * rather than half-used, so a malformed analysis leaves the run to the model instead
 * of quietly producing an empty case.
 */
export type CallAnalysisClaims = {
  caller_wanted: string;
  resolved: boolean;
  promises: Array<{ text: string; promised_when: string | null }>;
  facts: Array<{ text: string; subject: string }>;
};

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export function parseCallAnalysis(raw: string | null | undefined): CallAnalysisClaims | null {
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const source = parsed as Record<string, unknown>;

  const promises: CallAnalysisClaims["promises"] = [];
  if (Array.isArray(source.promises)) {
    for (const entry of source.promises) {
      if (!entry || typeof entry !== "object") continue;
      const value = entry as Record<string, unknown>;
      const body = text(value.text);
      if (!body) continue;
      promises.push({ text: body, promised_when: text(value.promised_when) });
    }
  }

  const facts: CallAnalysisClaims["facts"] = [];
  if (Array.isArray(source.facts)) {
    for (const entry of source.facts) {
      if (!entry || typeof entry !== "object") continue;
      const value = entry as Record<string, unknown>;
      const body = text(value.text);
      if (!body) continue;
      facts.push({ text: body, subject: text(value.subject) ?? "unknown" });
    }
  }

  const wanted = text(source.caller_wanted);
  // An analysis that yields nothing is not an analysis; the run falls back to the model.
  if (!wanted && promises.length === 0 && facts.length === 0) return null;

  return {
    caller_wanted: wanted ?? "not stated in the analysis",
    resolved: source.resolved === true,
    promises,
    facts,
  };
}

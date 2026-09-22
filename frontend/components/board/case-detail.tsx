"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { useState, type ReactNode } from "react";
import {
  api,
  money,
  when,
  type AuditRow,
  type ReadResult,
  type RunResult,
  type Snapshot,
} from "@/lib/backend";
import { Button, Chip, Field, Input, Panel } from "@/components/fabric/ui";
import { Reading, StateChip } from "@/components/board/board";

/**
 * One case, and the two things an operator can do to it.
 *
 * Everything an operator starts here reads the world or adds evidence; none of
 * it decides an outcome. Closure is decided by the rules reading the evidence,
 * and the charge is released by the grade — so the screen shows the refusal in
 * the backend's own words rather than offering a button that closes anyway.
 *
 * A settled case accepts no more evidence and says so instead of disabling a
 * control without explaining why.
 */
export function CaseView({ caseRef }: { caseRef: string }): ReactNode {
  const snapshot = useQuery(api.snapshot, { ref: caseRef }) as Snapshot | null | undefined;
  const audit = useQuery(api.audit, { caseRef }) as AuditRow[] | undefined;

  const readSource = useAction(api.readSource);
  const run = useAction(api.run);
  const attach = useMutation(api.attach);
  const close = useMutation(api.close);
  const reopen = useMutation(api.reopen);

  const [url, setUrl] = useState("");
  const [readKind, setReadKind] = useState("page_read");
  const [callRef, setCallRef] = useState("");
  const [docKind, setDocKind] = useState("own_document");
  const [docText, setDocText] = useState("");
  const [reason, setReason] = useState("");

  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [readResult, setReadResult] = useState<ReadResult | null>(null);
  const [closeResult, setCloseResult] = useState<Snapshot["requirements"] | null>(null);

  if (snapshot === undefined) return <Reading />;
  if (snapshot === null) {
    return (
      <Panel>
        <p className="text-sm text-neutral-300">No case is filed under that reference.</p>
        <p className="mt-2 text-[12px] text-neutral-500">
          A reference is how the phone line and the mailbox find this case again, so a case whose
          reference never matched the call stays empty on purpose.
        </p>
      </Panel>
    );
  }

  const { case: doc, requirements, evidence, claims, grades, billing } = snapshot;
  const settled = doc.state === "VERIFIED";

  async function act<T>(label: string, work: () => Promise<T>, done?: (value: T) => void) {
    setBusy(label);
    setError(null);
    setNote(null);
    try {
      const value = await work();
      if (done) done(value);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <Panel>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="data text-[1.0625rem] text-white">{doc.ref}</span>
              <StateChip state={doc.state} />
              <Chip>{doc.channel}</Chip>
            </div>
            <p className="mt-2 text-sm text-neutral-400">
              {doc.counterpartyName}
              {doc.counterpartyDomain ? ` · ${doc.counterpartyDomain}` : ""} · owed{" "}
              {money(doc.amountClaimedUnits, doc.currency)}
            </p>
          </div>
          <div className="text-right text-[11px] text-neutral-500">
            <p>opened {when(doc.openedAt)}</p>
            {doc.frozenAt && <p className="mt-1">requirements frozen {when(doc.frozenAt)}</p>}
            {doc.verifiedAt && <p className="mt-1 text-accent">verified {when(doc.verifiedAt)}</p>}
          </div>
        </div>
        {doc.requirementSetHash && (
          <p className="data mt-4 text-[11px] break-all text-neutral-600">
            requirementSetHash {doc.requirementSetHash}
          </p>
        )}
      </Panel>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Panel>
            <h2 className="text-[1.0625rem] text-white">Requirements</h2>
            <p className="mt-2 text-[12px] leading-relaxed text-neutral-500">
              Frozen at intake, and satisfied only by evidence of the same kind read back after the
              case opened.
            </p>
            <div className="mt-5 space-y-3">
              {requirements.length === 0 && (
                <p className="text-[13px] text-neutral-500">Nothing frozen yet.</p>
              )}
              {requirements.map((req) => (
                <div
                  key={req._id}
                  className="rounded-xl bg-black/25 px-4 py-3.5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[13px] text-neutral-200">{req.label}</p>
                      <p className="data mt-1 text-[11px] text-neutral-500">
                        {req.key} · satisfied by {req.kind}
                      </p>
                    </div>
                    <Chip accent={req.satisfied}>
                      {req.satisfied ? "satisfied" : "outstanding"}
                    </Chip>
                  </div>
                  {req.satisfied && req.satisfiedByEvidenceId && (
                    <p className="data mt-2 text-[11px] break-all text-accent/80">
                      closed by {req.satisfiedByEvidenceId}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </Panel>

          <Panel>
            <h2 className="text-[1.0625rem] text-white">What an operator can start</h2>
            {settled ? (
              <div className="mt-4 space-y-4">
                <p className="text-[13px] leading-relaxed text-neutral-400">
                  This case is settled, and settled cases are not fed new evidence. If something
                  arrived after the fact, reopen it as disputed and the record will show why.
                </p>
                <Field label="Why reopen it">
                  <Input value={reason} onChange={(e) => setReason(e.target.value)} />
                </Field>
                <Button
                  variant="outline"
                  disabled={busy !== null || !reason.trim()}
                  onClick={() =>
                    act("reopen", () => reopen({ caseId: doc._id, reason: reason.trim(), actor: "board" }))
                  }
                >
                  {busy === "reopen" ? "Working…" : "Reopen as disputed"}
                </Button>
              </div>
            ) : (
              <div className="mt-5 space-y-6">
                <div>
                  <p className="text-[13px] font-medium text-neutral-200">Read a page as evidence</p>
                  <p className="mt-1 text-[12px] text-neutral-500">
                    Read on the server, timed, and filed against this case. The browser never
                    asserts what a page said.
                  </p>
                  <div className="mt-3 grid grid-cols-[1fr_11rem] gap-2.5">
                    <Input
                      value={url}
                      placeholder="https://example.com/orders/12345"
                      onChange={(e) => setUrl(e.target.value)}
                    />
                    <select
                      value={readKind}
                      onChange={(e) => setReadKind(e.target.value)}
                      className="w-full rounded-xl bg-black/40 px-3 py-2.5 text-sm text-white outline-none shadow-[inset_0_1px_2px_rgba(0,0,0,0.6),inset_0_0_0_1px_rgba(255,255,255,0.06)]"
                    >
                      {requirements.map((r) => (
                        <option key={r._id} value={r.kind}>
                          {r.kind}
                        </option>
                      ))}
                      <option value="page_read">page_read</option>
                    </select>
                  </div>
                  <div className="mt-3">
                    <Button
                      disabled={busy !== null || !url.trim()}
                      onClick={() =>
                        act(
                          "read",
                          () => readSource({ caseRef: doc.ref, url: url.trim(), kind: readKind }),
                          setReadResult
                        )
                      }
                    >
                      {busy === "read" ? "Reading…" : "Read it"}
                    </Button>
                  </div>
                  {readResult && (
                    <p className="mt-3 text-[12px] text-neutral-400">
                      Read {readResult.source} at {when(readResult.readAt)}.{" "}
                      {readResult.satisfies.length > 0
                        ? `Satisfied: ${readResult.satisfies.join(", ")}.`
                        : "No frozen requirement was satisfied by it."}
                    </p>
                  )}
                </div>

                <div className="border-t border-white/[0.06] pt-5">
                  <p className="text-[13px] font-medium text-neutral-200">
                    Add the owner&rsquo;s own document
                  </p>
                  <p className="mt-1 text-[12px] text-neutral-500">
                    Filed as our own record. It can never satisfy a requirement that asks for the
                    other side&rsquo;s.
                  </p>
                  <div className="mt-3 grid grid-cols-[11rem_1fr] gap-2.5">
                    <select
                      value={docKind}
                      onChange={(e) => setDocKind(e.target.value)}
                      className="w-full rounded-xl bg-black/40 px-3 py-2.5 text-sm text-white outline-none shadow-[inset_0_1px_2px_rgba(0,0,0,0.6),inset_0_0_0_1px_rgba(255,255,255,0.06)]"
                    >
                      <option value="own_document">own_document</option>
                      {requirements.map((r) => (
                        <option key={r._id} value={r.kind}>
                          {r.kind}
                        </option>
                      ))}
                    </select>
                    <Input
                      value={docText}
                      placeholder="what the document says"
                      onChange={(e) => setDocText(e.target.value)}
                    />
                  </div>
                  <div className="mt-3">
                    <Button
                      variant="outline"
                      disabled={busy !== null || !docText.trim()}
                      onClick={() =>
                        act(
                          "attach",
                          () =>
                            attach({
                              caseId: doc._id,
                              kind: docKind,
                              source: "board upload",
                              excerpt: docText.trim(),
                              ingestedBy: "board",
                            }),
                          (written) =>
                            setNote(
                              written.newlySatisfied.length > 0
                                ? `Satisfied: ${written.newlySatisfied.join(", ")}`
                                : "Filed. It did not satisfy a requirement."
                            )
                        )
                      }
                    >
                      File it
                    </Button>
                  </div>
                </div>

                <div className="border-t border-white/[0.06] pt-5">
                  <p className="text-[13px] font-medium text-neutral-200">Run the pipeline on a call</p>
                  <p className="mt-1 text-[12px] text-neutral-500">
                    Grades a call that has already been ingested, files its claims, and releases the
                    charge only if the grade passes.
                  </p>
                  <div className="mt-3 grid grid-cols-[1fr_auto] gap-2.5">
                    <Input
                      value={callRef}
                      placeholder="call reference from the phone line"
                      onChange={(e) => setCallRef(e.target.value)}
                    />
                    <Button
                      disabled={busy !== null || !callRef.trim()}
                      onClick={() =>
                        act(
                          "run",
                          () => run({ caseRef: doc.ref, callRef: callRef.trim() }),
                          setRunResult
                        )
                      }
                    >
                      {busy === "run" ? "Running…" : "Grade it"}
                    </Button>
                  </div>
                  {runResult && (
                    <div className="mt-3 rounded-xl bg-black/25 px-4 py-3 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)]">
                      {runResult.stopped ? (
                        <p className="text-[12px] text-[#f0c98a]">Stopped: {runResult.stopped}</p>
                      ) : (
                        <>
                          <p className="text-[12px] text-neutral-300">
                            Grade <span className="text-white">{runResult.grade}</span> ·{" "}
                            {runResult.claimsRecorded ?? 0} claim(s) filed ·{" "}
                            {runResult.billing ? "charge released" : "no charge released"}
                            {runResult.emailed ? " · owner emailed" : ""}
                          </p>
                          <ul className="mt-2 space-y-1">
                            {(runResult.checks ?? []).map((check) => (
                              <li key={check.name} className="text-[11px] text-neutral-400">
                                <span className={check.passed ? "text-accent" : "text-[#f0a8a8]"}>
                                  {check.passed ? "pass" : "fail"}
                                </span>{" "}
                                {check.name} — {check.detail}
                              </li>
                            ))}
                          </ul>
                        </>
                      )}
                    </div>
                  )}
                </div>

                <div className="border-t border-white/[0.06] pt-5">
                  <Button
                    disabled={busy !== null}
                    onClick={() =>
                      act(
                        "close",
                        () => close({ caseId: doc._id, actor: "board" }),
                        (result) =>
                          setCloseResult(
                            result.closed
                              ? []
                              : requirements.filter((r) =>
                                  (result.unsatisfied ?? []).some((u) => u.key === r.key)
                                )
                          )
                      )
                    }
                  >
                    {busy === "close" ? "Checking…" : "Try to close it"}
                  </Button>
                  {closeResult && (
                    <p className="mt-3 text-[12px] text-neutral-400">
                      {closeResult.length === 0
                        ? "Closed: every requirement was satisfied by a read-back."
                        : closeResult
                            .map((r) => `${r.key}: no evidence of this kind has been read back`)
                            .join(" · ")}
                    </p>
                  )}
                </div>
              </div>
            )}

            {note && <p className="mt-4 text-[12px] text-neutral-400">{note}</p>}
            {error && (
              <div className="mt-4 rounded-xl bg-[#1b1013] px-4 py-3 shadow-[inset_0_0_0_1px_rgba(255,120,120,0.18)]">
                <p className="text-[12px] leading-relaxed text-[#f0a8a8]">{error}</p>
              </div>
            )}
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel>
            <h2 className="text-[1.0625rem] text-white">Evidence</h2>
            <p className="mt-2 text-[12px] text-neutral-500">
              Every read carries the time it happened and a hash of what came back.
            </p>
            <div className="mt-5 space-y-3">
              {evidence.length === 0 && (
                <p className="text-[13px] text-neutral-500">Nothing read yet.</p>
              )}
              {evidence.map((item) => (
                <div
                  key={item._id}
                  className="rounded-xl bg-black/25 px-4 py-3.5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)]"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Chip accent={item.sourceKind === "counterparty"}>
                      {item.sourceKind === "counterparty" ? "their record" : item.sourceKind}
                    </Chip>
                    <span className="data text-[11px] text-neutral-400">{item.kind}</span>
                    <span className="text-[11px] text-neutral-600">{when(item.fetchedAt)}</span>
                  </div>
                  <p className="data mt-2 text-[11px] break-all text-neutral-500">{item.source}</p>
                  <p className="mt-2 line-clamp-4 text-[12px] leading-relaxed text-neutral-400">
                    {item.excerpt}
                  </p>
                  <p className="data mt-2 text-[10px] break-all text-neutral-600">
                    {item.contentHash.slice(0, 24)}… · filed by {item.ingestedBy}
                  </p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel>
            <h2 className="text-[1.0625rem] text-white">Claims and grade</h2>
            <div className="mt-4 space-y-2">
              {claims.length === 0 && <p className="text-[13px] text-neutral-500">No claims filed.</p>}
              {claims.map((claim) => (
                <div key={claim._id} className="flex items-start justify-between gap-3">
                  <p className="text-[12px] leading-relaxed text-neutral-300">{claim.text}</p>
                  <Chip accent={claim.verdict === "verified"}>{claim.verdict}</Chip>
                </div>
              ))}
            </div>
            <div className="mt-5 space-y-3 border-t border-white/[0.06] pt-5">
              {grades.length === 0 && <p className="text-[13px] text-neutral-500">No grade yet.</p>}
              {grades.map((grade) => (
                <div key={grade._id}>
                  <p className="text-[13px] text-white">Grade {grade.verdict}</p>
                  <ul className="mt-2 space-y-1">
                    {grade.checks.map((check) => (
                      <li key={check.name} className="text-[11px] text-neutral-400">
                        <span className={check.passed ? "text-accent" : "text-[#f0a8a8]"}>
                          {check.passed ? "pass" : "fail"}
                        </span>{" "}
                        {check.name} — {check.detail}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div className="mt-5 space-y-2 border-t border-white/[0.06] pt-5">
              <p className="text-[12px] text-neutral-400">Billing</p>
              {billing.length === 0 && (
                <p className="text-[13px] text-neutral-500">No charge has been written.</p>
              )}
              {billing.map((row) => (
                <div key={row._id} className="flex items-center justify-between gap-3">
                  <span className="data text-[11px] text-neutral-400">{row.idempotencyKey}</span>
                  <Chip accent={row.state === "metered"}>{row.state}</Chip>
                </div>
              ))}
            </div>
          </Panel>

          <Panel>
            <h2 className="text-[1.0625rem] text-white">Audit trail</h2>
            <div className="mt-4 space-y-2.5">
              {(audit ?? []).slice(0, 14).map((row) => (
                <div key={row._id} className="flex items-start gap-3">
                  <span className="data mt-0.5 w-[8.5rem] shrink-0 text-[10px] text-neutral-600">
                    {when(row.at)}
                  </span>
                  <div className="min-w-0">
                    <p className="data text-[11px] text-neutral-300">{row.action}</p>
                    {row.detail && (
                      <p className="mt-0.5 text-[11px] leading-relaxed break-words text-neutral-500">
                        {row.detail}
                      </p>
                    )}
                  </div>
                </div>
              ))}
              {audit?.length === 0 && <p className="text-[13px] text-neutral-500">Nothing yet.</p>}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

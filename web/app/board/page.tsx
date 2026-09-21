"use client";

import "../board.css";
import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useBackend } from "../providers";

/**
 * The case board.
 *
 * Everything on this screen is read from the live deployment or not shown at all:
 * the case list, the requirement set, every piece of evidence with the time it
 * was read, the claims with their verdicts, the grades and the billing rows. When
 * the backend is not connected the board says so instead of rendering samples -
 * there is no fixture path in this file.
 */
const DEFAULT_REQUIREMENTS = [
  { key: "order_ref", label: "The order or reference number", kind: "email_reply" },
  { key: "refund_issued", label: "Their record shows the refund or credit", kind: "payment_record" },
];

type CloseResult =
  | { closed: true; alreadyVerified?: boolean; unsatisfied: [] }
  | { closed: false; unsatisfied: Array<{ key: string; label: string; reason: string }> };

export default function Board() {
  const { configured } = useBackend();
  // Hooks cannot be called conditionally, so the split is at the component level:
  // with no client there is nothing to query, and nothing is rendered from a query.
  if (!configured) return <NotConnected />;
  return <ConnectedBoard />;
}

function NotConnected() {
  return (
    <>
      <header className="top">
        <div className="wrap">
          <Link className="mark" href="/" aria-label="Bailiff home">
            <svg viewBox="0 0 170 48" aria-hidden="true">
              <text x="3" y="45" fill="#fff" fontSize="29" fontWeight="800" letterSpacing="-1.1" fontFamily="Manrope">bailiff</text>
            </svg>
          </Link>
          <div className="status">
            <span className="tag off">backend: off</span>
          </div>
        </div>
      </header>
      <div className="banner" id="banner">
        <div className="wrap">
          <b>No live backend.</b> NEXT_PUBLIC_CONVEX_URL is not set, so this board has nothing to read and shows
          nothing. It does not fall back to sample cases: run <span className="mono">npx convex dev</span> and set the
          URL to see real ones.
        </div>
      </div>
    </>
  );
}

function ConnectedBoard() {
  const [ref, setRef] = useState("");
  const [counterparty, setCounterparty] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [closeResult, setCloseResult] = useState<CloseResult | null>(null);
  const [busy, setBusy] = useState(false);

  const health = useQuery(api.ops.integrationHealth, {});
  const board = useQuery(api.cases.board, { limit: 50 });
  const detail = useQuery(api.cases.get, selected ? { ref: selected } : "skip");
  const audit = useQuery(api.ops.auditForCase, selected ? { caseRef: selected } : "skip");

  const openCase = useMutation(api.cases.openCase);
  const freeze = useMutation(api.cases.freezeRequirements);
  const attach = useMutation(api.cases.attachOwnEvidence);
  const close = useMutation(api.cases.attemptClose);

  async function handleOpen(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const created = await openCase({
        ref: ref.trim(),
        customerRef: "signed-in-owner",
        counterpartyName: counterparty.trim(),
        amountClaimedUnits: amount ? Math.round(Number(amount) * 100) : undefined,
        currency: amount ? "USD" : undefined,
        channel: "phone",
      });
      if (!created.duplicate) {
        await freeze({
          caseId: created.caseId,
          requirements: DEFAULT_REQUIREMENTS,
          actor: "board",
        });
      }
      setSelected(ref.trim());
      setMessage(created.duplicate ? "That reference already exists; opened the existing case." : "Case opened and its requirements frozen.");
      setRef("");
      setCounterparty("");
      setAmount("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "the case was not opened");
    } finally {
      setBusy(false);
    }
  }

  async function handleAttach(event: React.FormEvent) {
    event.preventDefault();
    if (!detail || !note.trim()) return;
    setBusy(true);
    try {
      const result = await attach({
        caseId: detail.case._id,
        kind: "email_reply",
        source: "owner pasted the thread",
        excerpt: note.trim(),
        ingestedBy: "board",
      });
      setMessage(
        result.newlySatisfied.length
          ? `Stored and it satisfies: ${result.newlySatisfied.join(", ")}.`
          : "Stored. It does not satisfy anything yet."
      );
      setNote("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "the evidence was not stored");
    } finally {
      setBusy(false);
    }
  }

  async function handleClose() {
    if (!detail) return;
    setBusy(true);
    setCloseResult(null);
    try {
      const result = await close({ caseId: detail.case._id, actor: "board" });
      setCloseResult(result as CloseResult);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "the close was refused");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <header className="top">
        <div className="wrap">
          <Link className="mark" href="/" aria-label="Bailiff home">
            <svg viewBox="0 0 170 48" aria-hidden="true">
              <text x="3" y="45" fill="#fff" fontSize="29" fontWeight="800" letterSpacing="-1.1" fontFamily="Manrope">bailiff</text>
            </svg>
          </Link>
          <div className="status" id="status">
              {health &&
              Object.entries(health)
                .filter(([name]) => name !== "convex")
                .map(([name, on]) => (
                  <span key={name} className={on ? "tag on" : "tag off"}>
                    {name}: {on ? "on" : "off"}
                  </span>
                ))}
          </div>
        </div>
      </header>

      <main className="wrap row">
        <section className="sec card" id="create">
          <h2>New case</h2>
          <p className="placeholder">A case keeps its requirement set frozen at intake, and only closes when the other side&apos;s own record satisfies it.</p>
          <form onSubmit={handleOpen} className="inline">
            <label htmlFor="refInput">Reference</label>
            <input id="refInput" value={ref} onChange={(e) => setRef(e.target.value)} required minLength={3} placeholder="case-2026-0914-01" />
            <label htmlFor="cpInput">Company</label>
            <input id="cpInput" value={counterparty} onChange={(e) => setCounterparty(e.target.value)} required placeholder="Example Corp" />
            <label htmlFor="amtInput">Owed</label>
            <input id="amtInput" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="412.00" />
            <button className="btn" type="submit" disabled={busy}>
              Open the case
            </button>
          </form>
          {message && <p className="msg" id="createMsg">{message}</p>}
        </section>

        <section className="sec card">
          <h2>Cases</h2>
          {board === undefined && <p className="placeholder">Loading from the live deployment…</p>}
          {board?.length === 0 && <p className="placeholder">No cases yet. Open one above.</p>}
          <div className="clist">
            {board?.map((row) => (
              <button
                key={row.ref}
                className={`crow${selected === row.ref ? " active" : ""}`}
                onClick={() => {
                  setSelected(row.ref);
                  setCloseResult(null);
                }}
              >
                <span className="mono">{row.ref}</span>
                <span className="state">{row.state}</span>
                <span className="kv">{row.counterparty}</span>
                {typeof row.amountClaimedUnits === "number" && <span className="kv">{row.currency} {(row.amountClaimedUnits / 100).toFixed(2)}</span>}
              </button>
            ))}
          </div>
        </section>

        {detail && (
          <section className="sec card" id="detail">
            <h2>
              {detail.case.ref} <span className="tag">{detail.case.state}</span>
            </h2>
            <p className="placeholder">
              {detail.case.counterpartyName} · opened {new Date(detail.case.openedAt).toISOString()} · set hash{" "}
              <span className="mono">{(detail.case.requirementSetHash ?? "not frozen").slice(0, 12)}</span>
            </p>

            <h3>Requirements</h3>
            <ul className="items">
              {detail.requirements.map((r) => (
                <li key={r.key} className={r.satisfied ? "item on" : "item"}>
                  <span className="dot" /> {r.label} <span className="mono">({r.kind})</span> — {r.satisfied ? "satisfied" : "still open"}
                </li>
              ))}
            </ul>

            <h3>Evidence</h3>
            {detail.evidence.length === 0 && <p className="placeholder">Nothing read yet.</p>}
            <ul className="items">
              {detail.evidence.map((e) => (
                <li key={e._id} className="item">
                  <span className={`tag ${e.sourceKind === "counterparty" ? "on" : ""}`}>{e.sourceKind}</span>{" "}
                  <span className="mono">{e.kind}</span> from {e.source} at {new Date(e.fetchedAt).toISOString()}{" "}
                  <span className="mono">#{e.contentHash.slice(0, 10)}</span>
                </li>
              ))}
            </ul>

            <h3>Claims</h3>
            {detail.claims.length === 0 && <p className="placeholder">No claims recorded yet.</p>}
            <ul className="items">
              {detail.claims.map((c) => (
                <li key={c._id} className="item">
                  <span className={`tag ${c.verdict === "verified" ? "on" : "off"}`}>{c.verdict}</span> {c.text}{" "}
                  <span className="placeholder">— {c.verdictReason}</span>
                </li>
              ))}
            </ul>

            <h3>Grades and billing</h3>
            {detail.grades.length === 0 && <p className="placeholder">No grade yet.</p>}
            {detail.grades.map((g) => (
              <div key={g._id} className="card">
                <b>{g.verdict}</b> <span className="mono">{g.subjectRef}</span> · rubric {g.rubricRef} · {g.gradedBy} ·{" "}
                {new Date(g.gradedAt).toISOString()}
                <ul className="items">
                  {g.checks.map((check, index) => (
                    <li key={`${g._id}-${index}`} className={check.passed ? "item on" : "item"}>
                      <span className="dot" /> {check.name}: {check.passed ? "pass" : "fail"} — {check.detail}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <ul className="items">
              {detail.billing.map((b) => (
                <li key={b._id} className="item">
                  <span className="tag">{b.state}</span> {b.units} unit(s) for {b.reason} · key{" "}
                  <span className="mono">{b.idempotencyKey}</span> · attempts {b.attempts}
                </li>
              ))}
            </ul>

            <h3>Add the owner&apos;s own document</h3>
            <form onSubmit={handleAttach} className="inline">
              <textarea id="text" value={note} onChange={(e) => setNote(e.target.value)} spellCheck={false} placeholder="Paste the email thread, order confirmation or portal export here." />
              <button className="btn" type="submit" disabled={busy || note.trim().length < 20}>
                Store it as our own record
              </button>
            </form>

            <div className="bar">
              <button className="btn" onClick={handleClose} disabled={busy}>
                Ask to close the case
              </button>
            </div>
            {closeResult && (
              <div className={closeResult.closed ? "msg ok" : "msg err"}>
                {closeResult.closed ? (
                  <>Closed, because every frozen requirement is satisfied by a record read after the case opened.</>
                ) : (
                  <>
                    <b>Refused.</b> Still open:
                    <ul className="items">
                      {closeResult.unsatisfied.map((u) => (
                        <li key={u.key} className="item">
                          {u.label} — {u.reason}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}

            <h3>The case&apos;s own diary</h3>
            <ul className="items">
              {audit?.map((row) => (
                <li key={row._id} className="item">
                  <span className="placeholder">{new Date(row.at).toISOString()}</span>{" "}
                  <span className="mono">{row.action}</span> {row.from && row.to ? `${row.from} → ${row.to} ` : ""}
                  {row.detail}
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </>
  );
}

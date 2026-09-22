"use client";

import { useMutation } from "convex/react";
import { useState, type ReactNode } from "react";
import { api } from "@/lib/backend";
import { Button, Chip, Field, Input, Panel } from "@/components/fabric/ui";

/**
 * Opening a case, and freezing what has to be true for it to close.
 *
 * Two steps on one screen because they happen in that order and the second is
 * irreversible: once a requirement set is written it cannot be rewritten, so the
 * form makes you look at the set you are about to freeze before it goes in. The
 * refusal that follows a second attempt comes from the backend, in its own words,
 * and is shown verbatim rather than dressed up.
 */

const KINDS = [
  { value: "own_document", label: "Own document" },
  { value: "page_read", label: "Page read back" },
  { value: "email_reply", label: "Email reply" },
  { value: "payment_record", label: "Payment record" },
  { value: "call_transcript", label: "Call transcript" },
];

type Row = { key: string; label: string; kind: string };

function freshRef(): string {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const tail = Math.random().toString(36).slice(2, 6);
  return `case-${stamp}-${tail}`;
}

export function NewCaseView(): ReactNode {
  const openCase = useMutation(api.openCase);
  const freeze = useMutation(api.freeze);

  const [ref, setRef] = useState(freshRef);
  const [company, setCompany] = useState("");
  const [domain, setDomain] = useState("");
  const [owed, setOwed] = useState("41.20");
  const [currency, setCurrency] = useState("GBP");
  const [channel, setChannel] = useState("phone");

  const [rows, setRows] = useState<Row[]>([
    { key: "refund_moved", label: "their own record shows the refund moved", kind: "email_reply" },
  ]);

  const [caseId, setCaseId] = useState<string | null>(null);
  const [hash, setHash] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const units = Math.round(Number(owed || "0") * 100);

  async function open(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const result = (await openCase({
        ref: ref.trim(),
        customerRef: "owner",
        counterpartyName: company.trim(),
        ...(domain.trim() ? { counterpartyDomain: domain.trim() } : {}),
        channel,
        currency,
        ...(Number.isFinite(units) && units > 0 ? { amountClaimedUnits: units } : {}),
      })) as { caseId: string; duplicate: boolean };
      setCaseId(result.caseId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  }

  async function freezeSet(): Promise<void> {
    if (!caseId) return;
    setBusy(true);
    setError(null);
    try {
      const result = (await freeze({
        caseId,
        requirements: rows.filter((r) => r.key.trim() && r.label.trim()),
        actor: "board",
      })) as { hash: string; count: number };
      setHash(result.hash);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid max-w-[72rem] grid-cols-1 gap-6 lg:grid-cols-2">
      <Panel>
        <h2 className="text-[1.0625rem] text-white">1 · The case</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-neutral-400">
          Who owes what, and how we reached them. The reference is how the phone call finds this
          case again, so it has to match the one read out on the line.
        </p>

        <div className="mt-6 space-y-4">
          <Field label="Reference" hint="carried in the call's metadata">
            <Input value={ref} onChange={(e) => setRef(e.target.value)} />
          </Field>
          <Field label="Company">
            <Input value={company} placeholder="Northwind Utilities" onChange={(e) => setCompany(e.target.value)} />
          </Field>
          <Field label="Their domain" hint="optional; where a page would be read from">
            <Input value={domain} placeholder="example.com" onChange={(e) => setDomain(e.target.value)} />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Owed">
              <Input value={owed} onChange={(e) => setOwed(e.target.value)} />
            </Field>
            <Field label="Currency">
              <Input value={currency} onChange={(e) => setCurrency(e.target.value)} />
            </Field>
            <Field label="Channel">
              <Input value={channel} onChange={(e) => setChannel(e.target.value)} />
            </Field>
          </div>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <Button onClick={open} disabled={busy || !ref.trim() || !company.trim()}>
            {busy ? "Working…" : caseId ? "Re-open (idempotent)" : "Open the case"}
          </Button>
          {caseId && <Chip accent>opened</Chip>}
        </div>
      </Panel>

      <Panel>
        <h2 className="text-[1.0625rem] text-white">2 · What has to be true to close it</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-neutral-400">
          Each requirement is satisfied only by evidence of the same kind, read back after the case
          opened. Once frozen the set is hashed and cannot be changed — the point is that it was
          written before anyone knew how the call would go.
        </p>

        <div className="mt-6 space-y-3">
          {rows.map((row, index) => (
            <div key={index} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2.5">
              <Field label={index === 0 ? "Key" : ""}>
                <Input
                  value={row.key}
                  onChange={(e) =>
                    setRows(rows.map((r, i) => (i === index ? { ...r, key: e.target.value } : r)))
                  }
                />
              </Field>
              <Field label={index === 0 ? "Satisfied by" : ""}>
                <select
                  value={row.kind}
                  onChange={(e) =>
                    setRows(rows.map((r, i) => (i === index ? { ...r, kind: e.target.value } : r)))
                  }
                  className="w-full rounded-xl bg-black/40 px-3.5 py-2.5 text-sm text-white outline-none shadow-[inset_0_1px_2px_rgba(0,0,0,0.6),inset_0_0_0_1px_rgba(255,255,255,0.06)]"
                >
                  {KINDS.map((k) => (
                    <option key={k.value} value={k.value}>
                      {k.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Button variant="ghost" onClick={() => setRows(rows.filter((_, i) => i !== index))}>
                remove
              </Button>
              <div className="col-span-3 -mt-1">
                <Input
                  value={row.label}
                  placeholder="in words, what this requirement means"
                  onChange={(e) =>
                    setRows(rows.map((r, i) => (i === index ? { ...r, label: e.target.value } : r)))
                  }
                />
              </div>
            </div>
          ))}
          <Button
            variant="outline"
            onClick={() => setRows([...rows, { key: "", label: "", kind: "page_read" }])}
          >
            Add a requirement
          </Button>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button onClick={freezeSet} disabled={busy || !caseId || rows.length === 0}>
            {busy ? "Working…" : "Freeze the set"}
          </Button>
          {caseId && (
            <a
              className="text-[13px] text-neutral-400 no-underline hover:text-white"
              href={`?view=case&ref=${encodeURIComponent(ref.trim())}`}
            >
              open the case →
            </a>
          )}
        </div>

        {hash && (
          <p className="data mt-4 text-[11px] break-all text-neutral-500">set hash {hash}</p>
        )}

        {error && (
          <div className="mt-5 rounded-xl bg-[#1b1013] px-4 py-3 shadow-[inset_0_0_0_1px_rgba(255,120,120,0.18)]">
            <p className="text-[12px] leading-relaxed text-[#f0a8a8]">{error}</p>
          </div>
        )}
      </Panel>
    </div>
  );
}

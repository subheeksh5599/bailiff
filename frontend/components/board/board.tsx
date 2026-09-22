"use client";

import { useQuery } from "convex/react";
import { api, money, stateLabel, stateSettled, when, type CaseRow } from "@/lib/backend";
import { Chip, Empty, Panel } from "@/components/fabric/ui";
import type { ReactNode } from "react";

/**
 * Every case, in the order they were opened.
 *
 * The counts above the list are computed from the same rows the list renders, so
 * they can never disagree with what is visible underneath them. A number that is
 * derived from a different source than the thing it describes is how a dashboard
 * starts lying.
 */
export function BoardView(): ReactNode {
  const rows = useQuery(api.board, { limit: 50 }) as CaseRow[] | undefined;

  if (rows === undefined) {
    return <Reading />;
  }

  if (rows.length === 0) {
    return (
      <Empty>
        No cases yet. Open one, and its requirements are frozen before any call is placed.
      </Empty>
    );
  }

  const verified = rows.filter((r) => stateSettled(r.state));
  const abandoned = rows.filter((r) => r.state === "ABANDONED");
  const open = rows.length - verified.length - abandoned.length;
  const releases = verified.filter((r) => r.verifiedAt).length;

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Cases" value={String(rows.length)} note="opened here" />
        <Kpi
          label="Still open"
          value={String(open)}
          note={abandoned.length > 0 ? `${abandoned.length} given up on` : "no read-back has closed them"}
        />
        <Kpi label="Verified" value={String(verified.length)} note="the other side's record arrived" />
        <Kpi
          label="Last verification"
          value={verified[0]?.verifiedAt ? when(verified[0].verifiedAt).slice(0, 10) : "—"}
          note={verified[0]?.verifiedAt ? `at ${when(verified[0].verifiedAt).slice(11)}` : "none yet"}
        />
      </div>

      <div className="space-y-2.5">
        {rows.map((row) => (
          <a
            key={row.ref}
            href={`?view=case&ref=${encodeURIComponent(row.ref)}`}
            className="group block no-underline"
          >
            <Panel className="transition-colors duration-300 hover:bg-[#12141a]">
              <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5">
                    <span className="data text-[0.9375rem] text-white">{row.ref}</span>
                    <StateChip state={row.state} />
                  </div>
                  <p className="mt-1.5 text-sm text-neutral-400">
                    {row.counterparty}
                    {row.channel ? ` · opened on ${row.channel}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-5">
                  <div className="text-right">
                    <p className="data text-sm text-white">
                      {money(row.amountClaimedUnits, row.currency)}
                    </p>
                    <p className="mt-1 text-[11px] text-neutral-400">
                      opened {when(row.openedAt)}
                    </p>
                  </div>
                  <span className="text-neutral-400 transition-colors duration-300 group-hover:text-accent">
                    →
                  </span>
                </div>
              </div>
            </Panel>
          </a>
        ))}
      </div>

      <InsightsPanel />

      <p className="text-[11px] text-neutral-400">
        Showing all {rows.length} cases, newest first. {releases} released a charge, and nothing
        releases one except a grade that passed.
      </p>
    </div>
  );
}

/**
 * What the numbers say.
 *
 * The question the product exists to answer is not how many cases there are but
 * whether this is working and where it is stuck, so this reads outcomes: how long
 * a closure takes, why cases are being refused, how much chasing it took, and who
 * keeps coming back. Every figure is computed from the same rows the list above
 * renders, so the summary cannot disagree with the detail.
 */
function InsightsPanel(): ReactNode {
  const insights = useQuery(api.insights, {}) as
    | {
        total: number;
        medianHoursToClosure: number | null;
        chases: { cases: number; total: number };
        refusalReasons: Array<{ reason: string; count: number }>;
        counterparties: Array<{ name: string; cases: number }>;
      }
    | undefined;

  if (!insights) return null;

  const closure =
    insights.medianHoursToClosure === null
      ? "—"
      : insights.medianHoursToClosure < 1
        ? `${Math.round(insights.medianHoursToClosure * 60)} min`
        : `${insights.medianHoursToClosure.toFixed(1)} h`;

  return (
    <Panel>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-[1.0625rem] text-white">What the numbers say</h2>
        <span className="text-[11px] text-neutral-500">
          computed from the same rows as the list, so the two cannot disagree
        </span>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-5 lg:grid-cols-4">
        <div>
          <p className="text-[11px] tracking-wide text-neutral-500 uppercase">Median to closure</p>
          <p className="data mt-2 text-[1.125rem] text-white">{closure}</p>
          <p className="mt-1 text-[11px] text-neutral-500">from opening to verified</p>
        </div>
        <div>
          <p className="text-[11px] tracking-wide text-neutral-500 uppercase">Chases sent</p>
          <p className="data mt-2 text-[1.125rem] text-white">{insights.chases.total}</p>
          <p className="mt-1 text-[11px] text-neutral-500">
            across {insights.chases.cases} case{insights.chases.cases === 1 ? "" : "s"}
          </p>
        </div>
        <div className="col-span-2">
          <p className="text-[11px] tracking-wide text-neutral-500 uppercase">Why closures are refused</p>
          <ul className="mt-2 space-y-1">
            {insights.refusalReasons.length === 0 && (
              <li className="text-[12px] text-neutral-500">nothing has been refused yet</li>
            )}
            {insights.refusalReasons.slice(0, 3).map((row) => (
              <li key={row.reason} className="text-[12px] text-neutral-400">
                <span className="data text-white">{row.count}×</span> {row.reason}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {insights.counterparties.length > 0 && (
        <div className="mt-5 border-t border-white/[0.06] pt-4">
          <p className="text-[11px] tracking-wide text-neutral-500 uppercase">Who keeps coming back</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {insights.counterparties.map((row) => (
              <Chip key={row.name}>
                {row.name} · {row.cases}
              </Chip>
            ))}
          </div>
        </div>
      )}
    </Panel>
  );
}

function Kpi({ label, value, note }: { label: string; value: string; note: string }): ReactNode {
  return (
    <div className="rounded-[1.25rem] bg-white/[0.025] p-[4px]">
      <div className="rounded-[calc(1.25rem-4px)] bg-[#0d0e11] px-5 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
        <p className="text-[11px] tracking-wide text-neutral-500 uppercase">{label}</p>
        <p className="data mt-2.5 text-[1.375rem] leading-none text-white">{value}</p>
        <p className="mt-2 text-[11px] text-neutral-400">{note}</p>
      </div>
    </div>
  );
}

/** Settled reads as settled. Open reads as open — never the same badge twice. */
export function StateChip({ state }: { state: string }): ReactNode {
  const settled = stateSettled(state);
  const abandoned = state === "ABANDONED";

  // Three tones, because there are three things a case can be: settled, still
  // being worked, or given up on. A reader should not have to open the case to
  // find out which.
  const tone = settled
    ? "bg-accent/[0.1] text-accent shadow-[inset_0_0_0_1px_rgba(163,230,53,0.2)]"
    : abandoned
      ? "bg-transparent text-neutral-500 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.09)]"
      : "bg-white/[0.05] text-neutral-300 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.07)]";

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-medium ${tone}`}>
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          settled ? "bg-accent" : abandoned ? "bg-neutral-600" : "bg-neutral-400"
        }`}
      />
      {stateLabel(state)}
    </span>
  );
}

export function Reading({ what = "the deployment" }: { what?: string }): ReactNode {
  return (
    <Panel>
      <div className="flex items-center gap-3 text-sm text-neutral-400">
        <Chip accent>reading</Chip>
        <span>Waiting on {what}…</span>
      </div>
      <p className="mt-3 text-[11px] text-neutral-600">
        Nothing is shown until the deployment answers. There is no sample data in this app.
      </p>
    </Panel>
  );
}

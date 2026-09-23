"use client";

import { useQuery } from "convex/react";
import { api, siteConfig } from "@/lib/backend";
import { verifyConfig } from "@/lib/config";
import { Chip, Panel } from "@/components/fabric/ui";
import { Reading } from "@/components/board/board";
import type { ReactNode } from "react";
import { ChangePassphrase, OperatorGate } from "./session";

/**
 * What is switched on, what is not, and how to check both.
 *
 * The two states have to look different at a glance: a row of pills where "off"
 * is styled like "on" tells a reader nothing, and the whole point of this screen
 * is that the answer is legible without reading every word. On is accent and
 * solid; off is dim, outlined, and says off.
 *
 * The commands below are the ones that were run, and the output beside them is
 * what came back — including the one that reports false.
 */
export function IntegrationsView(): ReactNode {
  const health = useQuery(api.health, {}) as Record<string, boolean> | undefined;

  return (
    <div className="space-y-6">
      <Panel>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-[1.0625rem] text-white">The deployment, reporting itself</h2>
          <a
            className="data text-[11px] text-neutral-500 no-underline hover:text-neutral-300"
            href={siteConfig.health}
          >
            {siteConfig.health}
          </a>
        </div>

        {health === undefined ? (
          <div className="mt-5">
            <Reading what="the health endpoint" />
          </div>
        ) : (
          <>
            <div className="mt-5 flex flex-wrap gap-2">
              {Object.entries(health)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([name, on]) => (
                  <span
                    key={name}
                    className={`inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[11px] ${
                      on
                        ? "bg-accent/[0.1] text-accent shadow-[inset_0_0_0_1px_rgba(163,230,53,0.22)]"
                        : "bg-white/[0.02] text-neutral-500 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${on ? "bg-accent" : "bg-neutral-600"}`}
                    />
                    <span className="data">{name}</span>
                    <span className={on ? "text-accent/70" : "text-neutral-600"}>
                      {on ? "on" : "off"}
                    </span>
                  </span>
                ))}
            </div>

            <div className="mt-6 space-y-2 border-t border-white/[0.06] pt-5 text-[12px] leading-relaxed text-neutral-400">
              <p>
                <span className="text-neutral-200">knowledge</span> is off because that account has
                no organization to attach it to. It is reported that way rather than hidden, and
                nothing in the pipeline depends on it.
              </p>
              <p>
                <span className="text-neutral-200">extraction</span> is keyed, and the pipeline
                prefers the call platform&rsquo;s own reading of a call — so a graded run does not
                require a model key to be present at all.
              </p>
            </div>
          </>
        )}
      </Panel>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel>
          <h2 className="text-[1.0625rem] text-white">Check it yourself</h2>
          <p className="mt-2 text-[12px] leading-relaxed text-neutral-500">
            These are reads. They cannot write, close a case, or move a charge.
          </p>
          <div className="mt-5 space-y-5">
            {verifyConfig.checks.map((check) => (
              <div key={check.command}>
                <p className="text-[12px] text-neutral-300">{check.label}</p>
                <pre className="data mt-2 overflow-x-auto rounded-xl bg-black/45 px-3.5 py-3 text-[11px] leading-relaxed text-neutral-300 shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]">
                  {check.command}
                </pre>
                <pre className="data mt-1.5 overflow-x-auto rounded-xl bg-black/25 px-3.5 py-3 text-[11px] leading-relaxed text-neutral-500 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)]">
                  {check.output}
                </pre>
              </div>
            ))}
          </div>
          <p className="mt-5 text-[11px] leading-relaxed text-neutral-500">
            {verifyConfig.footnote}
          </p>
        </Panel>

        <div className="space-y-6">
          <Panel>
            <h2 className="text-[1.0625rem] text-white">The phone line</h2>
            <p className="mt-2 text-[12px] leading-relaxed text-neutral-500">
              A case is opened on a call. Nothing is stated on that call that was not fetched first
              and filed against the case.
            </p>
            <div className="mt-5 space-y-3 text-[12px] text-neutral-300">
              <div className="flex items-center justify-between gap-3">
                <span className="text-neutral-500">Number</span>
                <a
                  className="data text-neutral-200 no-underline hover:text-white"
                  href={`tel:${siteConfig.phone.replace(/[^0-9]/g, "")}`}
                >
                  {siteConfig.phone}
                </a>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-neutral-500">Tools on the call</span>
                <span className="data text-neutral-300">read_source · file_promise</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-neutral-500">Reading of the call</span>
                <span className="data text-neutral-300">structured, by the platform</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-neutral-500">Callbacks</span>
                <span className="data text-neutral-300">signed, fail-closed</span>
              </div>
            </div>
            <p className="mt-5 text-[11px] leading-relaxed text-neutral-500">
              Both callbacks refuse everything when their shared secret is unset, so an
              unconfigured deployment records nothing rather than accepting anything.
            </p>
          </Panel>

          <Panel>
            <h2 className="text-[1.0625rem] text-white">What a read can and cannot do</h2>
            <div className="mt-4 space-y-2.5 text-[12px] leading-relaxed">
              <div className="flex items-start gap-2.5">
                <Chip accent>can</Chip>
                <p className="text-neutral-300">
                  add evidence of the other side&rsquo;s record, and satisfy a requirement that asks
                  for that kind
                </p>
              </div>
              <div className="flex items-start gap-2.5">
                <Chip>cannot</Chip>
                <p className="text-neutral-400">
                  satisfy a requirement that asks for their record by filing our own document
                </p>
              </div>
              <div className="flex items-start gap-2.5">
                <Chip>cannot</Chip>
                <p className="text-neutral-400">
                  close a case, or release a charge — a grade that passed does the second one, and
                  nothing else does
                </p>
              </div>
            </div>
                  <OperatorGate label="Sign in to change the operator passphrase">
                    <ChangePassphrase />
                  </OperatorGate>
      </Panel>
        </div>
      </div>
    </div>
  );
}

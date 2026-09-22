"use client";

import { BailiffMark } from "@/components/logo";
import { Chip } from "@/components/fabric/ui";
import { siteConfig } from "@/lib/backend";
import type { ReactNode } from "react";

/**
 * The app shell.
 *
 * Navigation is a set of query-parameter links rather than a router, because the
 * whole app is one exported page: a click reloads the page with `?view=` and the
 * board re-reads the deployment. That is a deliberate trade — the URL is
 * shareable and a refresh never loses the case you were reading, and there is no
 * client-side cache to go stale while a pipeline run is writing.
 */

export type ViewKey = "board" | "new" | "case" | "integrations";

const NAV: Array<{ key: ViewKey; label: string; href: string }> = [
  { key: "board", label: "Case board", href: "?view=board" },
  { key: "new", label: "Open a case", href: "?view=new" },
  { key: "integrations", label: "Integrations", href: "?view=integrations" },
];

export function Shell({
  view,
  title,
  lede,
  children,
}: {
  view: ViewKey;
  title: string;
  lede?: string;
  children: ReactNode;
}): ReactNode {
  const host = siteConfig.cloud.replace(/^https?:\/\//, "");

  return (
    <div className="min-h-screen bg-[#08090b] text-neutral-200">
      <div className="mx-auto flex max-w-[110rem] flex-col lg:flex-row">
        <aside className="shrink-0 border-b border-white/[0.06] px-6 py-6 lg:min-h-screen lg:w-[17.5rem] lg:border-r lg:border-b-0 lg:px-7 lg:py-9">
          <a href="/" className="inline-flex items-center gap-2.5 text-white no-underline">
            <BailiffMark className="h-[1.05em] w-auto" />
            <span className="text-[1.0625rem] leading-none font-medium tracking-tight">bailiff</span>
          </a>

          <p className="mt-6 text-[0.8125rem] leading-relaxed text-neutral-500">
            A case keeps its requirement set frozen at intake, and closes only when the other
            side&rsquo;s own record satisfies it.
          </p>

          <nav className="mt-8 flex flex-row gap-2 lg:flex-col lg:gap-1">
            {NAV.map((item) => {
              const active = item.key === view || (view === "case" && item.key === "board");
              return (
                <a
                  key={item.key}
                  href={item.href}
                  className={`rounded-xl px-3.5 py-2.5 text-sm no-underline transition-colors duration-300 ${
                    active
                      ? "bg-white/[0.07] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                      : "text-neutral-400 hover:bg-white/[0.04] hover:text-white"
                  }`}
                >
                  {item.label}
                </a>
              );
            })}
          </nav>

          <div className="mt-8 hidden lg:mt-12 lg:block">
            <div className="flex items-center gap-2">
              <Chip accent>live</Chip>
              <span className="text-[11px] text-neutral-500">deployment</span>
            </div>
            <p className="data mt-2.5 text-[11px] leading-relaxed break-all text-neutral-500">
              {host}
            </p>
            <p className="mt-5 text-[11px] text-neutral-600">
              Cases open on the phone line at{" "}
              <a className="text-neutral-400 no-underline hover:text-white" href="tel:+14582765251">
                {siteConfig.phone}
              </a>
            </p>
          </div>
        </aside>

        <main className="min-w-0 flex-1 px-6 py-8 lg:px-10 lg:py-10">
          <header className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-[2rem] leading-tight text-white">{title}</h1>
              {lede && <p className="mt-2 max-w-[62ch] text-sm leading-relaxed text-neutral-400">{lede}</p>}
            </div>
            <a
              href="/case"
              className="data text-[11px] text-neutral-500 no-underline hover:text-neutral-300"
            >
              /cases · /case?ref=
            </a>
          </header>

          <div className="mt-8">{children}</div>
        </main>
      </div>
    </div>
  );
}

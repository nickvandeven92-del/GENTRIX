"use client";

import { useState } from "react";
import type { SalesDealRow } from "@/lib/data/sales-deals";
import { effectiveDealFollowUpDueAt } from "@/lib/sales-os/deal-step-log";
import { formatEURFromCents } from "@/lib/sales-os/format-money";
import { PipelineBoardClient } from "@/components/sales-os/overview/pipeline-board-client";
import type { PipelineDealAssistContext } from "@/lib/sales-os/pipeline-deal-assist";
import { cn } from "@/lib/utils";

type Tab = "pipeline" | "forecast";

export type { PipelineDealAssistContext };

export function PipelineSection({
  deals,
  assistContext,
}: {
  deals: SalesDealRow[];
  assistContext?: PipelineDealAssistContext;
}) {
  const [tab, setTab] = useState<Tab>("pipeline");
  const [asOfMs] = useState(() => Date.now());

  const open = deals.filter((d) => d.stage !== "won" && d.stage !== "lost");
  const committedCents = deals.filter((d) => d.stage === "won").reduce((a, d) => a + d.value_cents, 0);
  const weighted = open.reduce((a, d) => {
    const p = d.probability != null ? d.probability / 100 : 0.35;
    return a + Math.round(d.value_cents * p);
  }, 0);
  const riskCents = open.filter((d) => d.at_risk).reduce((a, d) => a + d.value_cents, 0);

  const now = asOfMs;
  const monthEnd = new Date(now);
  monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1, 1);
  monthEnd.setUTCDate(0);
  const likelyThisMonth = open
    .filter((d) => {
      const eff = effectiveDealFollowUpDueAt(d);
      if (!eff) return false;
      const t = new Date(eff).getTime();
      return !Number.isNaN(t) && t <= monthEnd.getTime() && t >= now - 7 * 86_400_000;
    })
    .reduce((a, d) => a + d.value_cents, 0);

  return (
    <section id="pipeline" className="scroll-mt-8 space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-400 dark:text-zinc-500">Pijplijn</h2>
          <p className="mt-1 text-xl font-semibold tracking-tight text-neutral-950 dark:text-zinc-50 md:text-2xl">Deals</p>
          <p className="mt-0.5 max-w-lg text-xs leading-snug text-neutral-500 dark:text-zinc-400">
            Open deals per fase; wijzigingen worden direct opgeslagen.
          </p>
        </div>
        <div className="flex rounded-lg bg-neutral-100/80 p-0.5 dark:bg-zinc-800/80">
          {(
            [
              ["pipeline", "Board"],
              ["forecast", "Prognose"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                "rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors",
                tab === id
                  ? "bg-white text-neutral-950 shadow-sm dark:bg-zinc-700 dark:text-zinc-50"
                  : "text-neutral-500 hover:text-neutral-800 dark:text-zinc-400 dark:hover:text-zinc-200",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === "pipeline" ? (
        <PipelineBoardClient initialDeals={deals} assistContext={assistContext} />
      ) : (
        <div className="sales-os-forecast-shell rounded-lg bg-neutral-50/40 p-4 ring-1 ring-neutral-950/[0.04] dark:bg-zinc-900/50 dark:ring-white/10">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wide text-neutral-400">Toegezegd (gewonnen)</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums text-neutral-950">
                {formatEURFromCents(committedCents)}
              </p>
              <p className="mt-1 text-[11px] text-neutral-500">Som deals in fase gewonnen</p>
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wide text-neutral-400">Gewogen pijplijn</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums text-neutral-950">{formatEURFromCents(weighted)}</p>
              <p className="mt-1 text-[11px] text-neutral-500">Open × kans (35% standaard)</p>
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wide text-neutral-400">Waarschijnlijk deze maand</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums text-neutral-950">
                {formatEURFromCents(likelyThisMonth)}
              </p>
              <p className="mt-1 text-[11px] text-neutral-500">Deadline-heuristiek</p>
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wide text-neutral-400">Risico (waarde)</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums text-amber-900">{formatEURFromCents(riskCents)}</p>
              <p className="mt-1 text-[11px] text-neutral-500">Open met at_risk</p>
            </div>
          </div>
          <p className="mt-3 border-t border-neutral-200/60 pt-2 text-[10px] text-neutral-400">
            Filters volgen later op dezelfde dataset.
          </p>
        </div>
      )}
    </section>
  );
}

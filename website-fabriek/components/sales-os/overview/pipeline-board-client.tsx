"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { SalesDealRow } from "@/lib/data/sales-deals";
import { effectiveDealNextStepMessage } from "@/lib/sales-os/deal-step-log";
import { DEAL_STAGE_LABELS, SALES_DEAL_STAGES, type SalesDealStage } from "@/lib/sales-os/deal-stages";
import { formatEURFromCents } from "@/lib/sales-os/format-money";
import type { PipelineDealAssistContext } from "@/lib/sales-os/pipeline-deal-assist";
import { DealCardQuickActions } from "@/components/sales-os/overview/deal-card-quick-actions";
import { cn } from "@/lib/utils";

const COL_WIDTH = "min-w-[200px] w-[200px] sm:min-w-[220px] sm:w-[220px] md:min-w-[240px] md:w-[240px]";

export function PipelineBoardClient({
  initialDeals,
  assistContext,
}: {
  initialDeals: SalesDealRow[];
  assistContext?: PipelineDealAssistContext;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function patchStage(id: string, stage: SalesDealStage) {
    setBusy(id);
    try {
      const res = await fetch(`/api/admin/sales-os/deals/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage }),
      });
      const j = (await res.json()) as { ok?: boolean };
      if (j.ok) router.refresh();
    } finally {
      setBusy(null);
    }
  }

  const selectClass =
    "mt-2 w-full rounded-md border-0 bg-neutral-100/80 py-1.5 pl-2 text-[11px] text-neutral-900 focus:ring-1 focus:ring-neutral-950/15";

  return (
    <div className="sales-os-board-shell min-w-0 max-w-full rounded-2xl bg-neutral-50/60 p-1 ring-1 ring-neutral-950/[0.05]">
      <div
        className="sales-os-scroll-x max-w-full overflow-x-auto overscroll-x-contain px-1 pb-2 pt-1"
        role="list"
        aria-label="Deal-pijplijn"
      >
        <div className="flex w-max gap-0 pr-2">
        {SALES_DEAL_STAGES.map((lane) => {
          const inLane = initialDeals.filter((d) => d.stage === lane);
          return (
            <div
              key={lane}
              className={cn(
                COL_WIDTH,
                "shrink-0 border-l border-neutral-200/50 px-3 first:border-l-0 first:pl-2",
              )}
            >
              <div className="mb-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-400 dark:text-zinc-500">
                  {DEAL_STAGE_LABELS[lane]}
                </p>
                <p className="text-[11px] tabular-nums text-neutral-500 dark:text-zinc-400">{inLane.length} deals</p>
              </div>
              <div
                className={cn(
                  "flex max-h-[min(70vh,520px)] flex-col gap-2 overflow-y-auto pr-0.5 sales-os-scroll-x",
                  inLane.length > 4 && "pb-1",
                )}
              >
                {inLane.map((d) => (
                  <article
                    key={d.id}
                    className="sales-os-card-glass shrink-0 rounded-xl bg-white p-3 ring-1 ring-neutral-950/[0.06] transition-shadow hover:ring-neutral-950/[0.1]"
                  >
                    <p className="text-[12px] font-semibold leading-tight text-neutral-950 dark:text-zinc-50">{d.company_name}</p>
                    <p className="mt-0.5 text-[13px] font-semibold tabular-nums text-neutral-900 dark:text-zinc-100">
                      {formatEURFromCents(d.value_cents)}
                    </p>
                    {d.at_risk ? (
                      <span className="mt-1 inline-block text-[9px] font-semibold uppercase tracking-wide text-amber-700">
                        Risico
                      </span>
                    ) : null}
                    <p className="mt-2 text-[10px] text-neutral-400 dark:text-zinc-500">{d.owner_label ?? "—"}</p>
                    <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-neutral-600 dark:text-zinc-400">
                      {effectiveDealNextStepMessage(d) ?? "Geen volgende stap"}
                    </p>
                    <label className="sr-only" htmlFor={`stage-${d.id}`}>
                      Fase voor {d.company_name}
                    </label>
                    <select
                      id={`stage-${d.id}`}
                      disabled={busy === d.id}
                      value={d.stage}
                      onChange={(e) => void patchStage(d.id, e.target.value as SalesDealStage)}
                      className={cn(selectClass, busy === d.id && "opacity-50")}
                    >
                      {SALES_DEAL_STAGES.map((s) => (
                        <option key={s} value={s}>
                          {DEAL_STAGE_LABELS[s]}
                        </option>
                      ))}
                    </select>
                    <DealCardQuickActions
                      dealId={d.id}
                      companyName={d.company_name}
                      clientSlug={
                        d.client_id ? (assistContext?.clientSlugByClientId[d.client_id] ?? null) : null
                      }
                      contactEmail={assistContext?.contactEmailByDealId[d.id] ?? null}
                    />
                  </article>
                ))}
                {inLane.length === 0 ? (
                  <p className="py-8 text-center text-[10px] text-neutral-300">—</p>
                ) : null}
              </div>
            </div>
          );
        })}
        </div>
      </div>
    </div>
  );
}

import type { ClientHealthViewRow } from "@/lib/sales-os/build-client-health-rows";
import { ClientHealthRowActions } from "@/components/sales-os/overview/client-health-row-actions";
import { cn } from "@/lib/utils";

function riskColor(r: ClientHealthViewRow["churnRisk"]) {
  if (r === "high") return "text-rose-600";
  if (r === "med") return "text-amber-600";
  return "text-emerald-700";
}

function churnNl(r: ClientHealthViewRow["churnRisk"]) {
  if (r === "high") return "Hoog";
  if (r === "med") return "Middel";
  return "Laag";
}

function ContextLines({ lines }: { lines: string[] }) {
  return (
    <ul className="space-y-0.5" aria-label="Assistent-context">
      {lines.map((line, i) => (
        <li key={i} className="text-[10px] leading-snug text-neutral-600 dark:text-zinc-400">
          {line}
        </li>
      ))}
    </ul>
  );
}

export function ClientHealthBoard({ rows }: { rows: ClientHealthViewRow[] }) {
  const sorted = [...rows].sort((a, b) => {
    const riskOrder = { high: 0, med: 1, low: 2 };
    const rd = riskOrder[a.churnRisk] - riskOrder[b.churnRisk];
    if (rd !== 0) return rd;
    return b.health - a.health;
  });

  return (
    <section id="gezondheid" aria-label="Klantgezondheid" className="scroll-mt-8 space-y-2">
      <div>
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-400 dark:text-zinc-500">Klanten</h2>
        <p className="mt-0.5 text-lg font-semibold tracking-tight text-neutral-950 dark:text-zinc-50 md:text-xl">Gezondheid</p>
        <p className="mt-0.5 max-w-lg text-xs leading-snug text-neutral-500 dark:text-zinc-400">
          Churn, betaling en context — acties per rij.
        </p>
      </div>
      <div className="sales-os-table-shell divide-y divide-neutral-100 rounded-2xl ring-1 ring-neutral-950/[0.04] dark:divide-zinc-700/80 dark:ring-white/10">
        {sorted.map((c) => (
          <div
            key={c.id}
            className="grid grid-cols-[1fr_auto] items-start gap-2 px-3 py-2.5 transition-colors hover:bg-neutral-50/50 dark:hover:bg-white/5 sm:grid-cols-[minmax(0,1.1fr)_repeat(5,minmax(0,1fr))_auto] xl:grid-cols-[minmax(0,1fr)_repeat(5,minmax(0,0.85fr))_minmax(0,10.5rem)_minmax(0,7.25rem)]"
          >
            <div className="min-w-0 sm:col-span-1">
              <p className="truncate text-[13px] font-semibold text-neutral-950 dark:text-zinc-50">{c.name}</p>
              <p className="truncate text-[11px] text-neutral-500 dark:text-zinc-400">{c.plan}</p>
              <div className="mt-2 xl:hidden">
                <p className="text-[9px] font-medium uppercase tracking-wide text-neutral-400">Context</p>
                <div className="mt-0.5">
                  <ContextLines lines={c.contextBullets} />
                </div>
              </div>
            </div>
            <div className="hidden text-right sm:block">
              <p className="text-[9px] font-medium uppercase tracking-wide text-neutral-400">Omzet</p>
              <p className="text-[11px] font-medium tabular-nums text-neutral-700">{c.revenue}</p>
            </div>
            <div className="hidden sm:block">
              <p className="text-[9px] font-medium uppercase tracking-wide text-neutral-400">Website</p>
              <p className="text-[11px] text-neutral-600">{c.websiteStatus}</p>
            </div>
            <div className="hidden sm:block">
              <p className="text-[9px] font-medium uppercase tracking-wide text-neutral-400">Betaling</p>
              <p className="text-[11px] text-neutral-600">{c.payment}</p>
            </div>
            <div className="hidden sm:block">
              <p className="text-[9px] font-medium uppercase tracking-wide text-neutral-400">Score</p>
              <p className="text-[11px] font-semibold tabular-nums text-neutral-800">{c.health}</p>
            </div>
            <div className="hidden sm:block">
              <p className="text-[9px] font-medium uppercase tracking-wide text-neutral-400">Churn</p>
              <p className={cn("text-[11px] font-semibold", riskColor(c.churnRisk))}>{churnNl(c.churnRisk)}</p>
            </div>
            <div className="hidden xl:block">
              <p className="text-[9px] font-medium uppercase tracking-wide text-neutral-400">Context</p>
              <div className="mt-0.5">
                <ContextLines lines={c.contextBullets} />
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="text-[10px] text-neutral-400">{c.lastActivity}</span>
              <ClientHealthRowActions
                clientId={c.id}
                clientName={c.name}
                billingEmail={c.billingEmail}
                slug={c.slug}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

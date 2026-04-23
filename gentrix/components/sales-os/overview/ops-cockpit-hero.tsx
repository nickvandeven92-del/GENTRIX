import Link from "next/link";
import { ArrowRight, Briefcase, PanelTop, UserPlus } from "lucide-react";
import type { OpsPrioritySignal, RevenueSnapshotMetrics } from "@/lib/sales-os/signals";
import { formatEURFromCents } from "@/lib/sales-os/format-money";
import { cn } from "@/lib/utils";

type OpsCockpitHeroProps = {
  priorities: OpsPrioritySignal[];
  revenue: RevenueSnapshotMetrics;
  openTasksCount: number;
  /** Open deals met vastgelegde stap / opvolgdatum (zelfde bron als sectie Deal-opvolging). */
  dealFollowUpCount: number;
};

function severitySummary(items: OpsPrioritySignal[]) {
  const crit = items.filter((i) => i.severity === "critical").length;
  const att = items.filter((i) => i.severity === "attention").length;
  if (crit > 0) return { label: "Actie nodig", tone: "text-rose-700" as const };
  if (att > 0) return { label: "Aandacht", tone: "text-amber-800" as const };
  return { label: "Gezond", tone: "text-neutral-600" as const };
}

export function OpsCockpitHero({ priorities, revenue, openTasksCount, dealFollowUpCount }: OpsCockpitHeroProps) {
  const primary = priorities[0];
  const summary = severitySummary(priorities);

  const actions = [
    { href: "/admin/ops/leads", label: "Lead", icon: UserPlus },
    { href: "/admin/ops/deals", label: "Deal", icon: Briefcase },
    { href: "/admin/ops/studio", label: "Site-studio", icon: PanelTop },
  ] as const;

  return (
    <header className="border-b border-neutral-200/50 pb-4 dark:border-white/10">
      {/* Grid i.p.v. flex-row: bij flex vocht de rechterkolom (shrink-0 + brede grid-inhoud) met flex-1+min-w-0 links
          om ruimte → linkerkolom werd een smalle spleet met overlap. Twee gelijke sporen geeft altijd leesbare breedte. */}
      <div className="grid gap-5 lg:grid-cols-2 lg:items-center lg:gap-6 xl:gap-8">
        <div className="min-w-0 max-w-2xl space-y-3 xl:max-w-none">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-neutral-400 dark:text-zinc-500">Vandaag</p>
          <h1 className="text-balance text-3xl font-semibold tracking-tight text-neutral-950 dark:text-zinc-50 md:text-4xl">
            Commandocentrum
          </h1>
          <p className="text-pretty text-sm leading-snug text-neutral-500 dark:text-zinc-400">
            Leads, deals, sites en opvolging in één overzicht.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            {actions.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="sales-os-glass-primary-btn inline-flex items-center gap-2 rounded-lg border border-transparent bg-neutral-950 px-3.5 py-2 text-[13px] font-medium text-white transition-colors hover:bg-neutral-800"
              >
                <Icon className="size-3.5 opacity-90" aria-hidden />
                {label}
              </Link>
            ))}
            <Link
              href="/admin/ops/tasks"
              className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[13px] font-medium text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-zinc-100"
            >
              Taken
              <ArrowRight className="size-3.5 opacity-60" aria-hidden />
            </Link>
          </div>
        </div>

        <div className="grid min-w-0 w-full gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-1">
            <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-400 dark:text-zinc-500">Signalen</p>
            <p className={cn("text-2xl font-semibold tabular-nums tracking-tight", summary.tone)}>{summary.label}</p>
            <p className="line-clamp-2 text-[12px] leading-snug text-neutral-500 dark:text-zinc-400">{primary?.detail ?? "—"}</p>
            <Link
              href="#prioriteiten"
              className="inline-block pt-1 text-[12px] font-medium text-neutral-900 underline decoration-neutral-300 underline-offset-4 hover:decoration-neutral-900 dark:text-zinc-100 dark:decoration-zinc-600 dark:hover:decoration-zinc-300"
            >
              Prioriteiten bekijken
            </Link>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-400 dark:text-zinc-500">Open pijplijn</p>
            <p className="text-2xl font-semibold tabular-nums tracking-tight text-neutral-950 dark:text-zinc-50">
              {formatEURFromCents(revenue.openPipelineCents)}
            </p>
            <p className="text-[12px] text-neutral-500 dark:text-zinc-400">
              Gewogen {formatEURFromCents(revenue.weightedPipelineCents)}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-400 dark:text-zinc-500">Deal-opvolging</p>
            <p className="text-2xl font-semibold tabular-nums tracking-tight text-neutral-950 dark:text-zinc-50">{dealFollowUpCount}</p>
            <p className="text-[12px] text-neutral-500 dark:text-zinc-400">Stappen met datum (per open deal)</p>
            <Link
              href="#deal-opvolging"
              className="inline-block pt-1 text-[12px] font-medium text-neutral-900 underline decoration-neutral-300 underline-offset-4 hover:decoration-neutral-900 dark:text-zinc-100 dark:decoration-zinc-600 dark:hover:decoration-zinc-300"
            >
              Lijst bekijken
            </Link>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-400 dark:text-zinc-500">Open taken</p>
            <p className="text-2xl font-semibold tabular-nums tracking-tight text-neutral-950 dark:text-zinc-50">{openTasksCount}</p>
            <p className="text-[12px] text-neutral-500 dark:text-zinc-400">Apart van deal-stappen</p>
            <Link
              href="/admin/ops/tasks"
              className="inline-block pt-1 text-[12px] font-medium text-neutral-900 underline decoration-neutral-300 underline-offset-4 hover:decoration-neutral-900 dark:text-zinc-100 dark:decoration-zinc-600 dark:hover:decoration-zinc-300"
            >
              Naar taken
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}

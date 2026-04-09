import type { Metadata } from "next";
import { getSalesInsightsStats } from "@/lib/data/sales-insights-stats";
import { SALES_RULE_DESCRIPTIONS } from "@/lib/sales-os/rules";

export const metadata: Metadata = {
  title: "Inzichten",
};

const statCard = "rounded-lg border border-neutral-200 bg-white px-4 py-3";

export default async function SalesOpsInsightsPage() {
  const stats = await getSalesInsightsStats();

  return (
    <div className="mx-auto max-w-[900px] space-y-8">
      <section>
        <h2 className="text-sm font-semibold text-neutral-900">Database-activiteit</h2>
        <p className="mt-1 text-[11px] text-neutral-500">Geen gegenereerde verhalen — alleen tellingen.</p>
        {stats ? (
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className={statCard}>
              <dt className="text-[10px] uppercase text-neutral-500">Site-generaties (totaal)</dt>
              <dd className="mt-1 text-xl font-semibold tabular-nums text-neutral-900">{stats.generationRunsTotal}</dd>
            </div>
            <div className={statCard}>
              <dt className="text-[10px] uppercase text-neutral-500">Generaties (30 dagen)</dt>
              <dd className="mt-1 text-xl font-semibold tabular-nums text-neutral-900">{stats.generationRunsLast30d}</dd>
            </div>
            <div className={statCard}>
              <dt className="text-[10px] uppercase text-neutral-500">Open deals</dt>
              <dd className="mt-1 text-xl font-semibold tabular-nums text-neutral-900">{stats.dealsOpen}</dd>
            </div>
            <div className={statCard}>
              <dt className="text-[10px] uppercase text-neutral-500">Gewonnen deals (alle tijd)</dt>
              <dd className="mt-1 text-xl font-semibold tabular-nums text-neutral-900">{stats.dealsWonAllTime}</dd>
            </div>
            <div className={`${statCard} sm:col-span-2`}>
              <dt className="text-[10px] uppercase text-neutral-500">Openstaande taken</dt>
              <dd className="mt-1 text-xl font-semibold tabular-nums text-neutral-900">{stats.tasksOpen}</dd>
            </div>
          </dl>
        ) : (
          <p className="mt-4 text-sm text-neutral-500">Geen toegang tot site_generation_runs of tabellen ontbreken.</p>
        )}
      </section>

      <section className="rounded-lg border border-neutral-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-neutral-900">Actieve businessregels (prioriteitenrail)</h2>
        <ul className="mt-3 list-inside list-disc space-y-1 text-[12px] text-neutral-600">
          {SALES_RULE_DESCRIPTIONS.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}

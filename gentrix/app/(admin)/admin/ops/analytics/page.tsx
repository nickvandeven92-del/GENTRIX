import type { Metadata } from "next";
import { getSiteAnalyticsDashboard } from "@/lib/data/get-site-analytics-dashboard";

export const metadata: Metadata = {
  title: "Site-analytics",
};

const card = "rounded-lg border border-neutral-200 bg-white px-4 py-3 dark:border-neutral-800 dark:bg-neutral-950";

function sortEntries(r: Record<string, number>, limit = 20): [string, number][] {
  return Object.entries(r)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
}

export default async function SiteAnalyticsOpsPage() {
  const stats = await getSiteAnalyticsDashboard(30);

  return (
    <div className="mx-auto max-w-[960px] space-y-8">
      <header>
        <h1 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Site-analytics</h1>
        <p className="mt-1 text-xs text-neutral-500">
          Eerstepartij meetdata van publieke sites (<code className="rounded bg-neutral-100 px-1 text-[11px] dark:bg-neutral-900">/site</code>
          ). Laatste 30 dagen.
        </p>
      </header>

      {!stats ? (
        <p className="text-sm text-neutral-500">
          Geen toegang tot <code className="rounded bg-neutral-100 px-1 text-xs dark:bg-neutral-900">site_analytics_events</code> of
          migratie nog niet toegepast. Draai Supabase-migraties en controleer RLS.
        </p>
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-2">
            <div className={card}>
              <div className="text-[10px] font-medium uppercase text-neutral-500">Page views</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-50">
                {stats.page_views}
              </div>
            </div>
            <div className={card}>
              <div className="text-[10px] font-medium uppercase text-neutral-500">Conversies</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-50">
                {stats.conversions}
              </div>
            </div>
          </section>

          <section className={card}>
            <h2 className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">Top pagina’s</h2>
            <ul className="mt-2 space-y-1.5 text-sm text-neutral-700 dark:text-neutral-300">
              {stats.top_pages.length === 0 ? (
                <li className="text-neutral-500">Nog geen page views in dit venster.</li>
              ) : (
                stats.top_pages.map((row) => (
                  <li key={row.path} className="flex justify-between gap-3">
                    <span className="min-w-0 truncate font-mono text-xs" title={row.path}>
                      {row.path}
                    </span>
                    <span className="shrink-0 tabular-nums text-neutral-600 dark:text-neutral-400">{row.count}</span>
                  </li>
                ))
              )}
            </ul>
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <div className={card}>
              <h2 className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">Clicks (data-analytics)</h2>
              <ul className="mt-2 max-h-64 space-y-1 overflow-auto text-sm text-neutral-700 dark:text-neutral-300">
                {sortEntries(stats.clicks_by_key).map(([k, n]) => (
                  <li key={k} className="flex justify-between gap-2">
                    <span className="min-w-0 break-all font-mono text-xs">{k}</span>
                    <span className="shrink-0 tabular-nums">{n}</span>
                  </li>
                ))}
                {Object.keys(stats.clicks_by_key).length === 0 ? (
                  <li className="text-neutral-500">Nog geen click events.</li>
                ) : null}
              </ul>
            </div>
            <div className={card}>
              <h2 className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">Conversies (naam)</h2>
              <ul className="mt-2 max-h-64 space-y-1 overflow-auto text-sm text-neutral-700 dark:text-neutral-300">
                {sortEntries(stats.conversions_by_name).map(([k, n]) => (
                  <li key={k} className="flex justify-between gap-2">
                    <span className="min-w-0 break-all text-xs">{k}</span>
                    <span className="shrink-0 tabular-nums">{n}</span>
                  </li>
                ))}
                {Object.keys(stats.conversions_by_name).length === 0 ? (
                  <li className="text-neutral-500">Nog geen conversion events.</li>
                ) : null}
              </ul>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <div className={card}>
              <h2 className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">Scroll diepte</h2>
              <ul className="mt-2 space-y-1 text-sm text-neutral-700 dark:text-neutral-300">
                {["25", "50", "75", "100"].map((d) => (
                  <li key={d} className="flex justify-between">
                    <span>{d}%</span>
                    <span className="tabular-nums">{stats.scroll_by_depth[d] ?? 0}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className={card}>
              <h2 className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">Desktop vs mobiel (page views)</h2>
              <ul className="mt-2 space-y-1 text-sm text-neutral-700 dark:text-neutral-300">
                {sortEntries(stats.device_mix, 10).map(([k, n]) => (
                  <li key={k} className="flex justify-between gap-2">
                    <span className="capitalize">{k}</span>
                    <span className="tabular-nums">{n}</span>
                  </li>
                ))}
                {Object.keys(stats.device_mix).length === 0 ? (
                  <li className="text-neutral-500">Nog geen data.</li>
                ) : null}
              </ul>
            </div>
          </section>

          <section className={card}>
            <h2 className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">Engagement (seconden op pagina)</h2>
            <p className="mt-1 text-xs text-neutral-500">Pings op 10s en 30s actieve tijd in het tabblad.</p>
            <ul className="mt-2 flex gap-6 text-sm text-neutral-700 dark:text-neutral-300">
              <li>
                10s: <span className="tabular-nums font-medium">{stats.engagement["10"] ?? 0}</span>
              </li>
              <li>
                30s: <span className="tabular-nums font-medium">{stats.engagement["30"] ?? 0}</span>
              </li>
            </ul>
          </section>
        </>
      )}
    </div>
  );
}

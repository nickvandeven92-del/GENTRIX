import type { Metadata } from "next";
import { getSiteAnalyticsDashboard } from "@/lib/data/get-site-analytics-dashboard";

export const metadata: Metadata = {
  title: "Site-analytics",
};

const card =
  "rounded-lg border border-neutral-200 bg-white px-4 py-3 shadow-sm dark:border-neutral-800 dark:bg-neutral-950";
const th = "border-b border-neutral-200 px-2 py-1.5 text-left text-[10px] font-medium uppercase text-neutral-500 dark:border-neutral-800";
const td = "max-w-0 border-b border-neutral-100 px-2 py-1.5 text-xs text-neutral-800 dark:border-neutral-900 dark:text-neutral-200";

function pct(n: number): string {
  if (!Number.isFinite(n)) return "0%";
  return `${n % 1 === 0 ? n : n.toFixed(1)}%`;
}

function formatInt(n: number): string {
  if (!Number.isFinite(n)) return "0";
  return String(Math.round(n));
}

export default async function SiteAnalyticsOpsPage() {
  const stats = await getSiteAnalyticsDashboard(30);

  return (
    <div className="mx-auto max-w-[1200px] space-y-8 px-1 pb-12">
      <header>
        <h1 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Site-analytics</h1>
        <p className="mt-1 text-xs text-neutral-500">
          Eerstepartij meetdata van publieke sites (
          <code className="rounded bg-neutral-100 px-1 text-[11px] dark:bg-neutral-900">/site</code>
          ). Laatste 30 dagen. Geen ruwe IP; user-agent alleen gehasht opgeslagen.
        </p>
        {stats ? (
          <p className="mt-1 font-mono text-[10px] text-neutral-400">Venster: {stats.sinceIso} · v{stats.version}</p>
        ) : null}
      </header>

      {!stats ? (
        <p className="text-sm text-neutral-500">
          Geen toegang tot <code className="rounded bg-neutral-100 px-1 text-xs dark:bg-neutral-900">site_analytics_events</code> of
          migratie nog niet toegepast. Draai Supabase-migraties (o.a.{" "}
          <code className="font-mono text-xs">site_analytics_dashboard_v2</code>
          ) en controleer RLS.
        </p>
      ) : (
        <>
          {stats.summary.clicks === 0 ? (
            <div
              className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100"
              role="status"
            >
              <strong>Geen click events gevonden.</strong> Controleer of knoppen en links{" "}
              <code className="rounded bg-white/80 px-1 text-xs dark:bg-black/30">data-analytics</code> hebben of dat
              kliktracking geblokkeerd wordt.
            </div>
          ) : null}

          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className={card}>
              <div className="text-[10px] font-medium uppercase text-neutral-500">Paginaweergaven</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-50">
                {formatInt(stats.summary.page_views)}
              </div>
            </div>
            <div className={card}>
              <div className="text-[10px] font-medium uppercase text-neutral-500">Unieke bezoekers</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-50">
                {formatInt(stats.summary.unique_visitors)}
              </div>
            </div>
            <div className={card}>
              <div className="text-[10px] font-medium uppercase text-neutral-500">Clicks (totaal)</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-50">
                {formatInt(stats.summary.clicks)}
              </div>
            </div>
            <div className={card}>
              <div className="text-[10px] font-medium uppercase text-neutral-500">Conversies (totaal)</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-50">
                {formatInt(stats.summary.conversions)}
              </div>
            </div>
          </section>

          <section className={card}>
            <h2 className="text-sm font-semibold text-neutral-800 dark:text-neutral-100">Funnel (30 dagen)</h2>
            <p className="mt-1 text-xs text-neutral-500">
              Stappen: pagina bekeken → betrokken (10s+ of ≥50% scroll) → CTA-klik → checkout gestart → afronding. Percentages
              t.o.v. vorige stap.
            </p>
            {(() => {
              const f = stats.funnel;
              const steps: { label: string; n: number; pctPrev: string | null }[] = [
                { label: "Paginaweergaven (sessies)", n: f.page_view_sessions, pctPrev: null },
                { label: "Betrokken sessies", n: f.engaged_sessions, pctPrev: pct(f.pct_engaged_vs_pageview) },
                { label: "Sessies met CTA-klik", n: f.cta_click_sessions, pctPrev: pct(f.pct_cta_vs_engaged) },
                { label: "Checkout gestart", n: f.checkout_started_sessions, pctPrev: pct(f.pct_checkout_vs_cta) },
                { label: "Checkout afgerond", n: f.checkout_completed_sessions, pctPrev: pct(f.pct_completed_vs_checkout) },
              ];
              return (
                <ol className="mt-3 grid gap-2 sm:grid-cols-1 md:grid-cols-5">
                  {steps.map((s) => (
                    <li
                      key={s.label}
                      className="rounded border border-neutral-200 bg-neutral-50/60 px-3 py-2 text-xs dark:border-neutral-800 dark:bg-neutral-900/30"
                    >
                      <div className="text-[10px] font-medium uppercase text-neutral-500">{s.label}</div>
                      <div className="mt-1 text-lg font-semibold tabular-nums text-neutral-900 dark:text-neutral-50">{formatInt(s.n)}</div>
                      {s.pctPrev != null ? (
                        <div className="mt-0.5 text-[10px] text-neutral-500">vs vorig: {s.pctPrev}</div>
                      ) : null}
                    </li>
                  ))}
                </ol>
              );
            })()}
            <p className="mt-2 text-[10px] text-neutral-400">
              T.o.v. page views: betrokken {pct(stats.funnel.pct_engaged_of_pageview)} · CTA {pct(stats.funnel.pct_cta_of_pageview)} (oude
              noemer; keten zie boven).
            </p>
          </section>

          <section className={card}>
            <h2 className="text-sm font-semibold text-neutral-800 dark:text-neutral-100">Paginaperformance</h2>
            <p className="mt-1 text-xs text-neutral-500">Gesorteerd op meeste paginaweergaven. CTR = clicks ÷ weergaven.</p>
            <div className="mt-2 overflow-x-auto">
              {stats.page_performance.length === 0 ? (
                <p className="text-sm text-neutral-500">Nog geen gegevens in dit venster.</p>
              ) : (
                <table className="w-full min-w-[800px] border-collapse text-sm">
                  <thead>
                    <tr>
                      <th className={th}>Pad</th>
                      <th className={th}>Key</th>
                      <th className={th}>Weerg.</th>
                      <th className={th}>Uniek</th>
                      <th className={th}>Clicks</th>
                      <th className={th}>CTR</th>
                      <th className={th}>Conv.</th>
                      <th className={th}>Conv %</th>
                      <th className={th}>Ø eng. (s)</th>
                      <th className={th} title="Bereik 25/50/75/100% scroll (events)">
                        25/50/75/100
                      </th>
                      <th className={th} title="Drop-off tussen schalen">
                        Drop-off
                      </th>
                      <th className={th}>Mob / niet-mob</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.page_performance.map((r) => (
                      <tr key={`${r.page_path}::${r.page_key}`}>
                        <td className={td}>
                          <span className="block truncate font-mono" title={r.page_path}>
                            {r.page_path}
                          </span>
                        </td>
                        <td className={td + " font-mono"}>{r.page_key}</td>
                        <td className={td + " tabular-nums"}>{formatInt(r.page_views)}</td>
                        <td className={td + " tabular-nums"}>{formatInt(r.unique_visitors)}</td>
                        <td className={td + " tabular-nums"}>{formatInt(r.clicks)}</td>
                        <td className={td + " tabular-nums"}>{pct(r.click_through_rate_pct)}</td>
                        <td className={td + " tabular-nums"}>{formatInt(r.conversions)}</td>
                        <td className={td + " tabular-nums"}>{pct(r.conversion_rate_pct)}</td>
                        <td className={td + " tabular-nums"}>{r.avg_engagement_seconds}</td>
                        <td className={td + " tabular-nums text-[10px]"}>
                          {formatInt(r.scroll_25)}/{formatInt(r.scroll_50)}/{formatInt(r.scroll_75)}/{formatInt(r.scroll_100)}
                        </td>
                        <td className={td + " tabular-nums text-[10px] text-neutral-600 dark:text-neutral-400"}>
                          {pct(r.reach_25_pct)} → {pct(r.of_25_reach_50_pct)} → {pct(r.of_50_reach_75_pct)} → {pct(r.of_75_reach_100_pct)}
                        </td>
                        <td className={td + " tabular-nums text-[10px]"}>
                          {formatInt(r.page_views_mobile)}/{formatInt(r.page_views_non_mobile)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <div className={card}>
              <h2 className="text-sm font-semibold text-neutral-800 dark:text-neutral-100">CTA’s / elementen</h2>
              <p className="mt-1 text-xs text-neutral-500">
                Sortering: meeste clicks. Click share t.o.v. totaal clicks. “Na klik” = sessies met conversie na eerste klik op
                dit id.
              </p>
              <div className="mt-2 max-h-96 overflow-auto">
                {stats.cta_performance.length === 0 ? (
                  <p className="text-sm text-neutral-500">Nog geen CTA-klikken in dit venster.</p>
                ) : (
                  <table className="w-full min-w-[640px] border-collapse">
                    <thead>
                      <tr>
                        <th className={th}>analytics_id</th>
                        <th className={th}>Rol</th>
                        <th className={th}>Label</th>
                        <th className={th}>Sectie</th>
                        <th className={th}>Pad</th>
                        <th className={th}>Clicks</th>
                        <th className={th}>Uniek</th>
                        <th className={th}>Aandeel</th>
                        <th className={th}>Conv. erna</th>
                        <th className={th}>% na klik</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.cta_performance.map((c) => (
                        <tr key={`${c.analytics_id}::${c.page_path}::${c.label}`}>
                          <td className={td + " break-all font-mono text-[10px]"}>{c.analytics_id}</td>
                          <td className={td + " text-[10px]"}>{c.element_role}</td>
                          <td className={td + " max-w-[120px] truncate"} title={c.label}>
                            {c.label || "—"}
                          </td>
                          <td className={td + " text-[10px]"}>{c.section_id || "—"}</td>
                          <td className={td + " max-w-[140px] truncate font-mono text-[10px]"} title={c.page_path}>
                            {c.page_path}
                          </td>
                          <td className={td + " tabular-nums"}>{formatInt(c.clicks)}</td>
                          <td className={td + " tabular-nums"}>{formatInt(c.unique_clickers)}</td>
                          <td className={td + " tabular-nums"}>{pct(c.click_share)}</td>
                          <td className={td + " tabular-nums"}>{formatInt(c.downstream_conversions)}</td>
                          <td className={td + " tabular-nums"}>{pct(c.conversion_after_click_rate)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            <div className={card}>
              <h2 className="text-sm font-semibold text-neutral-800 dark:text-neutral-100">Conversies (naam)</h2>
              <ul className="mt-2 max-h-64 space-y-1 overflow-auto text-sm text-neutral-700 dark:text-neutral-300">
                {Object.keys(stats.conversion_names).length === 0 ? (
                  <li className="text-neutral-500">Nog geen conversion events.</li>
                ) : (
                  Object.entries(stats.conversion_names)
                    .sort((a, b) => b[1] - a[1])
                    .map(([k, n]) => (
                      <li key={k} className="flex justify-between gap-2">
                        <span className="min-w-0 break-words text-xs">{k}</span>
                        <span className="shrink-0 tabular-nums">{n}</span>
                      </li>
                    ))
                )}
              </ul>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <div className={card}>
              <h2 className="text-sm font-semibold text-neutral-800 dark:text-neutral-100">Scroll (totaal, diepte %)</h2>
              {["25", "50", "75", "100"].map((d) => (
                <div key={d} className="mt-2 flex justify-between text-sm first:mt-0">
                  <span>{d}%</span>
                  <span className="tabular-nums">{formatInt(stats.scroll_by_depth_global[d] ?? 0)}</span>
                </div>
              ))}
            </div>
            <div className={card}>
              <h2 className="text-sm font-semibold text-neutral-800 dark:text-neutral-100">Desktop vs mobiel (page views)</h2>
              <ul className="mt-2 space-y-1 text-sm text-neutral-700 dark:text-neutral-300">
                {Object.keys(stats.device_breakdown).length === 0 ? (
                  <li className="text-neutral-500">Nog geen data.</li>
                ) : (
                  Object.entries(stats.device_breakdown)
                    .sort((a, b) => b[1] - a[1])
                    .map(([k, n]) => (
                      <li key={k} className="flex justify-between gap-2">
                        <span className="capitalize">{k}</span>
                        <span className="tabular-nums">{n}</span>
                      </li>
                    ))
                )}
              </ul>
              <p className="mt-2 text-[10px] text-neutral-400">User-agent: alleen geclassificeerd (mobiel/desktop/tablet), niet opgeslagen als vrije tekst.</p>
            </div>
          </section>

          <section className={card}>
            <h2 className="text-sm font-semibold text-neutral-800 dark:text-neutral-100">Scroll per pagina (top, op 25%-events)</h2>
            <p className="mt-1 text-xs text-neutral-500">
              Aantallen = scroll-momenten (events) per diepte. Vergelijk 25 → 50 → 75 → 100 voor zicht op doorloop.
            </p>
            <div className="mt-2 overflow-x-auto">
              {stats.scroll_by_page.length === 0 ? (
                <p className="text-sm text-neutral-500">Nog geen per-pagina scrolldata.</p>
              ) : (
                <table className="w-full min-w-[500px] border-collapse">
                  <thead>
                    <tr>
                      <th className={th}>Pad</th>
                      <th className={th}>Key</th>
                      <th className={th}>25%</th>
                      <th className={th}>50%</th>
                      <th className={th}>75%</th>
                      <th className={th}>100%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.scroll_by_page.map((r) => (
                      <tr key={`${r.page_path}::${r.page_key}`}>
                        <td className={td + " max-w-xs truncate font-mono text-xs"} title={r.page_path}>
                          {r.page_path}
                        </td>
                        <td className={td + " font-mono text-xs"}>{r.page_key}</td>
                        <td className={td + " tabular-nums"}>{formatInt(r.s25)}</td>
                        <td className={td + " tabular-nums"}>{formatInt(r.s50)}</td>
                        <td className={td + " tabular-nums"}>{formatInt(r.s75)}</td>
                        <td className={td + " tabular-nums"}>{formatInt(r.s100)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>

          <section className="rounded-md border border-neutral-200 bg-neutral-50/80 px-3 py-2 text-xs text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900/30 dark:text-neutral-400">
            <strong className="text-neutral-800 dark:text-neutral-200">Lokaal testen:</strong> open een publieke site, na load:
            pagina in netwerk (POST <code className="mx-0.5">/api/analytics/events</code>), klik op CTA met{" "}
            <code>data-analytics</code>
            , scroll &gt;50% voor <code>scroll_depth</code>, in console:{" "}
            <code className="whitespace-nowrap">window.__gentrix?.trackConversion(&quot;checkout_started&quot;)</code> voor een
            testconversie.
          </section>
        </>
      )}
    </div>
  );
}

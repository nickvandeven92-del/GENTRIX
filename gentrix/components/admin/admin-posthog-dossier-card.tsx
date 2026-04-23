import { Activity, ExternalLink } from "lucide-react";
import { getPosthogDossierForClientSlug } from "@/lib/posthog/posthog-dossier-insight";

type Props = { siteSlug: string };

/**
 * Productgedrag uit PostHog op het klantdossier (server-side query; geen PII in de card).
 */
export async function AdminPosthogDossierCard({ siteSlug }: Props) {
  const vm = await getPosthogDossierForClientSlug(siteSlug);

  if (vm.kind === "unconfigured") {
    return (
      <section className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50/80 p-5 dark:border-zinc-600 dark:bg-zinc-900/40">
        <div className="flex items-start gap-3">
          <Activity className="mt-0.5 size-5 shrink-0 text-zinc-500" aria-hidden />
          <div>
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Productgedrag (PostHog)</h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{vm.message}</p>
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-500">
              Personal API key: PostHog → Account → Personal API keys → met minimaal <strong>query:read</strong>. Project-ID staat in de URL
              van je project (bijv. <code className="rounded bg-white/80 px-1 font-mono text-[11px] dark:bg-zinc-800">/project/12345/…</code>).
            </p>
          </div>
        </div>
      </section>
    );
  }

  if (vm.kind === "error") {
    return (
      <section className="rounded-xl border border-amber-200 bg-amber-50/90 p-5 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
        <h2 className="text-sm font-semibold">Productgedrag (PostHog)</h2>
        <p className="mt-1 text-xs opacity-90">{vm.message}</p>
      </section>
    );
  }

  const d = vm;
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Productgedrag (PostHog)</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Laatste {d.lookbackDays} d · <span className="font-mono text-zinc-800 dark:text-zinc-200">{d.siteSlug}</span>
            {d.lastEventAt ? (
              <>
                {" "}
                · laatste event:{" "}
                {new Date(d.lastEventAt).toLocaleString("nl-NL", { dateStyle: "short", timeStyle: "short" })}
              </>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={d.posthogOpenFiltersUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            <ExternalLink className="size-3.5" aria-hidden />
            Live events in PostHog
          </a>
          <a
            href={d.posthogProjectBaseUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            <ExternalLink className="size-3.5" aria-hidden />
            Project
          </a>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-zinc-100 bg-zinc-50/80 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900/50">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Paginaweergaves</p>
          <p className="text-lg font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">{d.pageViews}</p>
        </div>
        <div className="rounded-lg border border-zinc-100 bg-zinc-50/80 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900/50">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Sessies gestart</p>
          <p className="text-lg font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">{d.sessionsStarted}</p>
        </div>
        <div className="rounded-lg border border-zinc-100 bg-zinc-50/80 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900/50">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Scroll-milestones</p>
          <p className="text-lg font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">{d.scrollMilestones}</p>
        </div>
      </div>

      {d.signals.length > 0 ? (
        <div className="mt-4">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Signalen (heuristiek)</p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-zinc-800 dark:text-zinc-200">
            {d.signals.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {d.recent.length > 0 ? (
        <div className="mt-4">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Recente events</p>
          <ul className="mt-2 divide-y divide-zinc-100 dark:divide-zinc-800">
            {d.recent.map((r, i) => (
              <li key={`${r.at}-${r.event}-${i}`} className="flex flex-wrap items-baseline justify-between gap-2 py-1.5 text-sm">
                <span className="font-mono text-xs text-zinc-800 dark:text-zinc-200">{r.event}</span>
                <span className="text-xs text-zinc-500">
                  {r.pageKey ? <span className="text-zinc-600 dark:text-zinc-400">{r.pageKey} · </span> : null}
                  {new Date(r.at).toLocaleString("nl-NL", { dateStyle: "short", timeStyle: "medium" })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : d.pageViews === 0 && d.sessionsStarted === 0 ? (
        <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">Nog geen events met property site_slug in deze periode.</p>
      ) : null}

      <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-500">
        Funnels, replay en segmenten: in PostHog. Filter in Live events op property <code className="font-mono">site_slug</code> ={" "}
        <code className="font-mono">{d.siteSlug}</code>. Server keys (personal API) alleen in de deploy-omgeving, niet in de browser.
      </p>
    </section>
  );
}

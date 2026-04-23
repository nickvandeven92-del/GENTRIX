import type { ReactNode } from "react";
import { Activity, Database, ExternalLink } from "lucide-react";
import {
  getPosthogDossierForClientSlug,
  getPosthogProjectBaseUrlForLinks,
  posthogAppBaseUrl,
} from "@/lib/posthog/posthog-dossier-insight";
import type { ClientPosthogSummaryRow } from "@/lib/data/get-client-posthog-summary";

type Props = {
  siteSlug: string;
  crm: ClientPosthogSummaryRow | null;
};

type OkDossier = {
  source: "crm" | "live";
  lookbackDays: number;
  siteSlug: string;
  lastEventAt: string | null;
  posthogOpenFiltersUrl: string;
  posthogProjectBaseUrl: string;
  pageViews: number;
  sessionsStarted: number;
  scrollMilestones: number;
  signals: string[];
  recent: { event: string; at: string; pageKey: string | null; path: string | null }[];
  crmSyncedAt: string | null;
};

/**
 * Toont productgedrag: liever gecachte **database**-rij (na cron), anders **live** PostHog-query.
 */
export async function AdminPosthogDossierCard({ siteSlug, crm }: Props) {
  const crmOk = crm && !crm.fetch_error;
  if (crmOk) {
    const projectBase = getPosthogProjectBaseUrlForLinks() ?? posthogAppBaseUrl();
    const d: OkDossier = {
      source: "crm",
      lookbackDays: crm.lookback_days,
      siteSlug: crm.subfolder_slug,
      lastEventAt: crm.last_event_at,
      posthogOpenFiltersUrl: `${projectBase}/activity/explore`,
      posthogProjectBaseUrl: projectBase,
      pageViews: crm.pageviews,
      sessionsStarted: crm.sessions_started,
      scrollMilestones: crm.scroll_milestones,
      signals: crm.signals,
      recent: crm.recent_events.map((e) => ({
        event: e.event,
        at: e.at,
        pageKey: e.pageKey,
        path: e.path,
      })),
      crmSyncedAt: crm.fetched_at,
    };
    return <DossierOk d={d} crmErrorBanner={null} />;
  }

  const crmErrorBanner = crm?.fetch_error ? (
    <p className="text-xs text-amber-800 dark:text-amber-200">
      Laatste sync in database mislukte: {crm.fetch_error} — toon live PostHog hieronder.
    </p>
  ) : null;

  if (crm && crm.fetch_error) {
    const live = await getPosthogDossierForClientSlug(siteSlug);
    if (live.kind === "unconfigured" || live.kind === "error") {
      return (
        <CrmErrorOnly
          crmErrorBanner={crmErrorBanner}
          message={live.kind === "unconfigured" || live.kind === "error" ? live.message : ""}
        />
      );
    }
    const projectBase = getPosthogProjectBaseUrlForLinks() ?? live.posthogProjectBaseUrl;
    const d: OkDossier = {
      source: "live",
      lookbackDays: live.lookbackDays,
      siteSlug: live.siteSlug,
      lastEventAt: live.lastEventAt,
      posthogOpenFiltersUrl: projectBase ? `${projectBase}/activity/explore` : live.posthogOpenFiltersUrl,
      posthogProjectBaseUrl: projectBase ?? live.posthogProjectBaseUrl,
      pageViews: live.pageViews,
      sessionsStarted: live.sessionsStarted,
      scrollMilestones: live.scrollMilestones,
      signals: live.signals,
      recent: live.recent,
      crmSyncedAt: null,
    };
    return <DossierOk d={d} crmErrorBanner={crmErrorBanner} />;
  }

  const live = await getPosthogDossierForClientSlug(siteSlug);
  if (live.kind === "unconfigured") {
    return <Unconfigured message={live.message} />;
  }
  if (live.kind === "error") {
    return (
      <section className="rounded-xl border border-amber-200 bg-amber-50/90 p-5 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
        <h2 className="text-sm font-semibold">Productgedrag (PostHog)</h2>
        <p className="mt-1 text-xs opacity-90">{live.message}</p>
      </section>
    );
  }
  const projectBase = getPosthogProjectBaseUrlForLinks() ?? live.posthogProjectBaseUrl;
  const d: OkDossier = {
    source: "live",
    lookbackDays: live.lookbackDays,
    siteSlug: live.siteSlug,
    lastEventAt: live.lastEventAt,
    posthogOpenFiltersUrl: projectBase ? `${projectBase}/activity/explore` : live.posthogOpenFiltersUrl,
    posthogProjectBaseUrl: projectBase ?? live.posthogProjectBaseUrl,
    pageViews: live.pageViews,
    sessionsStarted: live.sessionsStarted,
    scrollMilestones: live.scrollMilestones,
    signals: live.signals,
    recent: live.recent,
    crmSyncedAt: null,
  };
  return <DossierOk d={d} crmErrorBanner={null} noCrmNote />;
}

function Unconfigured({ message }: { message: string }) {
  return (
    <section className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50/80 p-5 dark:border-zinc-600 dark:bg-zinc-900/40">
      <div className="flex items-start gap-3">
        <Activity className="mt-0.5 size-5 shrink-0 text-zinc-500" aria-hidden />
        <div>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Productgedrag (PostHog)</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{message}</p>
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-500">
            Personal API key: PostHog → Account → Personal API keys → met minimaal <strong>query:read</strong>. Project-ID staat in de URL van
            je project.
          </p>
        </div>
      </div>
    </section>
  );
}

function CrmErrorOnly({ crmErrorBanner, message }: { crmErrorBanner: React.ReactNode; message: string }) {
  return (
    <section className="space-y-2 rounded-xl border border-amber-200 bg-amber-50/90 p-5 dark:border-amber-900/50 dark:bg-amber-950/30">
      <h2 className="text-sm font-semibold text-amber-950 dark:text-amber-100">Productgedrag (PostHog)</h2>
      {crmErrorBanner}
      <p className="text-xs text-amber-900 dark:text-amber-200">{message}</p>
    </section>
  );
}

function DossierOk({
  d,
  crmErrorBanner,
  noCrmNote,
}: {
  d: OkDossier;
  crmErrorBanner: ReactNode | null;
  noCrmNote?: boolean;
}) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
      {crmErrorBanner ? <div className="mb-3 rounded border border-amber-200 bg-amber-50/80 px-3 py-2 dark:border-amber-800 dark:bg-amber-950/40">{crmErrorBanner}</div> : null}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Productgedrag (PostHog)</h2>
            {d.source === "crm" ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium uppercase text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
                <Database className="size-3" aria-hidden />
                In Studio (database)
              </span>
            ) : (
              <span className="text-[10px] font-medium uppercase text-amber-700 dark:text-amber-300">Live</span>
            )}
          </div>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Laatste {d.lookbackDays} d · <span className="font-mono text-zinc-800 dark:text-zinc-200">{d.siteSlug}</span>
            {d.lastEventAt ? (
              <>
                {" "}
                · laatste event:{" "}
                {new Date(d.lastEventAt).toLocaleString("nl-NL", { dateStyle: "short", timeStyle: "short" })}
              </>
            ) : null}
            {d.crmSyncedAt ? (
              <>
                {" "}
                · sync:{" "}
                {new Date(d.crmSyncedAt).toLocaleString("nl-NL", { dateStyle: "short", timeStyle: "short" })}
              </>
            ) : null}
          </p>
          {noCrmNote ? (
            <p className="mt-1 text-xs text-zinc-500">
              Nog geen regel in <code className="font-mono">client_posthog_summary</code> — draai{" "}
              <code className="font-mono">/api/cron/posthog-summaries</code> of wacht op de nachtelijke cron. Tot die tijd: live cijfers.
            </p>
          ) : null}
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
        Funnels, replay, tijd per pagina: in PostHog. Filter in Live events op <code className="font-mono">site_slug</code> ={" "}
        <code className="font-mono">{d.siteSlug}</code>.
      </p>
    </section>
  );
}

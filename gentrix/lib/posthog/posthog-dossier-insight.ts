/**
 * PostHog (server) voor het admin-klantdossier: leest events terug op `site_slug`.
 * Vereist: Personal API key + project-id (niet de publieke capture key).
 */

import { cache } from "react";

const LOOKBACK_DAYS = 7;
const MAX_ROWS = 50;

function posthogQueryApiBase(): string | null {
  const fromPublic = (process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "").trim();
  if (fromPublic) {
    const u = fromPublic.replace(/\/$/, "");
    if (u.includes("eu.i.posthog.com")) return "https://eu.posthog.com";
    if (u.includes("us.i.posthog.com")) return "https://us.posthog.com";
    if (u.match(/https:\/\/(eu|us)\.posthog\.com/i)) return u;
    if (u.includes("app.posthog.com")) return u;
  }
  const ex = (process.env.POSTHOG_API_HOST ?? "").trim().replace(/\/$/, "");
  if (ex) return ex;
  return "https://eu.posthog.com";
}

/** UI-links (niet het ingest-domein). */
export function posthogAppBaseUrl(): string {
  return posthogQueryApiBase() ?? "https://eu.posthog.com";
}

function projectId(): string | null {
  const p = (process.env.POSTHOG_PROJECT_ID ?? "").trim();
  return p.length > 0 ? p : null;
}

function personalApiKey(): string | null {
  const k = (process.env.POSTHOG_PERSONAL_API_KEY ?? process.env.POSTHOG_API_KEY ?? "").trim();
  return k.length > 0 ? k : null;
}

function escapeHogqlString(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/'/g, "''");
}

function isPlausibleClientSlug(s: string): boolean {
  return s.length > 0 && s.length < 200 && !/['"`;\n\r\0]/.test(s) && s.trim() === s;
}

export type PosthogDossierEventRow = {
  event: string;
  /** ISO of raw PostHog timestamp */
  at: string;
  pageKey: string | null;
  path: string | null;
};

export type PosthogDossierViewModel =
  | {
      kind: "unconfigured";
      message: string;
    }
  | {
      kind: "error";
      message: string;
    }
  | {
      kind: "ok";
      siteSlug: string;
      lookbackDays: number;
      lastEventAt: string | null;
      posthogProjectBaseUrl: string;
      posthogOpenFiltersUrl: string;
      pageViews: number;
      sessionsStarted: number;
      /** Aantal `site_scroll_depth` events (25/50/75/100 milestones). */
      scrollMilestones: number;
      recent: PosthogDossierEventRow[];
      signals: string[];
    };

type HogQueryResponse = {
  error?: string;
  detail?: string;
  columns?: string[];
  results?: (string | number | boolean | null)[][];
};

async function runHogQuery(query: string): Promise<{ columns: string[]; rows: (string | number | boolean | null)[][] }> {
  const key = personalApiKey();
  const pid = projectId();
  const base = posthogQueryApiBase();
  if (!key || !pid || !base) {
    throw new Error("posthog config");
  }
  const url = `${base}/api/projects/${encodeURIComponent(pid)}/query/`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: "gentrix-dossier",
      query: { kind: "HogQLQuery", query },
    }),
    next: { revalidate: 120 },
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(t || res.statusText || `HTTP ${res.status}`);
  }
  const j = (await res.json()) as HogQueryResponse;
  if (j.error || j.detail) {
    throw new Error((j.detail ?? j.error) as string);
  }
  return { columns: j.columns ?? [], rows: j.results ?? [] };
}

function colIndex(columns: string[], name: string): number {
  const n = name.toLowerCase();
  return columns.findIndex((c) => c.toLowerCase() === n);
}

function asStr(v: string | number | boolean | null | undefined): string {
  if (v === null || v === undefined) return "";
  return String(v);
}

/**
 * Aantal events per type in lookback, gefilterd op `properties.site_slug`.
 * Gebruikt eenvoudige `properties.site_slug` (zoals wij in capture/register zetten).
 */
function buildEventSummaryQuery(escapedSlug: string): string {
  return `SELECT
  countIf(event = 'site_page_viewed') AS c_page,
  countIf(event = 'site_session_started') AS c_sess,
  countIf(event = 'site_scroll_depth') AS c_scroll_deep
FROM events
WHERE timestamp > now() - interval ${LOOKBACK_DAYS} day
  AND JSONExtractString(properties, 'site_slug') = '${escapedSlug}'`;
}

function buildRecentQuery(escapedSlug: string): string {
  return `SELECT
  event,
  toString(timestamp) AS ts,
  JSONExtractString(properties, 'page_key') AS page_key,
  JSONExtractString(properties, 'path') AS path
FROM events
WHERE timestamp > now() - interval ${LOOKBACK_DAYS} day
  AND JSONExtractString(properties, 'site_slug') = '${escapedSlug}'
ORDER BY timestamp DESC
LIMIT ${MAX_ROWS}`;
}

function buildSignals(
  pageViews: number,
  sessionsStarted: number,
  scrollMilestones: number,
  last: PosthogDossierEventRow | null,
  rows: PosthogDossierEventRow[],
): string[] {
  const s: string[] = [];
  if (pageViews === 0 && sessionsStarted === 0 && scrollMilestones === 0 && !last) {
    s.push("Nog geen geregistreerd web-gedrag voor dit domein in PostHog (zorg dat de publieke key staat en er verkeer was).");
    return s;
  }
  s.push(
    `Laatste ${LOOKBACK_DAYS} d: ${pageViews} paginaweergaven, ${sessionsStarted} sessies gestart, ${scrollMilestones} scroll-milestones (25/50/75/100%).`,
  );
  if (pageViews > 0 && pageViews < 3) {
    s.push("Lage bezoekfrequentie — nóg weinig of geen herhaalde site-bezoeken.");
  }
  if (pageViews >= 8) {
    s.push("Frequente paginaweergaves — duidelijke interesse in de site-inhoud.");
  }
  if (scrollMilestones > 0 && pageViews < 2) {
    s.push("Scroll-milestones geregistreerd met weinig paginaweergaves: er is wel gescrolld op de site.");
  }
  const ctaClicks = rows.filter((e) => e.event === "site_cta_click").length;
  if (pageViews >= 5 && ctaClicks === 0) {
    s.push("Veel pageviews, nog geen geregistreerde CTA-klikken in deze periode (event site_cta_click is nog beperkt ingebouwd).");
  }
  if (last) {
    s.push(`Meest recente event: ${last.event} (${new Date(last.at).toLocaleString("nl-NL", { timeStyle: "short", dateStyle: "short" })}).`);
  }
  return s;
}

export const getPosthogDossierForClientSlug = cache(
  async function getPosthogDossierForClientSlug(siteSlug: string): Promise<PosthogDossierViewModel> {
    if (!isPlausibleClientSlug(siteSlug)) {
      return { kind: "error", message: "Ongeldige site-slug." };
    }
    if (!personalApiKey() || !projectId()) {
      return {
        kind: "unconfigured",
        message:
          "Zet POSTHOG_PERSONAL_API_KEY en POSTHOG_PROJECT_ID in de server-omgeving. Optioneel: POSTHOG_API_HOST (standaard afgeleid van NEXT_PUBLIC_POSTHOG_HOST). Publieke events gaan wél al naar PostHog als NEXT_PUBLIC_POSTHOG_KEY gezet is.",
      };
    }
    const es = escapeHogqlString(siteSlug);
    const appBase = posthogAppBaseUrl();
    const pid = projectId()!;

    try {
      const [summary, recent] = await Promise.all([runHogQuery(buildEventSummaryQuery(es)), runHogQuery(buildRecentQuery(es))]);
      const sc = summary.columns;
      const sr = summary.rows[0] ?? [];
      const idxPage = colIndex(sc, "c_page");
      const idxSess = colIndex(sc, "c_sess");
      const idxScroll = colIndex(sc, "c_scroll_deep");
      const pageViews = Number(sr[idxPage >= 0 ? idxPage : 0] ?? 0) || 0;
      const sessionsStarted = Number(sr[idxSess >= 0 ? idxSess : 1] ?? 0) || 0;
      const scrollMilestones = Number(sr[idxScroll >= 0 ? idxScroll : 2] ?? 0) || 0;

      const rc = recent.columns;
      const evI = colIndex(rc, "event");
      const tsI = colIndex(rc, "ts");
      const pkI = colIndex(rc, "page_key");
      const pthI = colIndex(rc, "path");
      const parsed: PosthogDossierEventRow[] = (recent.rows ?? []).map((r) => ({
        event: asStr(r[evI >= 0 ? evI : 0]),
        at: asStr(r[tsI >= 0 ? tsI : 1]),
        pageKey: (r[pkI >= 0 ? pkI : 2] as string | null) && String(r[pkI >= 0 ? pkI : 2]).length ? asStr(r[pkI >= 0 ? pkI : 2]) : null,
        path: (r[pthI >= 0 ? pthI : 3] as string | null) && String(r[pthI >= 0 ? pthI : 3]).length ? asStr(r[pthI >= 0 ? pthI : 3]) : null,
      })).filter((e) => e.event.length > 0);
      const last = parsed[0] ?? null;
      const lastIso = last ? (() => {
        const d = new Date(last.at);
        return Number.isNaN(d.getTime()) ? null : d.toISOString();
      })() : null;

      const posthogProjectBase = `${appBase}/project/${pid}`;

      return {
        kind: "ok",
        siteSlug,
        lookbackDays: LOOKBACK_DAYS,
        lastEventAt: lastIso,
        posthogProjectBaseUrl: posthogProjectBase,
        posthogOpenFiltersUrl: `${posthogProjectBase}/activity/explore`,
        pageViews,
        sessionsStarted,
        scrollMilestones,
        recent: parsed.slice(0, 20),
        signals: buildSignals(pageViews, sessionsStarted, scrollMilestones, last, parsed),
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { kind: "error", message: `PostHog-query faalde. Controleer key, project-id en rechten (Query). ${msg.slice(0, 200)}` };
    }
  },
);

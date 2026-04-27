import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseMissingRelationError } from "@/lib/supabase/missing-relation";

export type PagePerformanceRow = {
  page_path: string;
  page_key: string;
  page_views: number;
  unique_visitors: number;
  clicks: number;
  click_through_rate_pct: number;
  conversions: number;
  conversion_rate_pct: number;
  avg_engagement_seconds: number;
  scroll_25: number;
  scroll_50: number;
  scroll_75: number;
  scroll_100: number;
  reach_25_pct: number;
  of_25_reach_50_pct: number;
  of_50_reach_75_pct: number;
  of_75_reach_100_pct: number;
  page_views_mobile: number;
  page_views_non_mobile: number;
};

export type CtaPerformanceRow = {
  analytics_id: string;
  label: string;
  element_role: string;
  section_id: string;
  page_path: string;
  clicks: number;
  unique_clickers: number;
  click_share: number;
  downstream_conversions: number;
  conversion_after_click_rate: number;
};

export type FunnelBlock = {
  page_view_sessions: number;
  engaged_sessions: number;
  cta_click_sessions: number;
  checkout_started_sessions: number;
  checkout_completed_sessions: number;
  pct_engaged_of_pageview: number;
  pct_cta_of_pageview: number;
  /** T.o.v. vorige funnelstap (keten). */
  pct_engaged_vs_pageview: number;
  pct_cta_vs_engaged: number;
  pct_checkout_vs_cta: number;
  pct_completed_vs_checkout: number;
};

export type SiteAnalyticsSummary = {
  page_views: number;
  clicks: number;
  conversions: number;
  unique_visitors: number;
};

export type SiteAnalyticsDashboardV2 = {
  version: 2;
  lookbackDays: number;
  sinceIso: string;
  summary: SiteAnalyticsSummary;
  page_performance: PagePerformanceRow[];
  cta_performance: CtaPerformanceRow[];
  funnel: FunnelBlock;
  scroll_by_depth_global: Record<string, number>;
  scroll_by_page: Array<{
    page_path: string;
    page_key: string;
    s25: number;
    s50: number;
    s75: number;
    s100: number;
  }>;
  device_breakdown: Record<string, number>;
  conversion_names: Record<string, number>;
  /** v1-achtige top paden wanneer alleen v1-RPC beschikbaar is (lege performance-tabellen). */
  legacyTopPages: { path: string; count: number }[];
};

function asNum(n: unknown): number {
  if (typeof n === "number" && Number.isFinite(n)) return n;
  const x = Number(n);
  return Number.isFinite(x) ? x : 0;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function buildFunnelBlock(raw: Record<string, unknown>): FunnelBlock {
  const a = asNum(raw.page_view_sessions);
  const b = asNum(raw.engaged_sessions);
  const c = asNum(raw.cta_click_sessions);
  const d = asNum(raw.checkout_started_sessions);
  const e = asNum(raw.checkout_completed_sessions);
  return {
    page_view_sessions: Math.floor(a),
    engaged_sessions: Math.floor(b),
    cta_click_sessions: Math.floor(c),
    checkout_started_sessions: Math.floor(d),
    checkout_completed_sessions: Math.floor(e),
    pct_engaged_of_pageview: asNum(raw.pct_engaged_of_pageview),
    pct_cta_of_pageview: asNum(raw.pct_cta_of_pageview),
    pct_engaged_vs_pageview: a > 0 ? round1((100 * b) / a) : 0,
    pct_cta_vs_engaged: b > 0 ? round1((100 * c) / b) : 0,
    pct_checkout_vs_cta: c > 0 ? round1((100 * d) / c) : 0,
    pct_completed_vs_checkout: d > 0 ? round1((100 * e) / d) : 0,
  };
}

function asPagePerfRows(v: unknown): PagePerformanceRow[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const o = row as Record<string, unknown>;
      return {
        page_path: String(o.page_path ?? ""),
        page_key: String(o.page_key ?? ""),
        page_views: asNum(o.page_views),
        unique_visitors: asNum(o.unique_visitors),
        clicks: asNum(o.clicks),
        click_through_rate_pct: asNum(o.click_through_rate_pct),
        conversions: asNum(o.conversions),
        conversion_rate_pct: asNum(o.conversion_rate_pct),
        avg_engagement_seconds: asNum(o.avg_engagement_seconds),
        scroll_25: asNum(o.scroll_25),
        scroll_50: asNum(o.scroll_50),
        scroll_75: asNum(o.scroll_75),
        scroll_100: asNum(o.scroll_100),
        reach_25_pct: asNum(o.reach_25_pct),
        of_25_reach_50_pct: asNum(o.of_25_reach_50_pct),
        of_50_reach_75_pct: asNum(o.of_50_reach_75_pct),
        of_75_reach_100_pct: asNum(o.of_75_reach_100_pct),
        page_views_mobile: asNum(o.page_views_mobile),
        page_views_non_mobile: asNum(o.page_views_non_mobile),
      };
    })
    .filter((x): x is PagePerformanceRow => x != null);
}

function asCtaRows(v: unknown): CtaPerformanceRow[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const o = row as Record<string, unknown>;
      return {
        analytics_id: String(o.analytics_id ?? ""),
        label: String(o.label ?? ""),
        element_role: String(o.element_role ?? ""),
        section_id: String(o.section_id ?? ""),
        page_path: String(o.page_path ?? ""),
        clicks: asNum(o.clicks),
        unique_clickers: asNum(o.unique_clickers),
        click_share: asNum(o.click_share),
        downstream_conversions: asNum(o.downstream_conversions),
        conversion_after_click_rate: asNum(o.conversion_after_click_rate),
      };
    })
    .filter((x): x is CtaPerformanceRow => x != null);
}

function asScrollByPage(v: unknown): SiteAnalyticsDashboardV2["scroll_by_page"] {
  if (!Array.isArray(v)) return [];
  return v
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const o = row as Record<string, unknown>;
      return {
        page_path: String(o.page_path ?? ""),
        page_key: String(o.page_key ?? ""),
        s25: asNum(o.s25),
        s50: asNum(o.s50),
        s75: asNum(o.s75),
        s100: asNum(o.s100),
      };
    })
    .filter((x) => x != null);
}

function asStrRecord(v: unknown): Record<string, number> {
  if (v == null || typeof v !== "object") return {};
  const out: Record<string, number> = {};
  for (const [k, n] of Object.entries(v as Record<string, unknown>)) {
    out[k] = asNum(n);
  }
  return out;
}

function parseV2Payload(data: unknown, lookbackDays: number, sinceIso: string): SiteAnalyticsDashboardV2 | null {
  if (data == null || typeof data !== "object") return null;
  const j = data as Record<string, unknown>;
  const s = j.summary;
  if (!s || typeof s !== "object") return null;
  const so = s as Record<string, unknown>;
  return {
    version: 2,
    lookbackDays,
    sinceIso,
    summary: {
      page_views: asNum(so.page_views),
      clicks: asNum(so.clicks),
      conversions: asNum(so.conversions),
      unique_visitors: asNum(so.unique_visitors),
    },
    page_performance: asPagePerfRows(j.page_performance),
    cta_performance: asCtaRows(j.cta_performance),
    funnel: buildFunnelBlock(
      (j.funnel && typeof j.funnel === "object" ? j.funnel : {}) as Record<string, unknown>,
    ),
    scroll_by_depth_global: asStrRecord(j.scroll_by_depth_global),
    scroll_by_page: asScrollByPage(j.scroll_by_page),
    device_breakdown: asStrRecord(j.device_breakdown),
    conversion_names: asStrRecord(j.conversion_names),
    legacyTopPages: [],
  };
}

function asV1PageRows(v: unknown): { path: string; count: number }[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const o = row as { path?: unknown; count?: unknown };
      const path = typeof o.path === "string" ? o.path : "";
      const c = asNum(o.count);
      if (!path) return null;
      return { path, count: c };
    })
    .filter((x): x is { path: string; count: number } => x != null);
}

/**
 * v1 → minimale v2: tabellen grotendeels leeg; toch een bruikbaar overzicht.
 */
function v1DataToV2(
  j: Record<string, unknown>,
  lookbackDays: number,
  sinceIso: string,
): SiteAnalyticsDashboardV2 {
  const top = asV1PageRows(j.top_pages);
  const clicks = asNum(j.page_views) > 0 ? Object.values(asStrRecord(j.clicks_by_key)).reduce((a, b) => a + b, 0) : 0;
  return {
    version: 2,
    lookbackDays,
    sinceIso,
    summary: {
      page_views: asNum(j.page_views),
      clicks: Number.isFinite(clicks) ? clicks : 0,
      conversions: asNum(j.conversions),
      unique_visitors: 0,
    },
    page_performance: top.map((t) => ({
      page_path: t.path,
      page_key: "—",
      page_views: t.count,
      unique_visitors: 0,
      clicks: 0,
      click_through_rate_pct: 0,
      conversions: 0,
      conversion_rate_pct: 0,
      avg_engagement_seconds: 0,
      scroll_25: 0,
      scroll_50: 0,
      scroll_75: 0,
      scroll_100: 0,
      reach_25_pct: 0,
      of_25_reach_50_pct: 0,
      of_50_reach_75_pct: 0,
      of_75_reach_100_pct: 0,
      page_views_mobile: 0,
      page_views_non_mobile: 0,
    })),
    cta_performance: Object.entries(asStrRecord(j.clicks_by_key))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 100)
      .map(([k, n]) => ({
        analytics_id: k,
        label: "",
        element_role: "other",
        section_id: "",
        page_path: "",
        clicks: n,
        unique_clickers: 0,
        click_share: 0,
        downstream_conversions: 0,
        conversion_after_click_rate: 0,
      })),
    funnel: {
      page_view_sessions: 0,
      engaged_sessions: 0,
      cta_click_sessions: 0,
      checkout_started_sessions: 0,
      checkout_completed_sessions: 0,
      pct_engaged_of_pageview: 0,
      pct_cta_of_pageview: 0,
      pct_engaged_vs_pageview: 0,
      pct_cta_vs_engaged: 0,
      pct_checkout_vs_cta: 0,
      pct_completed_vs_checkout: 0,
    },
    scroll_by_depth_global: (() => {
      const sd = asStrRecord((j as { scroll_by_depth?: unknown }).scroll_by_depth);
      return {
        "25": sd["25"] ?? 0,
        "50": sd["50"] ?? 0,
        "75": sd["75"] ?? 0,
        "100": sd["100"] ?? 0,
      };
    })(),
    scroll_by_page: [],
    device_breakdown: asStrRecord((j as { device_mix?: unknown }).device_mix),
    conversion_names: asStrRecord((j as { conversions_by_name?: unknown }).conversions_by_name),
    legacyTopPages: top,
  };
}

/**
 * Eerstepartij `/site` statistieken (laatste `lookbackDays`). Gebruikt `site_analytics_dashboard_v2` als beschikbaar, anders v1 met beperkte mapping.
 */
export async function getSiteAnalyticsDashboard(lookbackDays: number): Promise<SiteAnalyticsDashboardV2 | null> {
  const d = Math.min(90, Math.max(1, Math.floor(lookbackDays)));
  const since = new Date(Date.now() - d * 86_400_000).toISOString();
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.rpc("site_analytics_dashboard_v2", { p_since: since });
  if (!error && data != null) {
    const v2 = parseV2Payload(data, d, since);
    if (v2) return v2;
  } else if (error && process.env.NODE_ENV === "development") {
    if (!/site_analytics_dashboard_v2|function .* does not exist|PGRST202/i.test(String(error.message))) {
      if (!isSupabaseMissingRelationError(String(error.message))) {
        console.warn("[getSiteAnalyticsDashboard] v2", error.message);
      }
    }
  }

  const { data: data1, error: err1 } = await supabase.rpc("site_analytics_dashboard", { p_since: since });
  if (err1) {
    if (
      isSupabaseMissingRelationError(err1.message) ||
      /site_analytics_dashboard|site_analytics_events/i.test(err1.message)
    ) {
      return null;
    }
    if (process.env.NODE_ENV === "development") {
      console.warn("[getSiteAnalyticsDashboard] v1", err1.message);
    }
    return null;
  }
  if (data1 == null || typeof data1 !== "object") return null;
  return v1DataToV2(data1 as Record<string, unknown>, d, since);
}

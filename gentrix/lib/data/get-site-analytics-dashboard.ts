import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseMissingRelationError } from "@/lib/supabase/missing-relation";

export type SiteAnalyticsDashboard = {
  page_views: number;
  clicks_by_key: Record<string, number>;
  conversions: number;
  conversions_by_name: Record<string, number>;
  scroll_by_depth: Record<string, number>;
  engagement: Record<string, number>;
  top_pages: { path: string; count: number }[];
  device_mix: Record<string, number>;
};

function asNumRecord(v: unknown): Record<string, number> {
  if (v == null || typeof v !== "object") return {};
  const out: Record<string, number> = {};
  for (const [k, n] of Object.entries(v as Record<string, unknown>)) {
    const x = typeof n === "number" ? n : Number(n);
    if (Number.isFinite(x)) out[k] = x;
  }
  return out;
}

function asPageRows(v: unknown): { path: string; count: number }[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const o = row as { path?: unknown; count?: unknown };
      const path = typeof o.path === "string" ? o.path : "";
      const c = typeof o.count === "number" ? o.count : Number(o.count);
      if (!path || !Number.isFinite(c)) return null;
      return { path, count: c };
    })
    .filter((x): x is { path: string; count: number } => x != null);
}

/** Eerstepartij /site statistieken (laatste `lookbackDays`), voor admin/ops. */
export async function getSiteAnalyticsDashboard(lookbackDays: number): Promise<SiteAnalyticsDashboard | null> {
  const d = Math.min(90, Math.max(1, Math.floor(lookbackDays)));
  const since = new Date(Date.now() - d * 86_400_000).toISOString();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("site_analytics_dashboard", { p_since: since });
  if (error) {
    if (isSupabaseMissingRelationError(error.message) || /site_analytics_dashboard|site_analytics_events/i.test(error.message)) {
      return null;
    }
    if (process.env.NODE_ENV === "development") {
      console.warn("[getSiteAnalyticsDashboard]", error.message);
    }
    return null;
  }
  if (data == null || typeof data !== "object") return null;
  const j = data as Record<string, unknown>;
  return {
    page_views: typeof j.page_views === "number" ? j.page_views : 0,
    clicks_by_key: asNumRecord(j.clicks_by_key),
    conversions: typeof j.conversions === "number" ? j.conversions : 0,
    conversions_by_name: asNumRecord(j.conversions_by_name),
    scroll_by_depth: asNumRecord(j.scroll_by_depth),
    engagement: asNumRecord(j.engagement),
    top_pages: asPageRows(j.top_pages),
    device_mix: asNumRecord(j.device_mix),
  };
}

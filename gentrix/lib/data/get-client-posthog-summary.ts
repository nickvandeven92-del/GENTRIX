import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ClientPosthogSummaryRecent = {
  event: string;
  at: string;
  pageKey: string | null;
  path: string | null;
};

export type ClientPosthogSummaryRow = {
  client_id: string;
  subfolder_slug: string;
  lookback_days: number;
  pageviews: number;
  sessions_started: number;
  scroll_milestones: number;
  last_event_at: string | null;
  signals: string[];
  recent_events: ClientPosthogSummaryRecent[];
  fetch_error: string | null;
  fetched_at: string;
  updated_at: string;
};

function parseJsonArray<T>(v: unknown, fallback: T[]): T[] {
  if (v == null) return fallback;
  if (Array.isArray(v)) return v as T[];
  return fallback;
}

/** Leest gecachte PostHog-samenvatting voor het dossier (RLS: ingelogde admin). */
export async function getClientPosthogSummary(clientId: string): Promise<ClientPosthogSummaryRow | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("client_posthog_summary")
    .select(
      "client_id, subfolder_slug, lookback_days, pageviews, sessions_started, scroll_milestones, last_event_at, signals, recent_events, fetch_error, fetched_at, updated_at",
    )
    .eq("client_id", clientId)
    .maybeSingle();

  if (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[getClientPosthogSummary]", error.message);
    }
    return null;
  }
  if (!data) return null;
  const r = data as unknown as {
    client_id: string;
    subfolder_slug: string;
    lookback_days: number;
    pageviews: number;
    sessions_started: number;
    scroll_milestones: number;
    last_event_at: string | null;
    signals: unknown;
    recent_events: unknown;
    fetch_error: string | null;
    fetched_at: string;
    updated_at: string;
  };
  return {
    ...r,
    signals: parseJsonArray<string>(r.signals, []),
    recent_events: parseJsonArray<ClientPosthogSummaryRecent>(r.recent_events, []),
  };
}

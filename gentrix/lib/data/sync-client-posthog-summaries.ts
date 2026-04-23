import { fetchPosthogDossierData } from "@/lib/posthog/posthog-dossier-insight";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

type ClientRow = { id: string; subfolder_slug: string };

const MAX_CLIENTS = 400;
const MS_BETWEEN = 80;

/**
 * Voor elke klant: PostHog opvragen en `client_posthog_summary` upserten.
 * Alleen server/cron; service role.
 */
export async function syncAllClientPosthogSummaries(): Promise<{
  ok: boolean;
  updated: number;
  skipped: number;
  errors: string[];
}> {
  const supabase = createServiceRoleClient();
  const { data: clients, error: listErr } = await supabase
    .from("clients")
    .select("id, subfolder_slug")
    .not("subfolder_slug", "is", null)
    .limit(MAX_CLIENTS);

  if (listErr || !clients?.length) {
    return {
      ok: false,
      updated: 0,
      skipped: 0,
      errors: [listErr?.message ?? "Geen clients of lijst-fout."],
    };
  }

  const rows = (clients as ClientRow[]).filter((c) => c.subfolder_slug?.trim());
  let updated = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const c = rows[i]!;
    const vm = await fetchPosthogDossierData(c.subfolder_slug.trim());
    if (vm.kind === "unconfigured") {
      skipped += 1;
      continue;
    }
    if (vm.kind === "error") {
      const { error: upErr } = await supabase.from("client_posthog_summary").upsert(
        {
          client_id: c.id,
          subfolder_slug: c.subfolder_slug.trim(),
          lookback_days: 7,
          pageviews: 0,
          sessions_started: 0,
          scroll_milestones: 0,
          last_event_at: null,
          signals: [],
          recent_events: [],
          fetch_error: vm.message,
          fetched_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "client_id" },
      );
      if (upErr) errors.push(`${c.subfolder_slug}: ${upErr.message}`);
      else updated += 1;
    } else {
      const { error: upErr } = await supabase.from("client_posthog_summary").upsert(
        {
          client_id: c.id,
          subfolder_slug: c.subfolder_slug.trim(),
          lookback_days: vm.lookbackDays,
          pageviews: vm.pageViews,
          sessions_started: vm.sessionsStarted,
          scroll_milestones: vm.scrollMilestones,
          last_event_at: vm.lastEventAt,
          signals: vm.signals,
          recent_events: vm.recent.map((e) => ({
            event: e.event,
            at: e.at,
            pageKey: e.pageKey,
            path: e.path,
          })),
          fetch_error: null,
          fetched_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "client_id" },
      );
      if (upErr) {
        errors.push(`${c.subfolder_slug}: ${upErr.message}`);
      } else {
        updated += 1;
      }
    }
    if (i < rows.length - 1 && MS_BETWEEN > 0) {
      await new Promise((r) => setTimeout(r, MS_BETWEEN));
    }
  }

  return { ok: errors.length === 0, updated, skipped, errors: errors.slice(0, 25) };
}

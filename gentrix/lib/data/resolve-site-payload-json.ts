import { createServiceRoleClient } from "@/lib/supabase/service-role";
export type ClientPayloadPointersRow = {
  site_data_json: unknown;
  draft_snapshot_id: string | null;
  published_snapshot_id: string | null;
};

async function fetchPayloadJsonBySnapshotId(snapshotId: string): Promise<unknown | null> {
  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("site_snapshots")
      .select("payload_json")
      .eq("id", snapshotId)
      .maybeSingle();

    if (error || !data) return null;
    return data.payload_json as unknown;
  } catch {
    /* Ontbrekende service role, RLS, of netwerk: val terug op site_data_json. */
    return null;
  }
}

/**
 * Werkversie voor editor / export / generator-upgrade: draft-snapshot, anders kolom `site_data_json`.
 */
export async function resolveDraftSitePayloadJson(row: ClientPayloadPointersRow): Promise<unknown> {
  if (row.draft_snapshot_id) {
    const fromSnap = await fetchPayloadJsonBySnapshotId(row.draft_snapshot_id);
    if (fromSnap != null) return fromSnap;
  }
  return row.site_data_json;
}

/**
 * Live site (actieve klant): published-snapshot, anders legacy `site_data_json`.
 */
export async function resolvePublishedSitePayloadJson(row: ClientPayloadPointersRow): Promise<unknown> {
  if (row.published_snapshot_id) {
    const fromSnap = await fetchPayloadJsonBySnapshotId(row.published_snapshot_id);
    if (fromSnap != null) return fromSnap;
  }
  return row.site_data_json;
}

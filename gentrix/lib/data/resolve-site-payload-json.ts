import { unstable_cache } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
export type ClientPayloadPointersRow = {
  site_data_json: unknown;
  draft_snapshot_id: string | null;
  published_snapshot_id: string | null;
};

async function _fetchSiteSnapshotPayloadJson(snapshotId: string): Promise<unknown | null> {
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
 * Snapshots zijn immutable na publicatie. Cache 1 uur — bij nieuwe publish ontstaat een nieuw ID.
 * O.a. live-site merge: concept-snapshot kan nieuwere `marketingPages` hebben dan `published_snapshot_id`.
 */
export const fetchSiteSnapshotPayloadJson = unstable_cache(
  _fetchSiteSnapshotPayloadJson,
  ["site-snapshot"],
  { revalidate: 3600, tags: ["site-snapshot"] },
);

/**
 * Werkversie voor editor / export / generator-upgrade: draft-snapshot, anders kolom `site_data_json`.
 */
export async function resolveDraftSitePayloadJson(row: ClientPayloadPointersRow): Promise<unknown> {
  if (row.draft_snapshot_id) {
    const fromSnap = await fetchSiteSnapshotPayloadJson(row.draft_snapshot_id);
    if (fromSnap != null) return fromSnap;
  }
  return row.site_data_json;
}

/**
 * Live site (actieve klant): published-snapshot, anders legacy `site_data_json`.
 */
export async function resolvePublishedSitePayloadJson(row: ClientPayloadPointersRow): Promise<unknown> {
  if (row.published_snapshot_id) {
    const fromSnap = await fetchSiteSnapshotPayloadJson(row.published_snapshot_id);
    if (fromSnap != null) return fromSnap;
  }
  return row.site_data_json;
}

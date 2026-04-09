import { createServiceRoleClient } from "@/lib/supabase/service-role";

export async function getClientRowForSiteOps(subfolderSlug: string): Promise<{
  id: string;
  draft_snapshot_id: string | null;
  published_snapshot_id: string | null;
} | null> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("clients")
    .select("id, draft_snapshot_id, published_snapshot_id")
    .eq("subfolder_slug", subfolderSlug)
    .maybeSingle();
  if (error || !data) return null;
  return {
    id: data.id,
    draft_snapshot_id: data.draft_snapshot_id ?? null,
    published_snapshot_id: data.published_snapshot_id ?? null,
  };
}

export async function assertSnapshotOwnedByClient(
  clientId: string,
  snapshotId: string,
): Promise<{ payload_json: unknown } | null> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("site_snapshots")
    .select("id, client_id, payload_json")
    .eq("id", snapshotId)
    .maybeSingle();
  if (error || !data || data.client_id !== clientId) return null;
  return { payload_json: data.payload_json as unknown };
}

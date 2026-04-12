import { tryMarkLatestGenerationRunOutcome } from "@/lib/data/log-site-generation-run";
import { assertSnapshotOwnedByClient, getClientRowForSiteOps } from "@/lib/data/site-snapshot-admin";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { Json } from "@/lib/types/database";

export type PublishClientSnapshotResult =
  | {
      ok: true;
      published_snapshot_id: string;
      is_publicly_visible: boolean;
      visibility_hint: string | null;
    }
  | { ok: false; error: string; status: 400 | 404 | 500 };

/**
 * Zet `published_snapshot_id` + `site_data_json` op de gekozen snapshot (standaard huidige draft).
 */
export async function publishClientSnapshotForSlug(
  subfolderSlug: string,
  snapshotId?: string | null,
): Promise<PublishClientSnapshotResult> {
  const client = await getClientRowForSiteOps(subfolderSlug);
  if (!client) {
    return { ok: false, error: "Klant niet gevonden.", status: 404 };
  }

  const targetId = snapshotId?.trim() || client.draft_snapshot_id;
  if (!targetId) {
    return { ok: false, error: "Geen concept-snapshot om te publiceren.", status: 400 };
  }

  const owned = await assertSnapshotOwnedByClient(client.id, targetId);
  if (!owned) {
    return { ok: false, error: "Snapshot hoort niet bij deze klant.", status: 400 };
  }

  const supabase = createServiceRoleClient();
  const { error } = await supabase
    .from("clients")
    .update({
      published_snapshot_id: targetId,
      site_data_json: owned.payload_json as Json,
      updated_at: new Date().toISOString(),
    })
    .eq("id", client.id);

  if (error) {
    return { ok: false, error: error.message, status: 500 };
  }

  await tryMarkLatestGenerationRunOutcome(client.id, "published");

  const publiclyVisible = client.status === "active";

  return {
    ok: true,
    published_snapshot_id: targetId,
    is_publicly_visible: publiclyVisible,
    visibility_hint: publiclyVisible
      ? null
      : "De live-inhoud staat klaar, maar /site/… is pas zichtbaar voor iedereen als de klantstatus Actief is (bijv. na betaling). Deel tot die tijd de concept-preview-URL.",
  };
}

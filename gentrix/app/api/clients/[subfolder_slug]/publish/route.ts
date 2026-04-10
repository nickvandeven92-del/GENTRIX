import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApiAuth } from "@/lib/auth/require-admin-api";
import { tryMarkLatestGenerationRunOutcome } from "@/lib/data/log-site-generation-run";
import { assertSnapshotOwnedByClient, getClientRowForSiteOps } from "@/lib/data/site-snapshot-admin";
import { isValidSubfolderSlug } from "@/lib/slug";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { Json } from "@/lib/types/database";

const bodySchema = z.object({ snapshot_id: z.string().uuid().optional() }).optional();

type RouteContext = { params: Promise<{ subfolder_slug: string }> };

/**
 * Fase 3: zet de **live** site op een bestaande snapshot (standaard = huidige concept).
 * Wijzigt niet `clients.status`; publieke URL vereist nog steeds `active`.
 */
export async function POST(request: Request, context: RouteContext) {
  const auth = await requireAdminApiAuth();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.message }, { status: auth.status });
  }

  const { subfolder_slug: raw } = await context.params;
  const subfolder_slug = decodeURIComponent(raw);
  if (!isValidSubfolderSlug(subfolder_slug)) {
    return NextResponse.json({ ok: false, error: "Ongeldige slug." }, { status: 400 });
  }

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Ongeldige body." }, { status: 400 });
  }

  const client = await getClientRowForSiteOps(subfolder_slug);
  if (!client) {
    return NextResponse.json({ ok: false, error: "Klant niet gevonden." }, { status: 404 });
  }

  const targetId = parsed.data?.snapshot_id ?? client.draft_snapshot_id;
  if (!targetId) {
    return NextResponse.json({ ok: false, error: "Geen concept-snapshot om te publiceren." }, { status: 400 });
  }

  const owned = await assertSnapshotOwnedByClient(client.id, targetId);
  if (!owned) {
    return NextResponse.json({ ok: false, error: "Snapshot hoort niet bij deze klant." }, { status: 400 });
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
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  await tryMarkLatestGenerationRunOutcome(client.id, "published");

  const publiclyVisible = client.status === "active";

  return NextResponse.json({
    ok: true,
    data: {
      published_snapshot_id: targetId,
      is_publicly_visible: publiclyVisible,
      visibility_hint: publiclyVisible
        ? null
        : "De live-inhoud staat klaar, maar /site/… is pas zichtbaar voor iedereen als de klantstatus Actief is (bijv. na betaling). Deel tot die tijd de concept-preview-URL.",
    },
  });
}

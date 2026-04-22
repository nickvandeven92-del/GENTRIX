import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStudioAdminApiAuth } from "@/lib/auth/require-studio-admin-api";
import { assertSnapshotOwnedByClient, getClientRowForSiteOps } from "@/lib/data/site-snapshot-admin";
import { isValidSubfolderSlug } from "@/lib/slug";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { Json } from "@/lib/types/database";

const bodySchema = z.object({ snapshot_id: z.string().uuid() });

type RouteContext = { params: Promise<{ subfolder_slug: string }> };

/** Zet het **concept** terug naar een eerdere snapshot (fase 4). Live blijft ongewijzigd. */
export async function POST(request: Request, context: RouteContext) {
  const auth = await requireStudioAdminApiAuth();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.message }, { status: auth.status });
  }

  const { subfolder_slug: raw } = await context.params;
  const subfolder_slug = decodeURIComponent(raw);
  if (!isValidSubfolderSlug(subfolder_slug)) {
    return NextResponse.json({ ok: false, error: "Ongeldige slug." }, { status: 400 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Ongeldige JSON." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "snapshot_id verplicht (uuid)." }, { status: 400 });
  }

  const client = await getClientRowForSiteOps(subfolder_slug);
  if (!client) {
    return NextResponse.json({ ok: false, error: "Klant niet gevonden." }, { status: 404 });
  }

  const owned = await assertSnapshotOwnedByClient(client.id, parsed.data.snapshot_id);
  if (!owned) {
    return NextResponse.json({ ok: false, error: "Snapshot hoort niet bij deze klant." }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  const { error } = await supabase
    .from("clients")
    .update({
      draft_snapshot_id: parsed.data.snapshot_id,
      site_data_json: owned.payload_json as Json,
      updated_at: new Date().toISOString(),
    })
    .eq("id", client.id);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, data: { draft_snapshot_id: parsed.data.snapshot_id } });
}

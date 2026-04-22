import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStudioAdminApiAuth } from "@/lib/auth/require-studio-admin-api";
import { getClientRowForSiteOps } from "@/lib/data/site-snapshot-admin";
import { isValidSubfolderSlug } from "@/lib/slug";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { isPostgrestUnknownColumnError } from "@/lib/supabase/postgrest-unknown-column";

const patchSchema = z.object({
  label: z.string().max(200).nullable().optional(),
  notes: z.string().max(4000).nullable().optional(),
});

type RouteContext = { params: Promise<{ subfolder_slug: string; snapshot_id: string }> };

/** Label / notities op snapshot (fase 4). */
export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireStudioAdminApiAuth();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.message }, { status: auth.status });
  }

  const { subfolder_slug: raw, snapshot_id } = await context.params;
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

  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Ongeldige velden." }, { status: 400 });
  }

  const client = await getClientRowForSiteOps(subfolder_slug);
  if (!client) {
    return NextResponse.json({ ok: false, error: "Klant niet gevonden." }, { status: 404 });
  }

  const supabase = createServiceRoleClient();
  const { data: row, error: qErr } = await supabase
    .from("site_snapshots")
    .select("id")
    .eq("id", snapshot_id)
    .eq("client_id", client.id)
    .maybeSingle();

  if (qErr || !row) {
    return NextResponse.json({ ok: false, error: "Snapshot niet gevonden." }, { status: 404 });
  }

  const updates: Record<string, string | null> = {};
  if (parsed.data.label !== undefined) updates.label = parsed.data.label;
  if (parsed.data.notes !== undefined) updates.notes = parsed.data.notes;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ ok: true, data: { id: snapshot_id } });
  }

  const { error } = await supabase.from("site_snapshots").update(updates).eq("id", snapshot_id);

  if (error && isPostgrestUnknownColumnError(error, "label")) {
    return NextResponse.json(
      { ok: false, error: "Kolommen label/notes ontbreken — migratie 20260404163000 uitvoeren." },
      { status: 503 },
    );
  }

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, data: { id: snapshot_id } });
}

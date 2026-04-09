import { NextResponse } from "next/server";
import { requireAdminApiAuth } from "@/lib/auth/require-admin-api";
import { getClientRowForSiteOps } from "@/lib/data/site-snapshot-admin";
import { isValidSubfolderSlug } from "@/lib/slug";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { isPostgrestUnknownColumnError } from "@/lib/supabase/postgrest-unknown-column";

type RouteContext = { params: Promise<{ subfolder_slug: string }> };

/** Lijst snapshots + huidige draft/live pointers (fase 4). */
export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireAdminApiAuth();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.message }, { status: auth.status });
  }

  const { subfolder_slug: raw } = await context.params;
  const subfolder_slug = decodeURIComponent(raw);
  if (!isValidSubfolderSlug(subfolder_slug)) {
    return NextResponse.json({ ok: false, error: "Ongeldige slug." }, { status: 400 });
  }

  const client = await getClientRowForSiteOps(subfolder_slug);
  if (!client) {
    return NextResponse.json({ ok: false, error: "Klant niet gevonden." }, { status: 404 });
  }

  const supabase = createServiceRoleClient();
  let { data: snapshots, error } = await supabase
    .from("site_snapshots")
    .select("id, created_at, source, label, notes, created_by, parent_snapshot_id")
    .eq("client_id", client.id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (
    error &&
    (isPostgrestUnknownColumnError(error, "created_by") ||
      isPostgrestUnknownColumnError(error, "label"))
  ) {
    const second = await supabase
      .from("site_snapshots")
      .select("id, created_at, source, parent_snapshot_id")
      .eq("client_id", client.id)
      .order("created_at", { ascending: false })
      .limit(100);
    snapshots = (second.data ?? []).map((s) => ({
      ...s,
      label: null as string | null,
      notes: null as string | null,
      created_by: null as string | null,
    }));
    error = second.error;
  }

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    data: {
      draft_snapshot_id: client.draft_snapshot_id,
      published_snapshot_id: client.published_snapshot_id,
      snapshots: snapshots ?? [],
    },
  });
}

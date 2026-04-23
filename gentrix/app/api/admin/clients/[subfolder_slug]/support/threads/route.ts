import { NextResponse } from "next/server";
import { requireStudioAdminApiAuth } from "@/lib/auth/require-studio-admin-api";
import { getAdminClientBySlug } from "@/lib/data/get-admin-client-by-slug";
import { isValidSubfolderSlug } from "@/lib/slug";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ subfolder_slug: string }> };

export async function GET(request: Request, context: RouteContext) {
  const auth = await requireStudioAdminApiAuth();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.message }, { status: auth.status });
  }

  const { subfolder_slug: raw } = await context.params;
  const subfolder_slug = decodeURIComponent(raw);
  if (!isValidSubfolderSlug(subfolder_slug)) {
    return NextResponse.json({ ok: false, error: "Ongeldige slug." }, { status: 400 });
  }

  const client = await getAdminClientBySlug(subfolder_slug);
  if (!client) {
    return NextResponse.json({ ok: false, error: "Klant niet gevonden." }, { status: 404 });
  }

  const url = new URL(request.url);
  const scope = url.searchParams.get("scope") ?? "all";
  const scopeNorm = scope === "open" || scope === "closed" ? scope : "all";

  const supabase = await createSupabaseServerClient();
  let q = supabase
    .from("client_support_threads")
    .select("id, client_id, status, subject, created_at, updated_at, closed_at")
    .eq("client_id", client.id)
    .order("updated_at", { ascending: false })
    .limit(200);

  if (scopeNorm === "open") q = q.eq("status", "open");
  else if (scopeNorm === "closed") q = q.eq("status", "closed");

  const { data, error } = await q;

  if (error) {
    const msg = error.message ?? "";
    if (msg.toLowerCase().includes("does not exist") || msg.toLowerCase().includes("schema cache")) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Support-tabellen ontbreken. Voer migratie 20260430140000_client_support_chat.sql uit in Supabase.",
        },
        { status: 503 },
      );
    }
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }

  return NextResponse.json({ ok: true, threads: data ?? [] });
}

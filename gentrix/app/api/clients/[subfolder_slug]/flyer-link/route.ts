import { NextResponse } from "next/server";
import { requireStudioAdminApiAuth } from "@/lib/auth/require-studio-admin-api";
import { ensureClientFlyerPublicTokenBySlug } from "@/lib/data/ensure-client-flyer-token";
import { getPublicAppUrl } from "@/lib/site/public-app-url";
import { getRequestOrigin } from "@/lib/site/request-origin";
import { isValidSubfolderSlug } from "@/lib/slug";
import { isPostgrestUnknownColumnError } from "@/lib/supabase/postgrest-unknown-column";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const maxDuration = 30;

type RouteContext = { params: Promise<{ subfolder_slug: string }> };

/**
 * Admin: controleert DB + zorgt voor `flyer_public_token`, antwoordt met absolute `/p/…`-URL.
 * Handig als de pagina nog geen link toonde (migratie net gezet, schema-cache, of eerste write).
 */
export async function POST(_request: Request, context: RouteContext) {
  const auth = await requireStudioAdminApiAuth();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.message }, { status: auth.status });
  }

  const { subfolder_slug: raw } = await context.params;
  const slug = decodeURIComponent(raw);
  if (!isValidSubfolderSlug(slug)) {
    return NextResponse.json({ ok: false, error: "Ongeldige slug." }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("clients")
    .select("id, flyer_public_token")
    .eq("subfolder_slug", slug)
    .maybeSingle();

  if (error && isPostgrestUnknownColumnError(error, "flyer_public_token")) {
    return NextResponse.json(
      {
        ok: false,
        code: "missing_column",
        error:
          "Kolom `flyer_public_token` bestaat nog niet in deze database. Voer de migratie uit op het Supabase-project dat bij deze app hoort, en ververs daarna de API-schema-cache (Dashboard → Project Settings → API).",
      },
      { status: 503 },
    );
  }

  if (error) {
    return NextResponse.json(
      { ok: false, code: "db_error", error: error.message || "Supabase-fout bij lezen van clients." },
      { status: 500 },
    );
  }

  if (!data?.id) {
    return NextResponse.json({ ok: false, code: "not_found", error: "Klant niet gevonden." }, { status: 404 });
  }

  const token = await ensureClientFlyerPublicTokenBySlug(slug);
  if (!token) {
    return NextResponse.json(
      {
        ok: false,
        code: "ensure_failed",
        error:
          "Geen token kunnen aanmaken of lezen. Controleer `SUPABASE_SERVICE_ROLE_KEY` in de server-omgeving (zelfde project als de migratie) en of RLS/triggers updates op `clients` niet blokkeren voor de service role.",
      },
      { status: 503 },
    );
  }

  const origin = ((await getRequestOrigin()) || getPublicAppUrl()).replace(/\/$/, "");
  const url = `${origin}/p/${encodeURIComponent(token)}`;

  return NextResponse.json({ ok: true, url });
}

import { NextResponse } from "next/server";
import { requireAdminApiAuth } from "@/lib/auth/require-admin-api";
import { ensureClientFlyerPublicTokenBySlug } from "@/lib/data/ensure-client-flyer-token";
import { buildClientFlyerPdf, type FlyerPdfTemplateId } from "@/lib/flyer/build-client-flyer-pdf";
import { getPublicAppUrl } from "@/lib/site/public-app-url";
import { getRequestOrigin } from "@/lib/site/request-origin";
import { isValidSubfolderSlug } from "@/lib/slug";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const maxDuration = 60;

type RouteContext = { params: Promise<{ subfolder_slug: string }> };

function templateFromSearch(search: string | null): FlyerPdfTemplateId {
  return search === "modern" ? "modern" : "minimal";
}

/** Admin: download vaste A4-flyer met QR naar `/p/{token}`. */
export async function GET(request: Request, context: RouteContext) {
  const auth = await requireAdminApiAuth();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.message }, { status: auth.status });
  }

  const { subfolder_slug: raw } = await context.params;
  const slug = decodeURIComponent(raw);
  if (!isValidSubfolderSlug(slug)) {
    return NextResponse.json({ ok: false, error: "Ongeldige slug." }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const template = templateFromSearch(searchParams.get("template"));

  const supabase = createServiceRoleClient();
  const { data: row, error } = await supabase.from("clients").select("name").eq("subfolder_slug", slug).maybeSingle();
  if (error || !row) {
    return NextResponse.json({ ok: false, error: "Klant niet gevonden." }, { status: 404 });
  }

  const token = await ensureClientFlyerPublicTokenBySlug(slug);
  if (!token) {
    return NextResponse.json(
      { ok: false, error: "Flyer-token ontbreekt (migratie flyer_public_token?)." },
      { status: 503 },
    );
  }

  const origin = ((await getRequestOrigin()) || getPublicAppUrl()).replace(/\/$/, "");
  const flyerPageUrl = `${origin}/p/${encodeURIComponent(token)}`;
  const displayName = String((row as { name?: string }).name ?? "").trim() || slug;

  const bytes = await buildClientFlyerPdf({
    template,
    clientDisplayName: displayName,
    flyerPageUrl,
  });

  const safeSlug = slug.replace(/[^a-z0-9-]+/gi, "-").slice(0, 48);
  const filename = `flyer-${safeSlug}-${template}.pdf`;

  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

import { NextResponse } from "next/server";
import { requireStudioAdminApiAuth } from "@/lib/auth/require-studio-admin-api";
import { getAdminClientBySlug } from "@/lib/data/get-admin-client-by-slug";
import { originFromRequest } from "@/lib/http/origin-from-request";
import { isValidSubfolderSlug } from "@/lib/slug";
import {
  PromoVideoUnavailableError,
  recordPublicSitePromoZip,
} from "@/lib/video/record-public-site-scroll";

type RouteContext = { params: Promise<{ subfolder_slug: string }> };

export const runtime = "nodejs";

/** Twee clips (mobiel + desktop), elk ~30s scroll + load — lokaal/VPS. */
export const maxDuration = 300;

function safeFileBase(slug: string): string {
  const s = slug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-|-$/g, "");
  return s.length >= 2 ? s : "site";
}

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

  const row = await getAdminClientBySlug(subfolder_slug);
  if (!row) {
    return NextResponse.json({ ok: false, error: "Klant niet gevonden." }, { status: 404 });
  }

  if (row.status !== "active") {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Promo-video werkt alleen als de site status Actief heeft — de publieke URL /site/… is dan bereikbaar. Zet de klant tijdelijk op actief of publiceer eerst.",
      },
      { status: 422 },
    );
  }

  let origin: string;
  try {
    origin = originFromRequest(request);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ongeldige request.";
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }

  const pageUrl = `${origin}/site/${encodeURIComponent(subfolder_slug)}`;

  try {
    const buffer = await recordPublicSitePromoZip(pageUrl);
    const base = safeFileBase(subfolder_slug);
    const filename = `${base}-promo-video.zip`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    if (e instanceof PromoVideoUnavailableError) {
      return NextResponse.json({ ok: false, error: e.message }, { status: 501 });
    }
    const msg = e instanceof Error ? e.message : "Opname mislukt.";
    return NextResponse.json(
      { ok: false, error: `Promo-video mislukt: ${msg}` },
      { status: 500 },
    );
  }
}

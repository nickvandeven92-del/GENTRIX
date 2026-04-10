import { type NextRequest, NextResponse } from "next/server";
import { isValidSubfolderSlug } from "@/lib/slug";

/**
 * Optioneel: toon een gepubliceerde klant-site op `/` (zelfde handler als `/site/[slug]`).
 * Zet `LANDING_SITE_ROOT_SLUG` op de `subfolder_slug` (bijv. `gentrix`). Leeg laten = vaste showroom op `/`.
 * Alleen GET/HEAD; andere methoden niet herschrijven.
 */
export function maybeRewritePrimaryLandingSite(request: NextRequest): NextResponse | null {
  const m = request.method;
  if (m !== "GET" && m !== "HEAD") return null;

  if (request.nextUrl.pathname !== "/") return null;

  const raw = process.env.LANDING_SITE_ROOT_SLUG?.trim() ?? "";
  if (!raw || !isValidSubfolderSlug(raw)) return null;

  const url = request.nextUrl.clone();
  url.pathname = `/site/${encodeURIComponent(raw)}`;
  return NextResponse.rewrite(url);
}

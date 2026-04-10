import { type NextRequest, NextResponse } from "next/server";
import { isPrimaryStudioHost, normalizeRequestHost } from "@/lib/domains/request-host";
import { isValidSubfolderSlug, STUDIO_HOMEPAGE_SUBFOLDER_SLUG } from "@/lib/slug";

const LANDING_OFF_VALUES = new Set(["off", "showroom", "false", "0", "none"]);

/**
 * Optioneel: toon een gepubliceerde klant-site op `/` (zelfde handler als `/site/[slug]`).
 *
 * - `LANDING_SITE_ROOT_SLUG` = geldige `subfolder_slug` → altijd die slug (alle hosts waar deze middleware draait).
 * - `LANDING_SITE_ROOT_SLUG` = `off` / `showroom` / `false` / `0` / `none` → geen rewrite (vaste showroom op `/`).
 * - Niet gezet: op **NEXT_PUBLIC_PRIMARY_HOST** (of alias) standaard **`home`** — dezelfde slug als de generator-studio-homepage (`STUDIO_HOMEPAGE_SUBFOLDER_SLUG`), zodat “slug home in de generator” = landingspagina op je studio-domein.
 * - Niet gezet en geen primary host: showroom op `/`.
 *
 * Alleen GET/HEAD; andere methoden niet herschrijven.
 */
export function resolveLandingSiteRootSlug(request: NextRequest): string | null {
  const raw = process.env.LANDING_SITE_ROOT_SLUG?.trim() ?? "";
  const lowered = raw.toLowerCase();

  if (raw && LANDING_OFF_VALUES.has(lowered)) {
    return null;
  }

  if (raw && isValidSubfolderSlug(raw)) {
    return raw;
  }

  if (raw) {
    return null;
  }

  const host = normalizeRequestHost(request.headers.get("host"));
  if (!host || !isPrimaryStudioHost(host)) {
    return null;
  }

  return STUDIO_HOMEPAGE_SUBFOLDER_SLUG;
}

export function maybeRewritePrimaryLandingSite(request: NextRequest): NextResponse | null {
  const m = request.method;
  if (m !== "GET" && m !== "HEAD") return null;

  if (request.nextUrl.pathname !== "/") return null;

  const slug = resolveLandingSiteRootSlug(request);
  if (!slug || !isValidSubfolderSlug(slug)) return null;

  const url = request.nextUrl.clone();
  url.pathname = `/site/${encodeURIComponent(slug)}`;
  return NextResponse.rewrite(url);
}

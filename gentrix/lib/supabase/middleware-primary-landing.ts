import { type NextRequest, NextResponse } from "next/server";
import { isCandidateForLandingSitePrettyUrl } from "@/lib/domains/reserved-paths";
import { isPrimaryStudioHost, normalizeRequestHost } from "@/lib/domains/request-host";
import { isValidSubfolderSlug, STUDIO_HOMEPAGE_SUBFOLDER_SLUG } from "@/lib/slug";

const LANDING_OFF_VALUES = new Set(["off", "showroom", "false", "0", "none"]);

/** Request-header namen die subroutes/pages kunnen uitlezen om pretty-URL gedrag te activeren. */
export const PRETTY_URL_HOST_HEADER = "x-gentrix-pretty-url-host";
export const PRETTY_URL_BASE_PATH_HEADER = "x-gentrix-pretty-url-base-path";

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

/**
 * Interne doelpadberekening voor pretty-URL rewrites:
 * - `/` → `/site/{slug}`
 * - `/werkwijze` → `/site/{slug}/werkwijze` (generieke marketing-subpagina)
 * - `/contact` → `/site/{slug}/contact` (dedicated contact-route)
 *
 * Geeft `null` voor gereserveerde routes (app-shell, `/api/...`, `/site/...`, statics).
 */
function resolvePrettyUrlInternalPath(pathname: string, slug: string): string | null {
  const encSlug = encodeURIComponent(slug);
  if (pathname === "/" || pathname === "") return `/site/${encSlug}`;

  if (!isCandidateForLandingSitePrettyUrl(pathname)) return null;

  const seg = pathname.replace(/^\/+|\/+$/g, "");
  if (!seg) return `/site/${encSlug}`;
  if (seg === "contact") return `/site/${encSlug}/contact`;
  return `/site/${encSlug}/${encodeURIComponent(decodeSafe(seg))}`;
}

function decodeSafe(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

export function maybeRewritePrimaryLandingSite(request: NextRequest): NextResponse | null {
  const m = request.method;
  if (m !== "GET" && m !== "HEAD") return null;

  const pathname = request.nextUrl.pathname;
  const slug = resolveLandingSiteRootSlug(request);
  if (!slug || !isValidSubfolderSlug(slug)) return null;

  const encSlug = encodeURIComponent(slug);
  const basePathPrefix = `/site/${encSlug}`;

  // Canonicaliseer: directe `/site/{slug}` of `/site/{slug}/<seg>` op het primaire host → pretty URL.
  // Alleen voor publiek-ogende paden (geen token/preview-varianten).
  if (pathname === basePathPrefix || pathname.startsWith(`${basePathPrefix}/`)) {
    const canonical = canonicalizePrettyUrlFromSitePath(pathname, basePathPrefix);
    if (canonical != null && canonical !== pathname) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = canonical;
      return NextResponse.redirect(redirectUrl, 308);
    }
    // Geen canonical-redirect nodig (bv. /site/{slug}/[nested]/[deeper]) → laat lopen als gewone route.
    return null;
  }

  const target = resolvePrettyUrlInternalPath(pathname, slug);
  if (!target) return null;

  const url = request.nextUrl.clone();
  url.pathname = target;

  const forwardedHeaders = new Headers(request.headers);
  forwardedHeaders.set(PRETTY_URL_HOST_HEADER, "1");
  forwardedHeaders.set(PRETTY_URL_BASE_PATH_HEADER, basePathPrefix);

  return NextResponse.rewrite(url, { request: { headers: forwardedHeaders } });
}

/**
 * Publieke `/site/{slug}` en `/site/{slug}/<seg>` → pretty URL. Dieper of onbekend pad:
 * geef `null` terug zodat geen redirect plaatsvindt (bv. `/site/{slug}/a/b` bestaat niet).
 */
function canonicalizePrettyUrlFromSitePath(pathname: string, basePathPrefix: string): string | null {
  if (pathname === basePathPrefix) return "/";
  const tail = pathname.slice(basePathPrefix.length);
  if (!tail.startsWith("/")) return null;
  const rest = tail.replace(/^\/+|\/+$/g, "");
  if (!rest) return "/";
  const parts = rest.split("/").filter(Boolean);
  if (parts.length !== 1) return null;
  // `/site/{slug}/winkel` of `/site/{slug}/boek` bestaan niet als sub-route; laat dat aan Next zelf over.
  const seg = parts[0]!;
  const segNorm = decodeSafe(seg).toLowerCase();
  if (segNorm === "contact") return "/contact";
  return `/${seg}`;
}

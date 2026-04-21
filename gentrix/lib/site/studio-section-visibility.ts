import type { TailwindSection } from "@/lib/ai/tailwind-sections-schema";

/** Op het root-element van portaal-/dashboard-HTML (zoals door de studio-prompt gevraagd). */
const PORTAL_VISIBILITY_RE = /data-studio-visibility\s*=\s*["']portal["']/i;

/** Auto-injecteerde mobiele navbar — moet nooit als opgeslagen sectie verschijnen. */
const AUTO_MOBILE_NAV_RE = /data-gentrix-auto-mobile-nav/i;

export function isPortalSectionHtml(html: string): boolean {
  return PORTAL_VISIBILITY_RE.test(html);
}

export function isAutoMobileNavSectionHtml(html: string): boolean {
  return AUTO_MOBILE_NAV_RE.test(html);
}

/** Publieke site: geen portaalblokken en geen eerder geïnjecteerde auto-mobile-nav secties. */
export function filterSectionsForPublicSite(sections: TailwindSection[]): TailwindSection[] {
  return sections.filter((s) => !isPortalSectionHtml(s.html) && !isAutoMobileNavSectionHtml(s.html));
}

/** Alleen portaalblokken (achter login). */
export function filterSectionsForPortalOnly(sections: TailwindSection[]): TailwindSection[] {
  return sections.filter((s) => isPortalSectionHtml(s.html));
}

/**
 * Placeholder in gegenereerde HTML voor links naar het MFA-beschermde portaal.
 * Vervangen door `/portal/{slug}` bij render.
 */
export const STUDIO_PORTAL_PATH_PLACEHOLDER = "__STUDIO_PORTAL_PATH__";

/** Publieke online boek-flow: ingebouwde Vite-SPA onder `/booking-app/book/{slug}`. */
export const STUDIO_BOOKING_PATH_PLACEHOLDER = "__STUDIO_BOOKING_PATH__";

/** Canonieke URL voor live boeken (zelfde origin als `/boek/{slug}`, die redirect kan blijven doen). */
export function publicLiveBookingHref(subfolderSlug: string): string {
  return `/booking-app/book/${encodeURIComponent(subfolderSlug)}`;
}

/**
 * Minimale “popup-shell”: volledig venster met daarin de boek-SPA (`/booking-app/book/…`).
 * Geschikt voor `window.open` vanaf externe sites zonder iframe-ruimte op de eigen pagina.
 */
export function publicLiveBookingVensterHref(subfolderSlug: string): string {
  return `/boek-venster/${encodeURIComponent(subfolderSlug)}`;
}

/** Publieke webshop-landingspagina op deze app: `/winkel/{slug}`. */
export const STUDIO_SHOP_PATH_PLACEHOLDER = "__STUDIO_SHOP_PATH__";

/** Publieke contactsubpagina: `/site/{slug}/contact` (of preview-token-variant). */
export const STUDIO_CONTACT_PATH_PLACEHOLDER = "__STUDIO_CONTACT_PATH__";

/**
 * Basis voor interne marketingroutes: `href="__STUDIO_SITE_BASE__/wat-wij-doen"` → `/site/{slug}/wat-wij-doen`.
 * Geen slash aan het einde van de basis.
 */
export const STUDIO_SITE_BASE_PLACEHOLDER = "__STUDIO_SITE_BASE__";

export function applyStudioPortalPathPlaceholder(html: string, subfolderSlug: string): string {
  const path = `/portal/${encodeURIComponent(subfolderSlug)}`;
  return html.split(STUDIO_PORTAL_PATH_PLACEHOLDER).join(path);
}

export function applyStudioBookingPathPlaceholder(html: string, subfolderSlug: string): string {
  return html.split(STUDIO_BOOKING_PATH_PLACEHOLDER).join(publicLiveBookingHref(subfolderSlug));
}

export function applyStudioShopPathPlaceholder(html: string, subfolderSlug: string): string {
  const path = `/winkel/${encodeURIComponent(subfolderSlug)}`;
  return html.split(STUDIO_SHOP_PATH_PLACEHOLDER).join(path);
}

export function applyStudioContactPathPlaceholder(html: string, subfolderSlug: string): string {
  const path = `/site/${encodeURIComponent(subfolderSlug)}/contact`;
  return html.split(STUDIO_CONTACT_PATH_PLACEHOLDER).join(path);
}

export function applyStudioSiteBasePlaceholder(html: string, siteBasePath: string): string {
  const base = siteBasePath.replace(/\/$/, "");
  return html.split(STUDIO_SITE_BASE_PLACEHOLDER).join(base);
}

export type ApplyStudioPathsOptions = {
  /**
   * @deprecated Boeking- en webshop-placeholders worden **altijd** naar live paden omgezet zodra er een
   * gepubliceerde slug is (`/booking-app/book/{slug}` en `/winkel/{slug}`). CRM stuurt zichtbaarheid via compose.
   */
  includeBooking?: boolean;
  /** @deprecated Zie `includeBooking`. */
  includeShop?: boolean;
  /**
   * `false` = portaal-placeholder wordt `#` (statische export / eigen host zonder Studio-portaal-route).
   * Standaard `true`: live preview en `/site` op hetzelfde domein als de app.
   */
  resolvePortalPath?: boolean;
  /**
   * Standaard `/site/{slug}` (url-gecodeerd). Voor statische ZIP-export bv. `"."` zodat links `./pagina` worden.
   */
  publishedSiteBasePath?: string;
};

/** Portaal-, boekings- en webshop-placeholders (live preview + gepubliceerde site op hetzelfde domein). */
export function applyStudioPublishedPathPlaceholders(
  html: string,
  subfolderSlug: string,
  opts?: ApplyStudioPathsOptions,
): string {
  const siteBase =
    typeof opts?.publishedSiteBasePath === "string" && opts.publishedSiteBasePath.trim() !== ""
      ? opts.publishedSiteBasePath.trim()
      : `/site/${encodeURIComponent(subfolderSlug)}`;
  let h = applyStudioSiteBasePlaceholder(html, siteBase);
  h =
    opts?.resolvePortalPath === false
      ? h.split(STUDIO_PORTAL_PATH_PLACEHOLDER).join("#")
      : applyStudioPortalPathPlaceholder(h, subfolderSlug);
  h = applyStudioBookingPathPlaceholder(h, subfolderSlug);
  h = applyStudioShopPathPlaceholder(h, subfolderSlug);
  h = applyStudioContactPathPlaceholder(h, subfolderSlug);
  return h;
}

/**
 * Verwijdert overgebleven studio-tokens (bijv. per ongeluk in zichtbare tekst door het model).
 * Roep aan **nadat** `applyStudioPublishedPathPlaceholders` alle `href`-tokens heeft vervangen.
 */
export function stripLeakedStudioPlaceholderTokens(html: string): string {
  return html
    .split(STUDIO_PORTAL_PATH_PLACEHOLDER).join("")
    .split(STUDIO_BOOKING_PATH_PLACEHOLDER).join("")
    .split(STUDIO_SHOP_PATH_PLACEHOLDER).join("")
    .split(STUDIO_CONTACT_PATH_PLACEHOLDER).join("")
    .split(STUDIO_SITE_BASE_PLACEHOLDER).join("");
}

/**
 * Zonder gepubliceerde slug: geen ruwe `__STUDIO_*__`-strings in preview/HTML — vervang door `#` op alle plekken.
 */
export function neutralizeStudioPathPlaceholdersWithoutSlug(html: string): string {
  return html
    .split(STUDIO_PORTAL_PATH_PLACEHOLDER).join("#")
    .split(STUDIO_BOOKING_PATH_PLACEHOLDER).join("#")
    .split(STUDIO_SHOP_PATH_PLACEHOLDER).join("#")
    .split(STUDIO_CONTACT_PATH_PLACEHOLDER).join("#")
    .split(STUDIO_SITE_BASE_PLACEHOLDER).join("#");
}

/** Enkele `href` (React-secties) — zelfde placeholder als in HTML-secties. */
export function resolveStudioPortalHref(href: string, publishedSlug?: string | null): string {
  const slug = publishedSlug?.trim();
  if (!slug) return href;
  return applyStudioPortalPathPlaceholder(href, slug);
}

export function resolveStudioBookingHref(href: string, publishedSlug?: string | null): string {
  const slug = publishedSlug?.trim();
  if (!slug) return href;
  return applyStudioBookingPathPlaceholder(href, slug);
}

export function resolveStudioShopHref(href: string, publishedSlug?: string | null): string {
  const slug = publishedSlug?.trim();
  if (!slug) return href;
  return applyStudioShopPathPlaceholder(href, slug);
}

/**
 * Enkele `href` voor gepubliceerde site of preview — dezelfde regels als `ReactPublishedSiteView.resolveHref`.
 */
export function resolvePublishedStudioHref(href: string, publishedSlug?: string | null): string {
  const slug = publishedSlug?.trim();
  if (!slug) return neutralizeStudioPathPlaceholdersWithoutSlug(href);
  return stripLeakedStudioPlaceholderTokens(applyStudioPublishedPathPlaceholders(href, slug));
}

/**
 * Omgekeerde van `applyStudioPublishedPathPlaceholders`: vervangt al-opgeloste paden (bv. uit
 * een iframe-snapshot) terug naar studio-placeholders zodat opgeslagen HTML porteerbaar blijft.
 *
 * Gebruikt door de portal-editor save-flow om te voorkomen dat de slug hardcoded opgeslagen wordt.
 */
export function restoreStudioPathPlaceholders(html: string, subfolderSlug: string): string {
  const enc = encodeURIComponent(subfolderSlug);
  const siteBase = `/site/${enc}`;
  const bookingPath = `/booking-app/book/${enc}`;
  const vensterPath = `/boek-venster/${enc}`;
  const portalPath = `/portal/${enc}`;
  const shopPath = `/winkel/${enc}`;

  let h = html;
  // Langste paden eerst om partiële vervangingen te voorkomen
  h = h.split(`${siteBase}/contact`).join(STUDIO_CONTACT_PATH_PLACEHOLDER);
  h = h.split(bookingPath).join(STUDIO_BOOKING_PATH_PLACEHOLDER);
  h = h.split(vensterPath).join(STUDIO_BOOKING_PATH_PLACEHOLDER);
  h = h.split(shopPath).join(STUDIO_SHOP_PATH_PLACEHOLDER);
  h = h.split(portalPath).join(STUDIO_PORTAL_PATH_PLACEHOLDER);
  // Basis site-URL als laatste (kortste patroon)
  h = h.split(siteBase).join(STUDIO_SITE_BASE_PLACEHOLDER);
  return h;
}

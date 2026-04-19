import type { TailwindSection } from "@/lib/ai/tailwind-sections-schema";

/** Op het root-element van portaal-/dashboard-HTML (zoals door de studio-prompt gevraagd). */
const PORTAL_VISIBILITY_RE = /data-studio-visibility\s*=\s*["']portal["']/i;

export function isPortalSectionHtml(html: string): boolean {
  return PORTAL_VISIBILITY_RE.test(html);
}

/** Publieke site: geen portaalblokken. */
export function filterSectionsForPublicSite(sections: TailwindSection[]): TailwindSection[] {
  return sections.filter((s) => !isPortalSectionHtml(s.html));
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

/** Publieke online boekingspagina op deze app: `/boek/{slug}`. */
export const STUDIO_BOOKING_PATH_PLACEHOLDER = "__STUDIO_BOOKING_PATH__";

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
  const path = `/boek/${encodeURIComponent(subfolderSlug)}`;
  return html.split(STUDIO_BOOKING_PATH_PLACEHOLDER).join(path);
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
   * @deprecated Boeking- en webshop-placeholders worden **altijd** naar `/boek/{slug}` en `/winkel/{slug}`
   * omgezet zodra er een gepubliceerde slug is. CRM stuurt zichtbaarheid/activatie via compose en inactive-routes,
   * niet via `href="#"`.
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

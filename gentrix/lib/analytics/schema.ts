/**
 * Gentrix product analytics: eventnamen en context-velden.
 * PostHog ontvangt dezelfde string-keys; wijzigen = voorwaarts-compatibel denken
 * of nieuwe events i.p.v. renames in het veld.
 */

export type GentrixSessionType =
  | "public_site"
  | "public_preview"
  | "client_dashboard"
  | "client_portal_iframe"
  | "admin"
  | "other";

export type GentrixActor = "visitor" | "known_customer" | "staff" | "unknown";

/** Verplicht meesturen op (bijna) elke custom capture — via register + spread in capture. */
export type GentrixAnalyticsContext = {
  session_type: GentrixSessionType;
  /** Publiek: `subfolder_slug` (clients.subfolder_slug). */
  site_slug: string | null;
  /**
   * Logische subpagina: `home` | `contact` | `marketing:…` of route-gestuurd.
   * Gebruik in funnels, niet vrije paden in eventnamen.
   */
  page_key: string | null;
  /** Module-vlaggen op moment van het event. */
  booking_module_enabled: boolean;
  webshop_module_enabled: boolean;
  is_preview: boolean;
  app_environment: "development" | "production";
  /**
   * `true` wanneer een ingelogd teamlid duidelijk als test markeert (o.a. admin, later feature flag).
   * Default false; geen gaten in schema.
   */
  is_internal_actor: boolean;
  actor: GentrixActor;
  /**
   * Waar HTML draaide: `public_inline` = /site in Next DOM; `portal_iframe` = portaal site-preview-iframe; `other`.
   */
  render_surface: GentrixRenderSurface;
};

export type GentrixRenderSurface = "public_inline" | "portal_iframe" | "react_page" | "other";

/** v1 catalogus — breid met nieuwe regels, verander bestaande namen liever niet. */
export const GENTRIX_EVENT_NAMES = [
  "site_session_started",
  "site_page_viewed",
  "site_scroll_depth",
  "site_cta_click",
  "client_dashboard_viewed",
  "client_portal_preview_ready",
] as const;

export type GentrixEventName = (typeof GENTRIX_EVENT_NAMES)[number] | (string & {});

export type GentrixScrollDepth = 25 | 50 | 75 | 100;

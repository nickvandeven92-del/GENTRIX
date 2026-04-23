"use client";

import { useEffect, useRef } from "react";
import {
  initGentrixAnalytics,
  isGentrixAnalyticsEnabled,
  setGentrixPageContext,
  trackGentrixEvent,
} from "@/lib/analytics/gentrix-analytics";

type Props = { siteSlug: string; bookingModuleEnabled?: boolean; webshopModuleEnabled?: boolean };

/**
 * Stelt PostHog-context in op klant-portaalroutes (`/portal/...`); draait in de portaal-pagina.
 */
export function GentrixPortalAnalyticsBoot({
  siteSlug,
  bookingModuleEnabled = false,
  webshopModuleEnabled = false,
}: Props) {
  const once = useRef(false);
  useEffect(() => {
    if (!isGentrixAnalyticsEnabled()) return;
    initGentrixAnalytics();
    setGentrixPageContext({
      session_type: "client_dashboard",
      site_slug: siteSlug,
      page_key: "dashboard",
      is_preview: false,
      actor: "known_customer",
      is_internal_actor: false,
      render_surface: "other",
      booking_module_enabled: bookingModuleEnabled,
      webshop_module_enabled: webshopModuleEnabled,
    });
    if (once.current) return;
    once.current = true;
    trackGentrixEvent("client_dashboard_viewed", { site_slug: siteSlug });
  }, [siteSlug, bookingModuleEnabled, webshopModuleEnabled]);

  return null;
}

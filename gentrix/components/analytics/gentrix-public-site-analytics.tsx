"use client";

import { useEffect, useRef } from "react";
import {
  attachGentrixMainWindowScrollDepth,
  isGentrixAnalyticsEnabled,
  setGentrixPageContext,
  initGentrixAnalytics,
  trackGentrixEvent,
} from "@/lib/analytics/gentrix-analytics";
import type { GentrixRenderSurface, GentrixSessionType } from "@/lib/analytics/schema";

type Props = {
  siteSlug: string;
  pageKey: string;
  isPreview: boolean;
  bookingModuleEnabled: boolean;
  webshopModuleEnabled: boolean;
  sessionType: GentrixSessionType;
  renderSurface: Extract<GentrixRenderSurface, "public_inline" | "public_iframe" | "react_page">;
};

/**
 * Publiek: Tailwind inline op `/site`, React-legacy, of studio-generator-preview in iframe. Zet super-context;
 * scrolldiepte volgt het **admin**-`window` (niet de iframe-doc).
 */
export function GentrixPublicSiteAnalytics({
  siteSlug,
  pageKey,
  isPreview,
  bookingModuleEnabled,
  webshopModuleEnabled,
  sessionType,
  renderSurface,
}: Props) {
  const lastPageViewKey = useRef("");

  useEffect(() => {
    if (!isGentrixAnalyticsEnabled()) return;
    initGentrixAnalytics();
    setGentrixPageContext({
      site_slug: siteSlug,
      page_key: pageKey,
      is_preview: isPreview,
      session_type: sessionType,
      booking_module_enabled: bookingModuleEnabled,
      webshop_module_enabled: webshopModuleEnabled,
      render_surface: renderSurface,
      actor: "visitor",
      is_internal_actor: false,
    });
    const sessK = `gentrix_site_session_${encodeURIComponent(siteSlug)}`;
    if (typeof sessionStorage !== "undefined" && !sessionStorage.getItem(sessK)) {
      trackGentrixEvent("site_session_started", {
        site_slug: siteSlug,
        page_key: pageKey,
      });
      try {
        sessionStorage.setItem(sessK, "1");
      } catch {
        /* ignore */
      }
    }
    const path = typeof window !== "undefined" ? window.location.pathname + window.location.search : "";
    const pv = `${path}::${pageKey}`;
    if (lastPageViewKey.current !== pv) {
      lastPageViewKey.current = pv;
      trackGentrixEvent("site_page_viewed", {
        page_key: pageKey,
        path: path || null,
      });
    }
  }, [
    siteSlug,
    pageKey,
    isPreview,
    bookingModuleEnabled,
    webshopModuleEnabled,
    sessionType,
    renderSurface,
  ]);

  useEffect(() => {
    if (!isGentrixAnalyticsEnabled()) return;
    return attachGentrixMainWindowScrollDepth((depth) => {
      trackGentrixEvent("site_scroll_depth", {
        depth_pct: depth,
        page_key: pageKey,
        path: typeof window !== "undefined" ? window.location.pathname + window.location.search : null,
      });
    });
  }, [pageKey]);

  return null;
}

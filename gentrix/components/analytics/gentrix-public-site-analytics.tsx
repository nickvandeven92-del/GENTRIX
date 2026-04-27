"use client";

import { useEffect } from "react";
import {
  bootFirstPartyPublicSiteAnalytics,
  installFirstPartyGlobal,
} from "@/lib/analytics/first-party-public-site";

type Props = {
  siteSlug: string;
  pageKey: string;
  isPreview: boolean;
  bookingModuleEnabled: boolean;
  webshopModuleEnabled: boolean;
  sessionType: "public_site" | "public_preview" | "client_portal_iframe" | "other";
  renderSurface: "public_inline" | "public_iframe" | "react_page" | "other";
};

/**
 * Geen render-blocking: `boot` ketent na `load` + idle (zie first-party module).
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
  useEffect(() => {
    installFirstPartyGlobal();
    bootFirstPartyPublicSiteAnalytics({
      siteSlug,
      pageKey,
      isPreview,
      sessionType,
      bookingModuleEnabled,
      webshopModuleEnabled,
      renderSurface,
    });
  }, [
    siteSlug,
    pageKey,
    isPreview,
    bookingModuleEnabled,
    webshopModuleEnabled,
    sessionType,
    renderSurface,
  ]);

  return null;
}

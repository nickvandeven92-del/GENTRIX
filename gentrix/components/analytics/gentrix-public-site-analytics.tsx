"use client";

import { useEffect } from "react";
import {
  bootFirstPartyPublicSiteAnalytics,
  installFirstPartyGlobal,
} from "@/lib/analytics/first-party-public-site";
import type { PublicSiteGeneratorMeta } from "@/lib/analytics/public-site-generator-meta";

type Props = {
  siteSlug: string;
  pageKey: string;
  isPreview: boolean;
  bookingModuleEnabled: boolean;
  webshopModuleEnabled: boolean;
  sessionType: "public_site" | "public_preview" | "client_portal_iframe" | "other";
  renderSurface: "public_inline" | "public_iframe" | "react_page" | "other";
  /** Optioneel: generator-snapshot (page_view). */
  generatorMeta?: PublicSiteGeneratorMeta;
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
  generatorMeta,
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
      generatorMeta,
    });
  }, [
    siteSlug,
    pageKey,
    isPreview,
    bookingModuleEnabled,
    webshopModuleEnabled,
    sessionType,
    renderSurface,
    generatorMeta,
  ]);

  return null;
}

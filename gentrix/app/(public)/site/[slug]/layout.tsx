
import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import {
  publishedSiteViewTransitionMetadata,
  publishedSiteViewTransitionScopedCss,
} from "@/lib/site/published-view-transition-shell";
import {
  STUDIO_NAV_CHROME_MENU_BTN_VISIBILITY_CSS,
  STUDIO_NAV_CHROME_HERO_OVERLAY_SHELL_CSS,
  GENTRIX_MENU_ICON_TOGGLE_CSS,
  STUDIO_DESKTOP_NAV_HIDDEN_UTIL_FIX_CSS,
} from "@/lib/site/tailwind-page-html";

export const metadata: Metadata = publishedSiteViewTransitionMetadata;

/**
 * Publieke klant-sites zijn altijd wit — dark mode van het apparaat mag de body-achtergrond niet beïnvloeden.
 * `colorScheme: "only light"` zet een <meta name="color-scheme" content="only light"> in de <head>,
 * zodat de browser geen dark-mode CSS-variabelen toepast op deze route.
 * De inline <style> is een extra vangnet voor browsers die de meta tag nog niet respecteren.
 */
export const viewport: Viewport = {
  colorScheme: "only light",
  width: "device-width",
  initialScale: 1,
};

export default function SiteSlugLayout({ children }: { children: ReactNode }) {
  return (
        <>
      {/* Inline override: voorkomt donkere body-achtergrond op apparaten met dark mode */}
      <style>{`
        html{background:#fff!important}
        body{background:#fff!important;color:#171717!important}
        a,button,[role="button"],summary{
          -webkit-tap-highlight-color:transparent;
          tap-highlight-color:transparent;
        }
        ${publishedSiteViewTransitionScopedCss}
        ${STUDIO_NAV_CHROME_MENU_BTN_VISIBILITY_CSS}
        ${STUDIO_NAV_CHROME_HERO_OVERLAY_SHELL_CSS}
        ${GENTRIX_MENU_ICON_TOGGLE_CSS}
        ${STUDIO_DESKTOP_NAV_HIDDEN_UTIL_FIX_CSS}
      `}</style>
      {children}
    </>
  );
}

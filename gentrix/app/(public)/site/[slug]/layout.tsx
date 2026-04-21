import type { ReactNode } from "react";
import type { Viewport } from "next";

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
        body{background:#fff!important;color:#171717!important}

        /* View Transitions API — naadloze fade bij paginawissels (Chrome/Edge/Safari 18+) */
        @supports (view-transition-name: none) {
          ::view-transition-old(root) {
            animation: __site-fade-out 0.10s ease forwards;
          }
          ::view-transition-new(root) {
            animation: __site-fade-in 0.18s ease forwards;
          }
          @keyframes __site-fade-out {
            from { opacity: 1; }
            to   { opacity: 0; }
          }
          @keyframes __site-fade-in {
            from { opacity: 0; }
            to   { opacity: 1; }
          }
        }
      `}</style>
      {children}
    </>
  );
}

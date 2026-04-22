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
        :root{
          --public-site-shell-bg:#08081a; /* donkere shell = geen witte flits tijdens view-transitie */
          --public-site-shell-fg:#ededed;
        }
        html,body{
          background:var(--public-site-shell-bg)!important;
          color:var(--public-site-shell-fg)!important;
        }
        a,button,[role="button"],summary{
          -webkit-tap-highlight-color:transparent;
          tap-highlight-color:transparent;
        }

        @view-transition {
          navigation: auto;
        }

        @supports (view-transition-name: none) {
          ::view-transition-old(root) { animation: none; }
          ::view-transition-new(root) { animation: none; }
        }
      `}</style>
      {children}
    </>
  );
}

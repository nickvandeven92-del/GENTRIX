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
          --public-site-shell-bg:#fff;
          --public-site-shell-fg:#171717;
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

        /*
         * View Transitions API — naadloze swap bij paginawissels (Chrome/Edge/Safari 18+).
         * Principe: browser houdt screenshot van de oude pagina vast (geen flikkering) terwijl
         * de nieuwe pagina rendert; pas daarna crossfade. Gecombineerd met verwijderd loading.tsx
         * en experimental.viewTransition in next.config.ts geeft dit instant-aanvoelende navigatie.
         *
         * Timing: fade-out snel (oude content wegglippen), fade-in iets langer (nieuwe content opkomen).
         */
        @supports (view-transition-name: none) {
          ::view-transition-old(root) {
            animation: none; /* blijft op opacity 1 — nieuwe pagina fadt er bovenop, geen gap */
          }
          ::view-transition-new(root) {
            animation: __site-fade-in 0.18s ease-out forwards;
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

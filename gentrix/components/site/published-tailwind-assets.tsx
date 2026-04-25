"use client";

type PublishedTailwindAssetsProps = {
  /** `false` wanneer de iframe al gecompileerde Tailwind-CSS gebruikt (geen Play CDN). */
  preconnectTailwindPlayCdn?: boolean;
};

/**
 * Resource hints voor de iframe: max. één `preconnect` (Lighthouse: >4 preconnects schaadt).
 * Zet `preconnectTailwindPlayCdn` alleen aan als Tailwind Play echt van `cdn.tailwindcss.com` laadt;
 * bij proxy via `/api/public/studio-preview-lib` is die hint ongebruikt en waarschuwt Lighthouse.
 * Font-hints staan al in de iframe-/export-`<head>`; hier geen dubbele fonts.
 * jsDelivr (Alpine/Lucide): alleen `dns-prefetch` — lichter dan preconnect.
 */
export function PublishedTailwindAssets({ preconnectTailwindPlayCdn = true }: PublishedTailwindAssetsProps) {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        width: 1,
        height: 1,
        margin: -1,
        overflow: "hidden",
        clipPath: "inset(50%)",
        border: 0,
        padding: 0,
      }}
    >
      {preconnectTailwindPlayCdn ? <link rel="preconnect" href="https://cdn.tailwindcss.com" /> : null}
      <link rel="dns-prefetch" href="https://cdn.jsdelivr.net" />
    </div>
  );
}

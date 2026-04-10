"use client";

type PublishedTailwindAssetsProps = {
  /** `false` wanneer de iframe al gecompileerde Tailwind-CSS gebruikt (geen Play CDN). */
  preconnectTailwindPlayCdn?: boolean;
};

/**
 * Preconnects voor gepubliceerde Tailwind-sites (Alpine/Lucide/fonts).
 * Tailwind Play CDN-preconnect alleen als de iframe nog JIT via cdn.tailwindcss.com laadt.
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
      <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="" />
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
    </div>
  );
}

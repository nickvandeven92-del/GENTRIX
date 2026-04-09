/**
 * Preconnects voor gepubliceerde Tailwind-sites.
 * Tailwind Play CDN: synchroon direct ná sectie-HTML (zelfde als iframe-preview). Alpine blijft `defer`.
 * Hier alleen vroege DNS/TCP-hints.
 */
export function PublishedTailwindAssets() {
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
      <link rel="preconnect" href="https://cdn.tailwindcss.com" />
      <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="" />
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
    </div>
  );
}

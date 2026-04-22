import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    /**
     * Wraps elke client-navigatie automatisch in `document.startViewTransition()`.
     * Gecombineerd met de `::view-transition-*` CSS in `site/[slug]/layout.tsx` en het
     * verwijderen van `loading.tsx` geeft dit naadloze page-swaps: oude pagina blijft
     * zichtbaar (browser houdt screenshot vast) tot RSC klaar is, dan fade-over.
     */
    viewTransition: true,
  },
  async rewrites() {
    return {
      /** Vite SPA onder `public/booking-app` — client-routes (`/booking-app/book/…`) naar index.html. */
      afterFiles: [
        { source: "/booking-app", destination: "/booking-app/index.html" },
        { source: "/booking-app/", destination: "/booking-app/index.html" },
        { source: "/booking-app/:path*", destination: "/booking-app/index.html" },
      ],
    };
  },
  /**
   * Next 16 dev blokkeert /_next/* bij Sec-Fetch-Site: cross-site + no-cors zonder Referer (“unknown source”).
   * Zie `npm run dev`: gebruik `--hostname localhost` zodat pagina en /_next hetzelfde host hebben.
   * Test je via de “Network”-URL? Zet hier je LAN-hostname/IP (zoals in de dev-server output).
   */
  allowedDevOrigins: ["127.0.0.1"],
  /**
   * `@tailwindcss/cli` wordt via `execFile` aangeroepen — standaard file-tracing pakt die paden soms niet mee
   * op Vercel → `ENOENT` in `attachCompiledTailwindCssToPayload`. Picomatch-keys matchen op genormaliseerde routes.
   */
  outputFileTracingIncludes: {
    "*api*": ["./node_modules/@tailwindcss/**/*", "./node_modules/tailwindcss/**/*"],
    "*site*": ["./node_modules/@tailwindcss/**/*", "./node_modules/tailwindcss/**/*"],
  },
  /** Playwright blijft extern (zwaar). jsdom 29+ → html-encoding-sniffer 6 → ERR_REQUIRE_ESM op @exodus/bytes; zie `package.json` overrides (jsdom 25). */
  serverExternalPackages: ["playwright"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**" },
    ],
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Next 16 dev blokkeert /_next/* bij Sec-Fetch-Site: cross-site + no-cors zonder Referer (“unknown source”).
   * Zie `npm run dev`: gebruik `--hostname localhost` zodat pagina en /_next hetzelfde host hebben.
   * Test je via de “Network”-URL? Zet hier je LAN-hostname/IP (zoals in de dev-server output).
   */
  allowedDevOrigins: ["127.0.0.1"],
  /** Playwright blijft extern (zwaar). isomorphic-dompurify/jsdom niet extern: Node `require()` breekt op ESM-deps (@exodus/bytes) op Vercel. */
  serverExternalPackages: ["playwright"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com", pathname: "/**" },
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**" },
    ],
  },
};

export default nextConfig;

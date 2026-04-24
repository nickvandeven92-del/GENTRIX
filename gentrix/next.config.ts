import type { NextConfig } from "next";

/**
 * Basis-security headers voor álle routes. CSP wordt bewust niet als Report-Only opgezet;
 * de gepubliceerde klantsites bevatten door-ontwerp inline Alpine/Tailwind-scripts die zonder
 * uitgebreide allow-list breken. Als je toe bent aan CSP: begin met `Content-Security-Policy-Report-Only`
 * en rapporteer naar een endpoint, anders gaan klant-sites stuk.
 */
const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

function parseAllowedDevOrigins(): string[] {
  const base = ["127.0.0.1", "localhost"];
  const extra = process.env.NEXT_DEV_ALLOWED_ORIGINS?.trim();
  if (!extra) return base;
  return [
    ...base,
    ...extra
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  ];
}

const LONG_CACHE_IMMUTABLE = "public, max-age=31536000, immutable";
const LONG_CACHE_FINGERPRINTED = "public, max-age=31536000, stale-while-revalidate=86400";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/_next/static/:path*",
        headers: [{ key: "Cache-Control", value: LONG_CACHE_IMMUTABLE }],
      },
      {
        source: "/booking-app/assets/:path*",
        headers: [{ key: "Cache-Control", value: LONG_CACHE_IMMUTABLE }],
      },
      {
        source: "/icons/:path*",
        headers: [{ key: "Cache-Control", value: LONG_CACHE_FINGERPRINTED }],
      },
      {
        source: "/:path*",
        headers: SECURITY_HEADERS,
      },
    ];
  },
  async rewrites() {
    return {
      /** Vite SPA onder `public/booking-app` — alle client-routes (`/booking-app/...`) naar index.html. */
      afterFiles: [
        { source: "/booking-app/:path*", destination: "/booking-app/index.html" },
      ],
    };
  },
  /**
   * Next 16 dev blokkeert /_next/* bij Sec-Fetch-Site: cross-site + no-cors zonder Referer.
   * Zie `npm run dev`: gebruik `--hostname localhost`. Extra LAN-hosts via `NEXT_DEV_ALLOWED_ORIGINS`.
   */
  allowedDevOrigins: parseAllowedDevOrigins(),
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
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/render/image/public/**" },
    ],
  },
};

export default nextConfig;

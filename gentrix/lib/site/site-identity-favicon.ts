import type { Metadata } from "next";
import { isLegacyTailwindPageConfig, type TailwindPageConfig } from "@/lib/ai/tailwind-sections-schema";

/** Zelfde limiet als `generateMetadata` / export-HTML (te grote data-URL’s breken SSR). */
export const MAX_FAVICON_DATA_URL_CHARS = 12_000;

const SVG_OPEN = '<svg xmlns="http://www.w3.org/2000/svg"';

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function normalizeHex6(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const t = raw.trim();
  let m = /^#([0-9a-f]{6})$/i.exec(t);
  if (m) return `#${m[1]!.toLowerCase()}`;
  m = /^#([0-9a-f]{3})$/i.exec(t);
  if (m) {
    const g = m[1]!;
    return `#${g[0]}${g[0]}${g[1]}${g[1]}${g[2]}${g[2]}`.toLowerCase();
  }
  return null;
}

function hexToRgb(hex6: string): { r: number; g: number; b: number } {
  const h = hex6.slice(1);
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function relativeLuminance(hex6: string): number {
  const { r, g, b } = hexToRgb(hex6);
  const lin = (x: number) => {
    const c = x / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const R = lin(r);
  const G = lin(g);
  const B = lin(b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

function hashStringToHue(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h % 360;
}

/** HSL (0–360, 0–1, 0–1) → `#rrggbb`. */
function hslToHex(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let rp = 0;
  let gp = 0;
  let bp = 0;
  if (h < 60) [rp, gp, bp] = [c, x, 0];
  else if (h < 120) [rp, gp, bp] = [x, c, 0];
  else if (h < 180) [rp, gp, bp] = [0, c, x];
  else if (h < 240) [rp, gp, bp] = [0, x, c];
  else if (h < 300) [rp, gp, bp] = [x, 0, c];
  else [rp, gp, bp] = [c, 0, x];
  const r = Math.round((rp + m) * 255);
  const g = Math.round((gp + m) * 255);
  const b = Math.round((bp + m) * 255);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

export function pickPrimaryHexForSiteIdentity(
  slug: string,
  pageConfig?: TailwindPageConfig | null,
  themePrimaryOverride?: string | null,
): string {
  const o = normalizeHex6(themePrimaryOverride ?? undefined);
  if (o) return o;
  if (pageConfig && !isLegacyTailwindPageConfig(pageConfig)) {
    const t = pageConfig.theme;
    for (const key of ["primary", "primaryMain", "primaryDark", "accent"] as const) {
      const v = t[key];
      if (typeof v === "string") {
        const n = normalizeHex6(v);
        if (n) return n;
      }
    }
  }
  if (pageConfig && isLegacyTailwindPageConfig(pageConfig)) {
    const n = normalizeHex6(pageConfig.primaryColor);
    if (n) return n;
  }
  const hue = hashStringToHue(slug || "x");
  return hslToHex(hue, 0.62, 0.46);
}

export function pickMarkCharForSiteIdentity(displayName: string, slug: string): string {
  const name = displayName.trim();
  const slugAlt = slug.replace(/[^a-zA-Z0-9]+/g, " ").trim();
  const source = name || slugAlt || "G";
  for (const ch of source) {
    if (/[\p{L}\p{N}]/u.test(ch)) {
      return ch.toUpperCase();
    }
  }
  return "G";
}

export function renderSiteIdentityFaviconSvg(input: {
  displayName: string;
  slug: string;
  pageConfig?: TailwindPageConfig | null;
  themePrimaryHex?: string | null;
}): string {
  const fill = pickPrimaryHexForSiteIdentity(input.slug, input.pageConfig ?? null, input.themePrimaryHex ?? null);
  const letter = pickMarkCharForSiteIdentity(input.displayName, input.slug);
  const ink = relativeLuminance(fill) > 0.52 ? "#0f172a" : "#ffffff";
  const font = "ui-sans-serif,system-ui,sans-serif";
  return `${SVG_OPEN} viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="${escapeXml(fill)}"/><text x="16" y="21" text-anchor="middle" font-family="${escapeXml(
    font,
  )}" font-weight="700" font-size="15" fill="${escapeXml(ink)}">${escapeXml(letter)}</text></svg>`;
}

export type ResolvePublicSiteFaviconInput = {
  logoFavicon?: string | null | undefined;
  /** Gemini/OpenAI PNG-favicon (site-assets); wint op SVG-tabblad. */
  rasterFavicon32Url?: string | null | undefined;
  rasterFavicon192Url?: string | null | undefined;
  displayName: string;
  slug: string;
  pageConfig?: TailwindPageConfig | null;
  themePrimaryHex?: string | null;
};

export function resolvePublicSiteFaviconSvg(input: ResolvePublicSiteFaviconInput): string {
  const fav = input.logoFavicon?.trim() ?? "";
  if (fav.length > 0 && fav.length <= MAX_FAVICON_DATA_URL_CHARS) return fav;
  return renderSiteIdentityFaviconSvg({
    displayName: input.displayName,
    slug: input.slug,
    pageConfig: input.pageConfig ?? null,
    themePrimaryHex: input.themePrimaryHex ?? null,
  });
}

function isHttpsRasterUrl(s: string | null | undefined): s is string {
  const t = s?.trim() ?? "";
  return t.startsWith("https://") && t.length < 2048;
}

export function buildNextPublishedSiteIcons(input: ResolvePublicSiteFaviconInput): NonNullable<Metadata["icons"]> {
  const r32 = input.rasterFavicon32Url?.trim();
  if (isHttpsRasterUrl(r32)) {
    const r192 = input.rasterFavicon192Url?.trim();
    const icon: Array<{ url: string; type?: string; sizes?: string }> = [];
    if (isHttpsRasterUrl(r192)) {
      icon.push({ url: r192, type: "image/png", sizes: "192x192" });
    }
    icon.push({ url: r32, type: "image/png", sizes: "32x32" });
    /**
     * Verplicht `apple` meegeven: anders blijft `app/layout.tsx` (Portaal) `apple-touch-icon` in de merge
     * hangen — tabblad / iOS-toast toont dan overal het studio-icoon i.p.v. de klantfavicon.
     * Zonder 192px-asset: 32px- PNG (klein maar uniek per site).
     */
    const appleUrl = isHttpsRasterUrl(r192) ? r192! : r32;
    const appleSizes = isHttpsRasterUrl(r192) ? "192x192" : "32x32";
    return {
      icon,
      apple: [{ url: appleUrl, sizes: appleSizes, type: "image/png" }],
    } as NonNullable<Metadata["icons"]>;
  }

  const svg = resolvePublicSiteFaviconSvg(input);
  const safe =
    svg.length <= MAX_FAVICON_DATA_URL_CHARS
      ? svg
      : renderSiteIdentityFaviconSvg({ displayName: "G", slug: "g", pageConfig: null, themePrimaryHex: "#4f46e5" });
  const svgDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(safe)}`;
  return {
    icon: [{ url: svgDataUrl, type: "image/svg+xml" }],
    apple: [{ url: svgDataUrl, type: "image/svg+xml" }],
  };
}

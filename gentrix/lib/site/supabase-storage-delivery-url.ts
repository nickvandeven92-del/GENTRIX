/**
 * Supabase Storage **object/public** → **render/image** (resize + compressie).
 * Zie https://supabase.com/docs/guides/storage/serving/image-transformations
 *
 * Alleen `.jpg`/`.jpeg`/`.png`/`.webp`/`.avif` — geen `.gif` (animatie) of `.svg`.
 *
 * Image transformations moeten in het Supabase-project aan staan (Pro).
 */

import { findHtmlOpenTagEnd } from "@/lib/site/html-open-tag";

const SUPABASE_OBJECT_PUBLIC_IMAGE_RE =
  /https:\/\/[a-z0-9][a-z0-9-]{0,61}\.supabase\.co\/storage\/v1\/object\/public\/[^\s"'<>)]+\.(?:jpe?g|png|webp|avif)/gi;

/** Viewport-breedtes voor `srcset` (max. 2500 px volgens Supabase-limiet; geen 2400 — te zwaar als default-`src`). */
export const SUPABASE_HERO_SRCSET_WIDTHS = [640, 828, 960, 1280, 1600, 1920] as const;

/**
 * Default `src` na `srcset`-injectie: mobile-first LCP (niet de grootste variant — sommige clients
 * hangen kort aan `src`; 2400px was te zwaar in Lighthouse).
 */
export const SUPABASE_HERO_LCP_SRC_WIDTH = 1280;

/** Tailwind default `max-w-*` → px (16px rem) voor `sizes`. */
const MAX_W_TOKEN_TO_PX: Record<string, number> = {
  sm: 384,
  md: 448,
  lg: 512,
  xl: 576,
  "2xl": 672,
  "3xl": 768,
  "4xl": 896,
  "5xl": 1024,
  "6xl": 1152,
  "7xl": 1280,
};

export type SupabaseImageDeliveryOptions = {
  /** Max. lange zijde voor enkelvoudige `src` (default 1920). */
  width?: number;
  quality?: number;
  resize?: "cover" | "contain" | "fill";
};

function extractClassAttr(attrs: string): string {
  const d = attrs.match(/\bclass\s*=\s*"([^"]*)"/i);
  if (d) return d[1].replace(/\s+/g, " ").trim();
  const s = attrs.match(/\bclass\s*=\s*'([^']*)'/i);
  if (s) return s[1].replace(/\s+/g, " ").trim();
  return "";
}

/**
 * Ruwe `sizes`-hint op basis van Tailwind-classes op de `<img>` (geen parent-DOM).
 * — `max-w-*`: vaste px na breakpoint (editorial / ingekaderde hero).
 * — `md|lg|xl:w-*` breuken: fractie van viewport op groot scherm.
 * — default: `100vw` (full-bleed).
 */
export function inferHeroImgSizesFromAttrs(imgAttrs: string): string {
  const cs = extractClassAttr(imgAttrs);
  if (!cs) return "100vw";

  const maxW = cs.match(/\bmax-w-(7xl|6xl|5xl|4xl|3xl|2xl|xl|lg|md|sm)\b/);
  if (maxW) {
    const px = MAX_W_TOKEN_TO_PX[maxW[1]!];
    if (px) return `(max-width: 768px) 100vw, ${px}px`;
  }

  if (/\b(?:md|lg|xl):w-1\/2\b/.test(cs)) return "(max-width: 768px) 100vw, 50vw";
  if (/\b(?:md|lg|xl):w-1\/3\b/.test(cs)) return "(max-width: 768px) 100vw, 34vw";
  if (/\b(?:md|lg|xl):w-2\/3\b/.test(cs)) return "(max-width: 768px) 100vw, 67vw";
  if (/\b(?:md|lg|xl):w-3\/5\b/.test(cs)) return "(max-width: 768px) 100vw, 60vw";
  if (/\b(?:md|lg|xl):w-2\/5\b/.test(cs)) return "(max-width: 768px) 100vw, 40vw";
  if (/\b(?:md|lg|xl):w-5\/12\b/.test(cs)) return "(max-width: 768px) 100vw, 42vw";
  if (/\b(?:md|lg|xl):w-7\/12\b/.test(cs)) return "(max-width: 768px) 100vw, 58vw";

  return "100vw";
}

/** Iets lagere quality op kleine `srcset`-breedtes, iets hoger op grote (hero-scherpte). */
export function qualityForSrcsetWidth(width: number, baseQuality: number): number {
  const b = Math.min(100, Math.max(20, Math.round(baseQuality)));
  if (width <= 640) return Math.min(100, b - 4);
  if (width <= 960) return Math.min(100, b - 3);
  if (width <= 1280) return Math.min(100, b - 2);
  if (width <= 1920) return Math.min(100, b + 1);
  return Math.min(100, b + 2);
}

/**
 * Enkele publieke object-URL → render-URL. Geen-op als al transform of geen match.
 */
export function supabaseStorageObjectUrlToRenderUrl(
  raw: string,
  opts?: SupabaseImageDeliveryOptions,
): string {
  const width = opts?.width ?? 1920;
  const quality = opts?.quality ?? 82;
  const resize = opts?.resize ?? "cover";
  if (!raw.includes(".supabase.co/storage/v1/object/public/")) return raw;
  if (raw.includes("/storage/v1/render/image/public/")) return raw;
  const base = raw.split(/[?#]/)[0] ?? raw;
  if (base.toLowerCase().includes("favicon")) return raw;
  try {
    const u = new URL(raw);
    const prefix = "/storage/v1/object/public/";
    if (!u.pathname.startsWith(prefix)) return raw;
    const rest = u.pathname.slice(prefix.length);
    if (!rest) return raw;
    u.pathname = `/storage/v1/render/image/public/${rest}`;
    u.search = "";
    u.hash = "";
    u.searchParams.set("width", String(width));
    u.searchParams.set("quality", String(quality));
    u.searchParams.set("resize", resize);
    return u.toString();
  } catch {
    return raw;
  }
}

/**
 * Vervangt alle Supabase object/public-afbeeldings-URL's in een HTML-string (hero, `url()`, src).
 */
/**
 * Publish-time AI-hero-set: `…/ai-hero/<stem>/<intrinsicW>.webp` — geen `render/image`-rewrite;
 * browser kiest via `srcset`.
 */
export function isPreoptimizedAiHeroPublishVariantObjectUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (!u.hostname.endsWith(".supabase.co")) return false;
    const p = u.pathname;
    if (!p.includes("/ai-hero/")) return false;
    return /\/ai-hero\/[^/]+\/\d+\.webp$/i.test(p);
  } catch {
    return false;
  }
}

export function rewriteSupabaseStorageObjectUrlsForWebDelivery(
  html: string,
  opts?: SupabaseImageDeliveryOptions,
): string {
  return html.replace(SUPABASE_OBJECT_PUBLIC_IMAGE_RE, (match) => {
    if (match.includes("/storage/v1/render/image/public/")) return match;
    if (isPreoptimizedAiHeroPublishVariantObjectUrl(match)) return match;
    return supabaseStorageObjectUrlToRenderUrl(match, opts);
  });
}

/**
 * Zelfde render-pad met vaste width/quality/resize (query wordt vervangen).
 */
export function supabaseRenderUrlWithParams(
  renderUrl: string,
  params: { width: number; quality?: number; resize?: string },
): string {
  const u = new URL(renderUrl);
  const quality = params.quality ?? (Number(u.searchParams.get("quality")) || 82);
  const resize = params.resize ?? u.searchParams.get("resize") ?? "cover";
  u.search = "";
  u.searchParams.set("width", String(params.width));
  u.searchParams.set("quality", String(quality));
  u.searchParams.set("resize", resize);
  return u.toString();
}

export type BuildSupabaseRenderSrcsetOptions = {
  widths?: readonly number[];
  quality?: number;
  /** Per breedte licht andere quality (default true). */
  variableQuality?: boolean;
};

/**
 * Bouwt een `srcset`-string voor een bestaande **render/image**-URL.
 */
export function buildSupabaseRenderSrcsetFromRenderUrl(
  renderUrl: string,
  opts?: BuildSupabaseRenderSrcsetOptions,
): string | null {
  try {
    const u = new URL(renderUrl);
    if (!u.hostname.endsWith(".supabase.co")) return null;
    if (!u.pathname.includes("/storage/v1/render/image/public/")) return null;
    const base = `${u.origin}${u.pathname}`;
    const baseQuality = opts?.quality ?? (Number(u.searchParams.get("quality")) || 82);
    const resize = u.searchParams.get("resize") ?? "cover";
    const widths = opts?.widths ?? SUPABASE_HERO_SRCSET_WIDTHS;
    const variable = opts?.variableQuality !== false;
    return widths
      .map((w) => {
        const q = variable ? qualityForSrcsetWidth(w, baseQuality) : baseQuality;
        const url = `${base}?width=${w}&quality=${q}&resize=${encodeURIComponent(resize)}`;
        return `${url} ${w}w`;
      })
      .join(", ");
  } catch {
    return null;
  }
}

function escapeHtmlAttrAmpersands(value: string): string {
  return value.replace(/&/g, "&amp;");
}

function decodeAttrUrl(url: string): string {
  return url.replace(/&amp;/g, "&").replace(/&#38;/g, "&");
}

function escapeHtmlAttrDoubleQuoted(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

/** Er staat al een duidelijke hero-foto als `<img>` met Supabase-render + object-cover. */
function heroHasSupabaseObjectCoverImg(html: string): boolean {
  return (
    /<img\b[^>]*\/storage\/v1\/(?:render\/image|object)\/public\/[^"'>\s]+["'][^>]*\bobject-(?:cover|contain)\b/i.test(
      html,
    ) ||
    /<img\b[^>]*\bobject-(?:cover|contain)\b[^>]*\/storage\/v1\/(?:render\/image|object)\/public\//i.test(html)
  );
}

type TailwindBgUrlHit = { token: string; url: string; index: number };

function stripFirstTailwindSupabaseBgUrlToken(html: string): string {
  const hit = extractFirstTailwindBgUrlSupabase(html);
  if (!hit) return html;
  return html.slice(0, hit.index) + html.slice(hit.index + hit.token.length);
}

function extractFirstTailwindBgUrlSupabase(html: string): TailwindBgUrlHit | null {
  const quoted = /bg-\[url\((["'])(https:\/\/[^"']*\.supabase\.co[^"']*)\1\)\]/;
  const m = quoted.exec(html);
  if (m?.index !== undefined) {
    return { token: m[0], url: m[2], index: m.index };
  }
  const unquoted = /bg-\[url\((https:\/\/[^)\s]*\.supabase\.co[^)]*)\)\]/;
  const m2 = unquoted.exec(html);
  if (m2?.index !== undefined) {
    return { token: m2[0], url: m2[1], index: m2.index };
  }
  return null;
}

/**
 * Eerste Tailwind arbitrary `bg-[url]` (Supabase-host) op de hero → full-bleed `<img>`,
 * zodat `srcset`/LCP-hints werken (achtergrond-CSS heeft geen responsive images).
 */
export function promoteHeroSupabaseBackgroundUrlToImg(html: string): string {
  if (heroHasSupabaseObjectCoverImg(html)) {
    /** Voorkom dubbele fetch: naast hero-IMG kan het model nog een Tailwind arbitrary background-url op de sectie hebben — die strippen we. */
    let out = html;
    let next = stripFirstTailwindSupabaseBgUrlToken(out);
    while (next !== out) {
      out = next;
      next = stripFirstTailwindSupabaseBgUrlToken(out);
    }
    return out;
  }
  const hit = extractFirstTailwindBgUrlSupabase(html);
  if (!hit) return html;

  const rawUrl = decodeAttrUrl(hit.url).trim();
  if (!rawUrl.includes(".supabase.co/storage/")) return html;
  const pathNoQuery = (rawUrl.split("?")[0] ?? "").toLowerCase();
  if (pathNoQuery.includes("favicon")) return html;
  if (!/\.(jpe?g|png|webp|avif)(\?|$)/i.test(pathNoQuery)) return html;

  const tagStart = html.lastIndexOf("<", hit.index);
  if (tagStart < 0) return html;

  const withoutBg = html.slice(0, hit.index) + html.slice(hit.index + hit.token.length);
  let openEnd = findHtmlOpenTagEnd(withoutBg, tagStart);
  let openTag = withoutBg.slice(tagStart, openEnd);

  if (/<section\b/i.test(openTag) && !/\b(?:relative|absolute|fixed)\b/i.test(openTag)) {
    if (/\bclass="/i.test(openTag)) {
      openTag = openTag.replace(/\bclass="/i, 'class="relative ');
    } else {
      openTag = openTag.replace(/<section\b/i, '<section class="relative"');
    }
  }

  const patched = withoutBg.slice(0, tagStart) + openTag + withoutBg.slice(openEnd);
  const insertAt = tagStart + openTag.length;
  const srcEsc = escapeHtmlAttrDoubleQuoted(rawUrl);
  const img = `<img class="pointer-events-none absolute inset-0 z-0 h-full w-full object-cover" src="${srcEsc}" alt="" decoding="async" aria-hidden="true" />`;
  return patched.slice(0, insertAt) + img + patched.slice(insertAt);
}

/**
 * Hero-HTML: elke `<img>` met Supabase **render**-`src` krijgt `srcset` + afgeleide `sizes`.
 * Slaat over als `srcset` of `sizes` al gezet is.
 */
export function addResponsiveSrcsetToHeroSupabaseRenderImages(html: string): string {
  return html.replace(/<img\b([^>]*)>/gi, (full, attrs: string) => {
    /** Raster-/SVG-merk in nav of foutief in hero: geen hero-srcset (`sizes=100vw` ≠ logo). */
    if (/\bdata-gentrix-raster-brand\s*=/i.test(attrs)) return full;
    if (/\bdata-studio-brand-mark\s*=/i.test(attrs)) return full;
    if (/\bsrcset\s*=/i.test(attrs)) return full;
    if (/\bsizes\s*=/i.test(attrs)) return full;
    const m = attrs.match(/\bsrc\s*=\s*(["'])([^"']*)\1/i);
    if (!m) return full;
    const q = m[1];
    const src = m[2];
    if (!src.includes(".supabase.co/storage/v1/render/image/public/")) return full;
    const baseQuality = (() => {
      try {
        return Number(new URL(src).searchParams.get("quality")) || 82;
      } catch {
        return 82;
      }
    })();
    const srcset = buildSupabaseRenderSrcsetFromRenderUrl(src, {
      quality: baseQuality,
      variableQuality: true,
    });
    if (!srcset) return full;
    const srcW = SUPABASE_HERO_LCP_SRC_WIDTH;
    const fallbackQ = qualityForSrcsetWidth(srcW, baseQuality);
    const srcFallback = supabaseRenderUrlWithParams(src, { width: srcW, quality: fallbackQ });
    const newSrcAttr = `src=${q}${srcFallback}${q}`;
    const nextAttrs = attrs.replace(/\bsrc\s*=\s*(["'])[^"']*\1/i, newSrcAttr).trim();
    const srcsetEscaped = escapeHtmlAttrAmpersands(srcset);
    const sizes = inferHeroImgSizesFromAttrs(attrs);
    const sizesEscaped = escapeHtmlAttrAmpersands(sizes);
    return `<img ${nextAttrs} srcset="${srcsetEscaped}" sizes="${sizesEscaped}">`;
  });
}

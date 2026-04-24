/**
 * Supabase Storage **object/public** → **render/image** (resize + compressie).
 * Zie https://supabase.com/docs/guides/storage/serving/image-transformations
 *
 * Alleen `.jpg`/`.jpeg`/`.png`/`.webp`/`.avif` — geen `.gif` (animatie) of `.svg`.
 *
 * Image transformations moeten in het Supabase-project aan staan (Pro).
 */

const SUPABASE_OBJECT_PUBLIC_IMAGE_RE =
  /https:\/\/[a-z0-9][a-z0-9-]{0,61}\.supabase\.co\/storage\/v1\/object\/public\/[^\s"'<>)]+\.(?:jpe?g|png|webp|avif)/gi;

/** Viewport-breedtes voor `srcset` (max. 2500 px volgens Supabase-limiet). */
export const SUPABASE_HERO_SRCSET_WIDTHS = [640, 960, 1280, 1920, 2400] as const;

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
  /** Max. lange zijde voor enkelvoudige `src` (default 2400). */
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
  const width = opts?.width ?? 2400;
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
export function rewriteSupabaseStorageObjectUrlsForWebDelivery(
  html: string,
  opts?: SupabaseImageDeliveryOptions,
): string {
  return html.replace(SUPABASE_OBJECT_PUBLIC_IMAGE_RE, (match) => {
    if (match.includes("/storage/v1/render/image/public/")) return match;
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

/**
 * Hero-HTML: elke `<img>` met Supabase **render**-`src` krijgt `srcset` + afgeleide `sizes`.
 * Slaat over als `srcset` of `sizes` al gezet is.
 */
export function addResponsiveSrcsetToHeroSupabaseRenderImages(html: string): string {
  return html.replace(/<img\b([^>]*)>/gi, (full, attrs: string) => {
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
    const maxW = SUPABASE_HERO_SRCSET_WIDTHS[SUPABASE_HERO_SRCSET_WIDTHS.length - 1] ?? 2400;
    const fallbackQ = qualityForSrcsetWidth(maxW, baseQuality);
    const srcFallback = supabaseRenderUrlWithParams(src, { width: maxW, quality: fallbackQ });
    const newSrcAttr = `src=${q}${srcFallback}${q}`;
    const nextAttrs = attrs.replace(/\bsrc\s*=\s*(["'])[^"']*\1/i, newSrcAttr).trim();
    const srcsetEscaped = escapeHtmlAttrAmpersands(srcset);
    const sizes = inferHeroImgSizesFromAttrs(attrs);
    const sizesEscaped = escapeHtmlAttrAmpersands(sizes);
    return `<img ${nextAttrs} srcset="${srcsetEscaped}" sizes="${sizesEscaped}">`;
  });
}

import { preload } from "react-dom";
import {
  addResponsiveSrcsetToAiHeroObjectImages,
  addResponsiveSrcsetToHeroSupabaseRenderImages,
  decodeAttrUrl,
  promoteHeroSupabaseBackgroundUrlToImg,
} from "@/lib/site/supabase-storage-delivery-url";

/**
 * Eerste grote hero-`<img>` (object-cover, viewport-hoogte, of absolute full-bleed) krijgt
 * LCP-vriendelijke attributen. Kleine vierkantjes (typische logo's) worden overgeslagen.
 */
export function applyHeroLcpFetchHintsToFirstHeroImg(html: string): string {
  let replaced = false;
  return html.replace(/<img\b([^>]*)>/gi, (full, attrs: string) => {
    if (replaced) return full;
    if (/\bfetchpriority\s*=/i.test(attrs)) return full;
    const insetFullBleed =
      /\b(?:absolute|fixed)\b/i.test(attrs) &&
      /\binset-0\b/i.test(attrs) &&
      /\bw-full\b/i.test(attrs) &&
      /\bh-full\b/i.test(attrs);
    const looksPhoto =
      /\bobject-(?:cover|contain)\b/i.test(attrs) ||
      /\bmin-h-(?:screen|\[)/i.test(attrs) ||
      /\bh-screen\b/i.test(attrs) ||
      /\bmax-h-\[?\d/i.test(attrs) ||
      insetFullBleed;
    const tinySquare =
      /\bw-(?:6|7|8|9|10|11|12|14|16)\b/.test(attrs) &&
      /\bh-(?:6|7|8|9|10|11|12|14|16)\b/.test(attrs);
    if (!looksPhoto || tinySquare) return full;
    replaced = true;
    let a = attrs.trim();
    if (/\bloading\s*=\s*["']lazy["']/i.test(a)) {
      a = a.replace(/\bloading\s*=\s*["']lazy["']/i, 'loading="eager"');
    } else if (!/\bloading\s*=/i.test(a)) {
      a = `${a} loading="eager"`;
    }
    if (!/\bdecoding\s*=/i.test(a)) {
      a = `${a} decoding="async"`;
    }
    if (!/\bfetchpriority\s*=/i.test(a)) {
      a = `${a} fetchpriority="high"`;
    }
    return `<img ${a}>`;
  });
}

function deliverHeroImagesInSanitizedHtml(html: string): string {
  return applyHeroLcpFetchHintsToFirstHeroImg(
    addResponsiveSrcsetToAiHeroObjectImages(
      addResponsiveSrcsetToHeroSupabaseRenderImages(promoteHeroSupabaseBackgroundUrlToImg(html)),
    ),
  );
}

/** Publish-pipeline: ná `rewriteSupabaseStorageObjectUrlsForWebDelivery` + `ensureHeroRootMinViewportClass`. */
export function enhanceTailwindHeroSectionHtmlForPublish(htmlAfterRewrite: string): string {
  return deliverHeroImagesInSanitizedHtml(htmlAfterRewrite);
}

/** Runtime: opgeslagen HTML (al definitieve object-URL’s) — zelfde afbeelding-levering als publish. */
export function enhanceTailwindHeroSectionHtmlForPublicDelivery(html: string): string {
  return deliverHeroImagesInSanitizedHtml(html);
}

export type HeroLcpImagePreloadDescriptor = {
  href: string;
  imageSrcSet?: string;
  imageSizes?: string;
};

/**
 * Parse eerste waarschijnlijke LCP-hero `<img>` (Supabase + cover / full-bleed) voor `react-dom` preload.
 */
export function parseHeroLcpImagePreloadFromHtml(html: string): HeroLcpImagePreloadDescriptor | null {
  const re = /<img\b([^>]*)>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const attrs = m[1] ?? "";
    const srcM = attrs.match(/\bsrc\s*=\s*(["'])([^"']*)\1/i);
    if (!srcM) continue;
    const href = decodeAttrUrl(srcM[2].trim());
    if (!href.includes(".supabase.co")) continue;
    const insetFullBleed =
      /\b(?:absolute|fixed)\b/i.test(attrs) &&
      /\binset-0\b/i.test(attrs) &&
      /\bw-full\b/i.test(attrs) &&
      /\bh-full\b/i.test(attrs);
    const looksPhoto =
      /\bobject-(?:cover|contain)\b/i.test(attrs) ||
      /\bmin-h-(?:screen|\[)/i.test(attrs) ||
      /\bh-screen\b/i.test(attrs) ||
      /\bmax-h-\[?\d/i.test(attrs) ||
      insetFullBleed;
    const tinySquare =
      /\bw-(?:6|7|8|9|10|11|12|14|16)\b/.test(attrs) &&
      /\bh-(?:6|7|8|9|10|11|12|14|16)\b/.test(attrs);
    if (!looksPhoto || tinySquare) continue;

    const srcsetM = attrs.match(/\bsrcset\s*=\s*(["'])([^"']*)\1/i);
    const sizesM = attrs.match(/\bsizes\s*=\s*(["'])([^"']*)\1/i);
    const imageSrcSet = srcsetM ? decodeAttrUrl(srcsetM[2].trim()) : undefined;
    const imageSizes = sizesM ? decodeAttrUrl(sizesM[2].trim()) : undefined;
    if (imageSrcSet) {
      return {
        href,
        imageSrcSet,
        imageSizes: imageSizes ?? "100vw",
      };
    }
    return { href };
  }
  return null;
}

/** RSC-render: hint aan browser vóór body-parsing (matcht eerste LCP-kandidaat in hero-HTML). */
export function invokeHeroLcpImagePreloadFromHtml(html: string): void {
  const d = parseHeroLcpImagePreloadFromHtml(html);
  if (!d) return;
  if (d.imageSrcSet) {
    preload(d.href, {
      as: "image",
      fetchPriority: "high",
      imageSrcSet: d.imageSrcSet,
      imageSizes: d.imageSizes,
    });
  } else {
    preload(d.href, { as: "image", fetchPriority: "high" });
  }
}

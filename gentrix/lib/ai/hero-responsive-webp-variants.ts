import sharp from "sharp";
import { qualityForSrcsetWidth } from "@/lib/site/supabase-storage-delivery-url";

/** Publish-time breakpoints: echte bestanden in `site-assets/…/ai-hero/<stem>/<w>.webp`. */
export const HERO_PUBLISH_WEBP_WIDTH_TARGETS = [640, 960, 1280, 1920, 2400] as const;

export type HeroPublishWebpVariant = {
  /** `srcset`-W-waarde = intrinsieke breedte van de WebP-bitmap. */
  width: number;
  bytes: Buffer;
};

/**
 * Bouwt genormaliseerde WebP-varianten van één bron-raster (PNG/JPEG/WebP), zonder te upscalen.
 */
export async function buildHeroResponsiveWebpVariants(
  bytes: Buffer,
  mime: string,
): Promise<HeroPublishWebpVariant[] | null> {
  if (bytes.length < 500) return null;
  const m = mime.toLowerCase().trim();
  if (m !== "image/png" && m !== "image/jpeg" && m !== "image/jpg" && m !== "image/webp") {
    return null;
  }

  try {
    const rotated = await sharp(bytes, { failOn: "none" }).rotate().toBuffer();
    const seenWidths = new Set<number>();
    const out: HeroPublishWebpVariant[] = [];
    const baseQ = 82;

    for (const target of HERO_PUBLISH_WEBP_WIDTH_TARGETS) {
      const buf = await sharp(rotated, { failOn: "none" })
        .resize({
          width: target,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: qualityForSrcsetWidth(target, baseQ), effort: 5 })
        .toBuffer();
      if (buf.length < 12) continue;
      const mw = (await sharp(buf, { failOn: "none" }).metadata()).width ?? target;
      if (mw < 1 || seenWidths.has(mw)) continue;
      seenWidths.add(mw);
      out.push({ width: mw, bytes: buf });
    }

    return out.length ? out : null;
  } catch {
    return null;
  }
}

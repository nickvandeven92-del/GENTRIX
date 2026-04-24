import sharp from "sharp";

const MAX_LONG_EDGE_PX = 2560;
const WEBP_QUALITY = 82;

/**
 * AI-heroes komen vaak als grote PNG binnen. Zonder aparte multi-file CDN-pipeline
 * encoderen we server-side naar WebP vóór upload naar `site-assets` — kleinere bytes,
 * snellere LCP, en Supabase-transform leest voortaan een lichter bronbestand.
 */
export async function tryEncodeHeroRasterAsWebp(
  bytes: Buffer,
  mime: string,
): Promise<{ bytes: Buffer; mime: "image/webp" } | null> {
  const m = mime.toLowerCase().trim();
  if (m === "image/webp") {
    return { bytes, mime: "image/webp" };
  }
  if (m !== "image/png" && m !== "image/jpeg" && m !== "image/jpg") {
    return null;
  }
  if (bytes.length < 500) return null;

  try {
    const meta = await sharp(bytes, { failOn: "none" }).metadata();
    let pipeline = sharp(bytes, { failOn: "none" }).rotate();

    const w = meta.width ?? 0;
    const h = meta.height ?? 0;
    if (w > 0 && h > 0) {
      const long = Math.max(w, h);
      if (long > MAX_LONG_EDGE_PX) {
        pipeline = pipeline.resize({
          width: w >= h ? MAX_LONG_EDGE_PX : undefined,
          height: h > w ? MAX_LONG_EDGE_PX : undefined,
          fit: "inside",
          withoutEnlargement: true,
        });
      }
    }

    const out = await pipeline.webp({ quality: WEBP_QUALITY, effort: 5 }).toBuffer();
    /** RIFF/WebP-header; geen vaste byte-minimum — kleine test-PNG’s kunnen <500 B WebP zijn. */
    if (out.length < 12) return null;
    /** Zeldzaam: WebP groter dan PNG — behoud origineel. */
    if (out.length >= bytes.length * 0.98) return null;
    return { bytes: out, mime: "image/webp" };
  } catch {
    return null;
  }
}

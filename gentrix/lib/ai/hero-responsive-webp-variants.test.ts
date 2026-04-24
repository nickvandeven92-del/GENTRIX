import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { buildHeroResponsiveWebpVariants, HERO_PUBLISH_WEBP_WIDTH_TARGETS } from "@/lib/ai/hero-responsive-webp-variants";

async function syntheticPngWide(): Promise<Buffer> {
  return sharp({
    create: {
      width: 2000,
      height: 1200,
      channels: 3,
      background: { r: 20, g: 60, b: 140 },
    },
  })
    .png({ compressionLevel: 6 })
    .toBuffer();
}

describe("buildHeroResponsiveWebpVariants", () => {
  it("levert meerdere WebP-breedtes zonder upscalen", async () => {
    const png = await syntheticPngWide();
    expect(png.length).toBeGreaterThan(500);
    const variants = await buildHeroResponsiveWebpVariants(png, "image/png");
    expect(variants).not.toBeNull();
    const ws = variants!.map((v) => v.width).sort((a, b) => a - b);
    expect(ws.length).toBeGreaterThanOrEqual(3);
    expect(ws[0]).toBeLessThanOrEqual(640);
    expect(ws[ws.length - 1]).toBeLessThanOrEqual(2000);
    for (const v of variants!) {
      expect(v.bytes.length).toBeGreaterThan(12);
      expect(v.bytes[0]).toBe(0x52);
      expect(v.bytes[1]).toBe(0x49);
    }
    expect(ws.length).toBeLessThanOrEqual(HERO_PUBLISH_WEBP_WIDTH_TARGETS.length);
  });
});

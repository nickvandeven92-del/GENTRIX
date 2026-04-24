import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { tryEncodeHeroRasterAsWebp } from "@/lib/ai/hero-raster-encode-webp";

async function syntheticPngOver500Bytes(): Promise<Buffer> {
  return sharp({
    create: {
      width: 320,
      height: 240,
      channels: 3,
      background: { r: 40, g: 90, b: 200 },
    },
  })
    .png({ compressionLevel: 0 })
    .toBuffer();
}

describe("tryEncodeHeroRasterAsWebp", () => {
  it("zet PNG om naar WebP", async () => {
    const png = await syntheticPngOver500Bytes();
    expect(png.length).toBeGreaterThan(500);
    const out = await tryEncodeHeroRasterAsWebp(png, "image/png");
    expect(out).not.toBeNull();
    expect(out!.mime).toBe("image/webp");
    expect(out!.bytes[0]).toBe(0x52);
    expect(out!.bytes[1]).toBe(0x49);
    expect(out!.bytes[2]).toBe(0x46);
    expect(out!.bytes[3]).toBe(0x46);
  });

  it("laat bestaande WebP ongemoeid", async () => {
    const pngBuf = await syntheticPngOver500Bytes();
    const png = await tryEncodeHeroRasterAsWebp(pngBuf, "image/png");
    expect(png).not.toBeNull();
    const again = await tryEncodeHeroRasterAsWebp(png!.bytes, "image/webp");
    expect(again?.bytes.equals(png!.bytes)).toBe(true);
  });
});

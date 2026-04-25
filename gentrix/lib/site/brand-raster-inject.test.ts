import { describe, expect, it } from "vitest";
import type { StudioRasterBrandSet } from "@/lib/ai/tailwind-sections-schema";
import {
  applyRasterBrandMarkToSections,
  rasterHeaderUrlIsConfusableWithFavicon,
} from "@/lib/site/brand-raster-inject";

const baseRaster = (over: Partial<StudioRasterBrandSet>): StudioRasterBrandSet => ({
  headerLogoUrl: "https://cdn.example/header.webp",
  favicon32Url: "https://cdn.example/favicon-32.png",
  favicon192Url: "https://cdn.example/favicon-192.png",
  ...over,
});

describe("rasterHeaderUrlIsConfusableWithFavicon", () => {
  it("detecteert gelijke URL als favicon32", () => {
    const u = "https://cdn.example/favicon-32.png";
    expect(rasterHeaderUrlIsConfusableWithFavicon(u, baseRaster({ headerLogoUrl: u }))).toBe(true);
  });

  it("detecteert gelijke URL als favicon192", () => {
    const u = "https://cdn.example/favicon-192.png";
    expect(rasterHeaderUrlIsConfusableWithFavicon(u, baseRaster({ headerLogoUrl: u }))).toBe(true);
  });

  it("detecteert favicon-pad in filename", () => {
    expect(
      rasterHeaderUrlIsConfusableWithFavicon("https://x.com/site-assets/abc/favicon-thing.png", baseRaster({})),
    ).toBe(true);
  });

  it("laat normale header-URL door", () => {
    expect(rasterHeaderUrlIsConfusableWithFavicon("https://cdn.example/header.webp", baseRaster({}))).toBe(false);
  });
});

describe("applyRasterBrandMarkToSections", () => {
  it("injecteert geen raster wanneer headerUrl het favicon is", () => {
    const u = "https://cdn.example/favicon-32.png";
    const raster = baseRaster({ headerLogoUrl: u });
    const sections = [{ sectionName: "hero", html: `<header><a href="__STUDIO_SITE_BASE__">X</a></header>` }];
    const out = applyRasterBrandMarkToSections(sections, raster, "Acme");
    expect(out[0]!.html).toContain(">X</a>");
    expect(out[0]!.html).not.toContain("data-gentrix-raster-brand");
  });
});

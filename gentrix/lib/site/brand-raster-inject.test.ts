import { describe, expect, it } from "vitest";
import type { StudioRasterBrandSet } from "@/lib/ai/tailwind-sections-schema";
import {
  applyRasterBrandMarkToSections,
  rasterHeaderUrlIsConfusableWithFavicon,
  stripHeroRasterBrandDuplicateAfterStudioNav,
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

  it("zet raster in studio-nav-chrome merk-link (class group)", () => {
    const raster = baseRaster({});
    const sections = [
      {
        sectionName: "Hero",
        html: `<header data-studio-nav-chrome="1"><a href="/" class="group flex min-w-0 shrink-0 items-center gap-2.5"><span class="inline-flex h-9 w-9">G</span><span>GENTRIX</span></a></header><section id="hero"><div class="grid">OK</div></section>`,
      },
    ];
    const out = applyRasterBrandMarkToSections(sections, raster, "Gentrix");
    expect(out[0]!.html).toContain("data-gentrix-raster-brand");
    expect(out[0]!.html).toContain("cdn.example/header.webp");
    expect(out[0]!.html).toContain(">OK</div>");
    expect(out[0]!.html).not.toContain("<span class=\"inline-flex h-9 w-9\">G</span>");
  });

  it("laat secties ongewijzigd wanneer chrome geen group-merklink heeft", () => {
    const raster = baseRaster({});
    const sections = [
      {
        sectionName: "Hero",
        html: `<header data-studio-nav-chrome="1"><a href="#top">G</a></header><section id="hero"><p>x</p></section>`,
      },
    ];
    const out = applyRasterBrandMarkToSections(sections, raster, "Gentrix");
    expect(out[0]!.html).toBe(sections[0]!.html);
  });
});

describe("stripHeroRasterBrandDuplicateAfterStudioNav", () => {
  it("verwijdert foutief voor hero geïnjecteerd raster-blok als studio-chrome bestaat", () => {
    const html = `<header data-studio-nav-chrome="1"></header>
<section id="hero" class="flex items-stretch">
<div class="flex shrink-0 items-center" data-gentrix-raster-brand="1"><a href="/" data-studio-brand-mark="1"><img src="https://x/header.webp" alt=""/></a></div>
<div class="grid">body</div>
</section>`;
    const out = stripHeroRasterBrandDuplicateAfterStudioNav(html);
    expect(out).not.toContain("data-gentrix-raster-brand");
    expect(out).toContain('<div class="grid">body</div>');
  });

  it("laat hero ongemoeid zonder studio-chrome", () => {
    const html = `<section id="hero"><div data-gentrix-raster-brand="1">x</div></section>`;
    expect(stripHeroRasterBrandDuplicateAfterStudioNav(html)).toBe(html);
  });
});

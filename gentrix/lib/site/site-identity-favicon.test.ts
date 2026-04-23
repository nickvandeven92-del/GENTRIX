import { describe, expect, it } from "vitest";
import {
  pickMarkCharForSiteIdentity,
  pickPrimaryHexForSiteIdentity,
  resolvePublicSiteFaviconSvg,
} from "@/lib/site/site-identity-favicon";
import type { TailwindPageConfig } from "@/lib/ai/tailwind-sections-schema";

describe("site-identity-favicon", () => {
  it("prefers logo favicon when within size limit", () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><circle r="4" cx="4" cy="4"/></svg>';
    const out = resolvePublicSiteFaviconSvg({
      logoFavicon: svg,
      displayName: "Acme",
      slug: "acme",
    });
    expect(out).toBe(svg);
  });

  it("renders identity SVG when logo favicon missing", () => {
    const out = resolvePublicSiteFaviconSvg({
      displayName: "De Bakker",
      slug: "bakker-amsterdam",
    });
    expect(out).toContain("viewBox=\"0 0 32 32\"");
    expect(out).toContain("B");
    expect(out).toMatch(/<rect[^>]+rx="8"/);
  });

  it("uses theme primary from modern Tailwind config", () => {
    const cfg = {
      style: "minimal",
      font: "Inter",
      theme: {
        primary: "#ff00aa",
        accent: "#00aa00",
        secondary: "#111111",
      },
    } as unknown as TailwindPageConfig;
    const hex = pickPrimaryHexForSiteIdentity("any-slug", cfg, null);
    expect(hex).toBe("#ff00aa");
  });

  it("falls back to slug-based hue without config", () => {
    const a = pickPrimaryHexForSiteIdentity("slug-a", null, null);
    const b = pickPrimaryHexForSiteIdentity("slug-b", null, null);
    expect(a).toMatch(/^#[0-9a-f]{6}$/);
    expect(b).toMatch(/^#[0-9a-f]{6}$/);
    expect(a).not.toBe(b);
  });

  it("picks first letter or digit from display name", () => {
    expect(pickMarkCharForSiteIdentity("123 Events", "x")).toBe("1");
    expect(pickMarkCharForSiteIdentity("", "zorg-huis")).toBe("Z");
  });
});

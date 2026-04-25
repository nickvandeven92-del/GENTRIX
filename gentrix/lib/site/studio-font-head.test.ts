import { describe, expect, it } from "vitest";
import {
  buildStudioFontHeadFragment,
  extractFirstWebfontFamilyFromStack,
  googleFontsStylesheetHrefForStack,
  isBundledSelfHostedInterPrimary,
} from "@/lib/site/studio-font-head";

describe("studio-font-head", () => {
  it("Inter als eerste familie → zelf-gehoste woff2, geen Google", () => {
    const h = buildStudioFontHeadFragment({ fontStack: "Inter, system-ui, sans-serif" });
    expect(h).toContain("/fonts/inter-latin-wght-normal.woff2");
    expect(h).toContain("/fonts/inter-latin-ext-wght-normal.woff2");
    expect(h).toContain('font-family:Inter');
    expect(h).not.toContain("fonts.googleapis.com");
  });

  it("andere Google-font → uitgestelde stylesheet + preconnect", () => {
    const h = buildStudioFontHeadFragment({ fontStack: '"Playfair Display", Georgia, serif' });
    expect(h).toContain("fonts.googleapis.com");
    expect(h).toContain("fonts.gstatic.com");
    expect(h).toContain('media="print"');
    expect(h).toContain("Playfair+Display");
  });

  it("alleen system stack → leeg fragment", () => {
    expect(buildStudioFontHeadFragment({ fontStack: "system-ui, sans-serif" })).toBe("");
  });

  it("helpers voor eerste familie", () => {
    expect(extractFirstWebfontFamilyFromStack(`"Inter", sans-serif`)).toBe("Inter");
    expect(isBundledSelfHostedInterPrimary("Inter")).toBe(true);
    expect(isBundledSelfHostedInterPrimary("Inter Tight")).toBe(false);
    expect(googleFontsStylesheetHrefForStack("Inter, system-ui")).toMatch(/family=Inter/);
    expect(googleFontsStylesheetHrefForStack("DM Sans, sans-serif")).toMatch(/family=DM\+Sans/);
  });
});

import { describe, expect, it, vi } from "vitest";
import {
  allowsUnsplashStockResolveInGalleryOnlyMode,
  cleanupStrippedStockMarkup,
  composeUnsplashSearchQuery,
  htmlMayContainUnsplashPhotoUrl,
  replaceOverflowUnsplashRanges,
  stripAllUnsplashPhotoUrlsInHtml,
} from "@/lib/ai/unsplash-image-replace";

describe("allowsUnsplashStockResolveInGalleryOnlyMode", () => {
  it("staat standaard alleen gallery toe (geen stock-hero)", () => {
    expect(allowsUnsplashStockResolveInGalleryOnlyMode({ id: "hero", sectionName: "Hero" }, 0)).toBe(false);
    expect(allowsUnsplashStockResolveInGalleryOnlyMode({ id: "gallery", sectionName: "Galerij" }, 3)).toBe(true);
    expect(allowsUnsplashStockResolveInGalleryOnlyMode({ id: "header", sectionName: "Kop" }, 0)).toBe(false);
    expect(allowsUnsplashStockResolveInGalleryOnlyMode({ id: "about", sectionName: "Over ons" }, 2)).toBe(false);
  });

  it("met unsplashAllowHeroStock ook hero en header", async () => {
    vi.resetModules();
    vi.doMock("@/lib/ai/studio-generation-fixed-config", async (importOriginal) => {
      const actual = await importOriginal<typeof import("@/lib/ai/studio-generation-fixed-config")>();
      return {
        STUDIO_SITE_GENERATION: {
          ...actual.STUDIO_SITE_GENERATION,
          unsplashAllowHeroStock: true,
          unsplashGalleryOnly: true,
        },
      };
    });
    try {
      const { allowsUnsplashStockResolveInGalleryOnlyMode: allow } = await import(
        "@/lib/ai/unsplash-image-replace"
      );
      expect(allow({ id: "hero", sectionName: "Hero" }, 0)).toBe(true);
      expect(allow({ id: "gallery", sectionName: "Galerij" }, 3)).toBe(true);
      expect(allow({ id: "header", sectionName: "Kop" }, 0)).toBe(true);
    } finally {
      vi.doUnmock("@/lib/ai/studio-generation-fixed-config");
      vi.resetModules();
    }
  });
});

describe("htmlMayContainUnsplashPhotoUrl", () => {
  it("detecteert typische Unsplash-photo-URL", () => {
    expect(htmlMayContainUnsplashPhotoUrl('<img src="https://images.unsplash.com/photo-1?w=1" />')).toBe(true);
    expect(htmlMayContainUnsplashPhotoUrl("<section class='bg-zinc-900'>alleen tekst</section>")).toBe(false);
  });
});

describe("composeUnsplashSearchQuery", () => {
  const theme =
    "Een webshop in erotische artikelen. Donker met neon rood, wallen Amsterdam sfeer. Rob Schoones.";

  it("zet briefing-keywords vóór generieke hero-alt (branche-eerst)", () => {
    const q = composeUnsplashSearchQuery({
      altText: "professional business team office",
      sectionId: "hero",
      sectionName: "Hero",
      sectionIndex: 0,
      themeContext: theme,
    });
    const lower = q.toLowerCase();
    expect(lower.startsWith("webshop") || lower.startsWith("erotische") || lower.startsWith("neon")).toBe(
      true,
    );
    expect(lower.includes("office")).toBe(true);
  });

  it("houdt bij niet-hero sectie sectie-alt vóór lange briefing (lokale context)", () => {
    const q = composeUnsplashSearchQuery({
      altText: "barber chair and mirror warm lighting",
      sectionId: "about",
      sectionName: "Over ons",
      sectionIndex: 2,
      themeContext: theme + " barbershop rotterdam",
    });
    expect(q.toLowerCase().startsWith("barber")).toBe(true);
  });

  it("valt terug op alt zonder themeContext", () => {
    const q = composeUnsplashSearchQuery({
      altText: "coffee roastery interior beans",
      sectionId: "hero",
      sectionName: "Hero",
      sectionIndex: 0,
      themeContext: "",
    });
    expect(q.toLowerCase()).toContain("coffee");
  });
});

describe("stripAllUnsplashPhotoUrlsInHtml", () => {
  it("vervangt alle Unsplash-photo-URL's", () => {
    const u = "https://images.unsplash.com/photo-111?w=1";
    const html = `<div style="background:url(${u})"><img src="${u}" alt="x" /></div>`;
    const out = stripAllUnsplashPhotoUrlsInHtml(html);
    expect(out).toContain("data:image/gif;base64,");
    expect(out).not.toContain("images.unsplash.com");
  });
});

describe("cleanupStrippedStockMarkup", () => {
  it("verwijdert placeholder-<img> en zet url(placeholder) naar none", () => {
    const u = "https://images.unsplash.com/photo-999?w=1";
    const stripped = stripAllUnsplashPhotoUrlsInHtml(`<section><img src="${u}" alt="x"/><div style="background-image:url(${u})"></div></section>`);
    const out = cleanupStrippedStockMarkup(stripped);
    expect(out).not.toMatch(/<img\b/i);
    expect(out.toLowerCase()).toContain("none");
    expect(out).not.toContain("images.unsplash.com");
  });
});

describe("replaceOverflowUnsplashRanges", () => {
  it("vervangt alleen de opgegeven ranges door een data-URI", () => {
    const u1 = "https://images.unsplash.com/photo-1111111111111-aaaaaaaaaa?w=800&q=80";
    const u2 = "https://images.unsplash.com/photo-2222222222222-bbbbbbbbbb?w=800&q=80";
    const html = `<div style="background-image:url(${u1})"><img src="${u2}" alt="x" /></div>`;
    const u1Start = html.indexOf(u1);
    const u2Start = html.indexOf(u2);
    const out = replaceOverflowUnsplashRanges(html, [
      { start: u2Start, end: u2Start + u2.length },
      { start: u1Start, end: u1Start + u1.length },
    ]);
    expect(out).toContain("data:image/gif;base64,");
    expect(out).not.toContain("photo-2222222222222");
    expect(out).not.toContain("photo-1111111111111");
  });
});

import { describe, expect, it } from "vitest";
import {
  appendPrebakedHeroImageToUserContent,
  heroSectionOpenTagHasInjectableHeroId,
  injectAiHeroImageIntoHeroSectionHtml,
  shouldAttemptAiHeroImageForHtml,
} from "@/lib/ai/ai-hero-image-postprocess";

describe("ai-hero-image-postprocess", () => {
  it("injectAiHeroImageIntoHeroSectionHtml voegt img toe en zet relative op section", () => {
    const html = `<section id="hero" class="min-h-screen overflow-hidden bg-zinc-900 text-white"><div class="p-8">Hi</div></section>`;
    const out = injectAiHeroImageIntoHeroSectionHtml(html, "https://example.com/x.png");
    expect(out).not.toBeNull();
    expect(out).toContain("data-gentrix-ai-hero-img=");
    expect(out).toContain("https://example.com/x.png");
    expect(out).toMatch(/class="[^"]*\brelative\b/);
  });

  it("shouldAttemptAiHeroImageForHtml is false bij video", () => {
    const html = `<section id="hero"><video src="a.mp4"></video></section>`;
    expect(shouldAttemptAiHeroImageForHtml(html)).toBe(false);
  });

  it("shouldAttemptAiHeroImageForHtml is false bij bestaande externe img", () => {
    const html = `<section id="hero"><img src="https://cdn.example.com/a.jpg" alt="" /></section>`;
    expect(shouldAttemptAiHeroImageForHtml(html)).toBe(false);
  });

  it("shouldAttemptAiHeroImageForHtml is true zonder img/video", () => {
    const html = `<section id="hero" class="relative"><div>tekst</div></section>`;
    expect(shouldAttemptAiHeroImageForHtml(html)).toBe(true);
  });

  it("id=hero alleen op inner div: niet injecteerbaar en geen upstream hero-poging", () => {
    const html = `<section class="min-h-screen"><div id="hero" class="grid">copy</div></section>`;
    expect(heroSectionOpenTagHasInjectableHeroId(html)).toBe(false);
    expect(injectAiHeroImageIntoHeroSectionHtml(html, "https://example.com/x.png")).toBeNull();
    expect(shouldAttemptAiHeroImageForHtml(html)).toBe(false);
  });

  it("section id = hero met spaties: wel injecteerbaar", () => {
    const html = `<section id = "hero" class="min-h-screen"><div>copy</div></section>`;
    expect(heroSectionOpenTagHasInjectableHeroId(html)).toBe(true);
    const out = injectAiHeroImageIntoHeroSectionHtml(html, "https://example.com/x.png");
    expect(out).not.toBeNull();
    expect(out).toContain("data-gentrix-ai-hero-img=");
  });

  it("appendPrebakedHeroImageToUserContent plakt URL-blok achter string user content", () => {
    const out = appendPrebakedHeroImageToUserContent("BEGIN", "https://cdn.example.com/hero.png") as string;
    expect(out.startsWith("BEGIN")).toBe(true);
    expect(out).toContain("https://cdn.example.com/hero.png");
    expect(out).toContain("ASSET-FIRST");
  });
});

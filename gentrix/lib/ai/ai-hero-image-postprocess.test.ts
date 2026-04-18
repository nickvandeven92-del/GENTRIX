import { describe, expect, it } from "vitest";
import {
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
});

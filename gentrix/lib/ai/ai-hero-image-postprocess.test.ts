import { describe, expect, it } from "vitest";
import {
  appendPrebakedHeroImageToUserContent,
  heroSectionOpenTagHasInjectableHeroId,
  injectAiHeroImageIntoHeroSectionHtml,
  shouldAttemptAiHeroImageForHtml,
  siteChatMessageSuggestsAiHeroRaster,
  stripHeroRasterPlaceholdersForSiteChatAiHero,
} from "@/lib/ai/ai-hero-image-postprocess";

describe("ai-hero-image-postprocess", () => {
  it("siteChatMessageSuggestsAiHeroRaster herkent hero + luxe en sluit verwijder-flow uit", () => {
    expect(siteChatMessageSuggestsAiHeroRaster("Maak de hero luxer en high-end")).toBe(true);
    expect(siteChatMessageSuggestsAiHeroRaster("Maak de hero afbeelding luxer")).toBe(true);
    expect(siteChatMessageSuggestsAiHeroRaster("verwijder de hero foto")).toBe(false);
    expect(siteChatMessageSuggestsAiHeroRaster("verwijder de hero")).toBe(false);
  });

  it("siteChatMessageSuggestsAiHeroRaster herkent EN/NL varianten voor nieuwe hero-visual", () => {
    expect(siteChatMessageSuggestsAiHeroRaster("I want an impressive hero with a close-up shaver in black and white")).toBe(
      true,
    );
    expect(siteChatMessageSuggestsAiHeroRaster("indrukwekkende hero met scheermes zwart-wit")).toBe(true);
    expect(siteChatMessageSuggestsAiHeroRaster("another hero image please")).toBe(true);
  });

  it("stripHeroRasterPlaceholdersForSiteChatAiHero verwijdert img en background-url zodat AI-inject mag", () => {
    // Geen letterlijke Tailwind arbitrary background-url class in één string: build toolchain kan dat parsen.
    const arbitraryBg =
      "bg" + "-" + "[url(https://x.example.com/screen.png)]";
    const html = `<section id="hero" class="relative min-h-screen ${arbitraryBg}">
      <img src="https://x.example.com/paste.png" alt="" class="absolute inset-0" />
      <div style="background-image: url(https://x.example.com/bg.jpg)" class="p-4">tekst</div>
    </section>`;
    const stripped = stripHeroRasterPlaceholdersForSiteChatAiHero(html);
    expect(stripped).not.toContain("paste.png");
    expect(stripped).not.toContain("background-image:");
    expect(stripped).toContain("bg-transparent");
    expect(shouldAttemptAiHeroImageForHtml(stripped)).toBe(true);
  });

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

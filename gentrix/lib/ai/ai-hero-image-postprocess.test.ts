import { describe, expect, it } from "vitest";
import {
  appendPrebakedHeroImageToUserContent,
  buildOpenAiHeroPrompt,
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
    expect(siteChatMessageSuggestsAiHeroRaster("Maak de hero exclusiever, meer zakelijk")).toBe(true);
    expect(siteChatMessageSuggestsAiHeroRaster("verwijder de hero foto")).toBe(false);
    expect(siteChatMessageSuggestsAiHeroRaster("verwijder de hero")).toBe(false);
  });

  it("siteChatMessageSuggestsAiHeroRaster herkent EN/NL varianten voor nieuwe hero-visual", () => {
    expect(siteChatMessageSuggestsAiHeroRaster("I want an impressive hero with a close-up shaver in black and white")).toBe(
      true,
    );
    expect(siteChatMessageSuggestsAiHeroRaster("indrukwekkende hero met scheermes zwart-wit")).toBe(true);
    expect(siteChatMessageSuggestsAiHeroRaster("another hero image please")).toBe(true);
    expect(
      siteChatMessageSuggestsAiHeroRaster(
        "Genereer een close up afbeelding van een scheer apparaat voor mijn hero, ik wil de split hero behouden",
      ),
    ).toBe(true);
  });

  it("siteChatMessageSuggestsAiHeroRaster: klacht zonder woord «hero» (dezelfde afbeelding) triggert server-raster", () => {
    expect(siteChatMessageSuggestsAiHeroRaster("Je hebt exact dezelfde afbeelding neergezet.")).toBe(true);
    expect(siteChatMessageSuggestsAiHeroRaster("Dit is de identieke output als net, graag opnieuw genereren")).toBe(true);
    expect(siteChatMessageSuggestsAiHeroRaster("Ik krijg geen nieuwe foto")).toBe(true);
  });

  it("siteChatMessageSuggestsAiHeroRaster: dezelfde afbeelding in footer-teamcontext triggert niet", () => {
    expect(siteChatMessageSuggestsAiHeroRaster("Zet exact dezelfde afbeelding in de footer als bij team")).toBe(false);
  });

  it("buildOpenAiHeroPrompt: variationSeed voegt compositie-instructie toe", () => {
    const p = buildOpenAiHeroPrompt("Salon", "Close-up schaar", null, { variationSeed: "deadbeef01" });
    expect(p).toContain("deadbeef01");
    expect(p).toContain("Composition variation id");
    expect(p).toContain("Brief (primary creative direction");
  });

  it("buildOpenAiHeroPrompt: stuurt macro- en anti-stock-laptoprichting", () => {
    const p = buildOpenAiHeroPrompt("GENTRIX", "IT-advies", null);
    expect(p).toMatch(/macro|close-up/i);
    expect(p).toMatch(/laptop|mug|notebook/i);
  });

  it("buildOpenAiHeroPrompt: bevat altijd creatief mandaat (geen sjabloon-held)", () => {
    const p = buildOpenAiHeroPrompt("Bakkerij Jan", "Vers brood dagelijks.", null);
    expect(p).toMatch(/Creative mandate|site-specific|bespoke/i);
    expect(p).toMatch(/not an interchangeable|formula output/i);
  });

  it("buildOpenAiHeroPrompt: website-generator briefing krijgt web-studio sector bias", () => {
    const p = buildOpenAiHeroPrompt(
      "GENTRIX",
      "Platform dat automatisch websites genereert voor ondernemers.",
      null,
    );
    expect(p).toMatch(/Sector cue/i);
    expect(p).toMatch(/digital-atelier|institutional-tech/i);
    expect(p).toMatch(/spiral notebook|marble desk/i);
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

  it("injectAiHeroImageIntoHeroSectionHtml: responsive-set met srcset/sizes", () => {
    const html = `<section id="hero" class="min-h-screen overflow-hidden"><div class="p-8">Hi</div></section>`;
    const inject = {
      variants: [
        { width: 640, url: "https://ab.supabase.co/storage/v1/object/public/site-assets/home/ai-hero/stem/640.webp" },
        { width: 1280, url: "https://ab.supabase.co/storage/v1/object/public/site-assets/home/ai-hero/stem/1280.webp" },
      ],
      defaultSrc: "https://ab.supabase.co/storage/v1/object/public/site-assets/home/ai-hero/stem/1280.webp",
    };
    const out = injectAiHeroImageIntoHeroSectionHtml(html, inject);
    expect(out).toContain("srcset=");
    expect(out).toContain("sizes=");
    expect(out).toContain("640w");
    expect(out).toContain("1280w");
    expect(out).toMatch(/fetchpriority="high"/);
  });

  it("injectAiHeroImageIntoHeroSectionHtml split-grid: img in eerste kolom, gradient uit class", () => {
    const html = `<section id="hero" class="relative grid min-h-screen grid-cols-1 md:grid-cols-2">
      <div class="min-h-[50vh] bg-gradient-to-br from-stone-400 to-stone-200"></div>
      <div class="p-8">Copy</div>
    </section>`;
    const out = injectAiHeroImageIntoHeroSectionHtml(html, "https://example.com/razor.png");
    expect(out).not.toBeNull();
    expect(out).toContain("data-gentrix-ai-hero-img=");
    expect(out).toContain("https://example.com/razor.png");
    expect(out).not.toMatch(/bg-gradient-to-br/);
    expect(out).toMatch(/<div[^>]*class="[^"]*overflow-hidden/);
    const firstImg = out!.indexOf("data-gentrix-ai-hero-img");
    const firstDiv = out!.indexOf("<div");
    expect(firstImg).toBeLessThan(out!.indexOf("Copy"));
    expect(firstImg).toBeGreaterThan(firstDiv);
  });

  it("inject split-grid: Tailwind [&>svg] in eerste <div> lekt geen fragment (geen naïeve [^>] op div)", () => {
    const html = `<section id="hero" class="grid min-h-screen grid-cols-1 md:grid-cols-2 text-white">
<div class="relative z-10 min-h-[50vh] bg-gradient-to-br from-stone-500 to-stone-300 [&>svg]:size-6"></div>
<div class="p-8">Copy</div>
</section>`;
    const out = injectAiHeroImageIntoHeroSectionHtml(html, "https://example.com/h.png");
    expect(out).not.toBeNull();
    expect(out).toContain("data-gentrix-ai-hero-img=");
    expect(out).toContain("[&>svg]:size-6");
    expect(out).not.toMatch(/>\s*\[&>svg]/);
    expect(out!.indexOf("Copy")).toBeGreaterThan(0);
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

  it("data-section=hero op section: injecteerbaar als id=hero", () => {
    const html = `<section data-section="hero" class="relative min-h-screen"><p>x</p></section>`;
    expect(heroSectionOpenTagHasInjectableHeroId(html)).toBe(true);
    expect(shouldAttemptAiHeroImageForHtml(html)).toBe(true);
    const out = injectAiHeroImageIntoHeroSectionHtml(html, "https://example.com/d.png");
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

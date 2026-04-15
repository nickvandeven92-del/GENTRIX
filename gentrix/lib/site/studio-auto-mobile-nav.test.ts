import { describe, expect, it } from "vitest";
import type { TailwindPageConfig } from "@/lib/ai/tailwind-sections-schema";
import {
  buildStudioAutoMobileNavHeaderHtml,
  headerHasWiredAlpineMobileMenuToggle,
  shouldInjectStudioAutoMobileNav,
} from "@/lib/site/studio-auto-mobile-nav";

describe("headerHasWiredAlpineMobileMenuToggle", () => {
  it("is true bij x-data + breakpoint-hidden knop + @click", () => {
    const html = `
      <header x-data="{ menuOpen: false }" class="fixed inset-x-0 top-0 z-50">
        <button type="button" class="md:hidden" @click="menuOpen = !menuOpen">Menu</button>
      </header>`;
    expect(headerHasWiredAlpineMobileMenuToggle(html)).toBe(true);
  });

  it("is false zonder @click op de menuknop", () => {
    const html = `
      <header x-data="{ menuOpen: false }" class="fixed inset-x-0 top-0 z-50">
        <button type="button" class="inline-flex md:hidden" aria-label="Open menu">☰</button>
      </header>`;
    expect(headerHasWiredAlpineMobileMenuToggle(html)).toBe(false);
  });

  it("is false zonder x-data met nav-toggle", () => {
    const html = `
      <header class="fixed top-0 z-50 w-full">
        <button type="button" class="lg:hidden" @click="void 0">☰</button>
      </header>`;
    expect(headerHasWiredAlpineMobileMenuToggle(html)).toBe(false);
  });
});

describe("shouldInjectStudioAutoMobileNav", () => {
  it("injecteert als het model menuOpen zet maar geen @click op de knop", () => {
    const html = `
      <header x-data="{ menuOpen: false }" class="fixed inset-x-0 top-0 z-50">
        <button type="button" class="md:hidden">Menu</button>
      </header>
      <section>…</section>`;
    expect(shouldInjectStudioAutoMobileNav(html)).toBe(true);
  });

  it("injecteert niet als er een bekabelde Alpine-toggle is (x-data + @click + md:hidden)", () => {
    const html = `
      <header x-data="{ menuOpen: false }" class="fixed top-0 z-50 w-full">
        <button type="button" class="inline-flex md:hidden" @click="menuOpen = !menuOpen" aria-label="Open menu">☰</button>
      </header>`;
    expect(shouldInjectStudioAutoMobileNav(html)).toBe(false);
  });

  it("injecteert niet als x-data op een wrapper vóór de header staat", () => {
    const html = `
      <div x-data="{ navOpen: false }" class="relative">
      <header class="fixed top-0 z-50 w-full">
        <button type="button" class="lg:hidden" @click="navOpen = !navOpen">☰</button>
      </header>
      </div>`;
    expect(shouldInjectStudioAutoMobileNav(html)).toBe(false);
  });

  it("injecteert als er alleen een aria-label-menuknop is zonder Alpine-wiring", () => {
    const html = `
      <header class="fixed top-0 z-50 w-full">
        <button type="button" aria-label="Open menu">☰</button>
      </header>`;
    expect(shouldInjectStudioAutoMobileNav(html)).toBe(true);
  });

  it("injecteert als er alleen een lege mobiel-menu nav is (geen toggle)", () => {
    const html = `
      <header class="fixed top-0 z-50 w-full">
        <nav aria-label="Mobiel menu"></nav>
      </header>`;
    expect(shouldInjectStudioAutoMobileNav(html)).toBe(true);
  });

  it("injecteert nog wel als er geen header en geen patroon is (lege one-pager)", () => {
    expect(shouldInjectStudioAutoMobileNav(`<section><p>Alleen tekst</p></section>`)).toBe(true);
  });
});

describe("buildStudioAutoMobileNavHeaderHtml merk", () => {
  const masterConfig = {
    style: "Dark-first, filmisch en brutaal editorial. Full-bleed hero.",
    theme: { primary: "#0f172a", accent: "#a855f7" },
    font: "Inter, system-ui, sans-serif",
  } satisfies TailwindPageConfig;

  it("zet geen style-briefing in de navbar; wel expliciet navBrandLabel", () => {
    const html = buildStudioAutoMobileNavHeaderHtml([], masterConfig, { navBrandLabel: "Gentrix" });
    expect(html).toContain(">Gentrix<");
    expect(html).not.toContain("Dark-first");
    expect(html).not.toContain("filmisch");
  });

  it("valt terug op korte fallback zonder navBrandLabel (geen style-regel)", () => {
    const html = buildStudioAutoMobileNavHeaderHtml([], masterConfig, null);
    expect(html).toContain(">Website<");
    expect(html).not.toContain("Dark-first");
  });
});

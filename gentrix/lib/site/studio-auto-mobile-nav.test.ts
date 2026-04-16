import { describe, expect, it } from "vitest";
import type { TailwindPageConfig } from "@/lib/ai/tailwind-sections-schema";
import {
  buildStudioAutoMobileNavHeaderHtml,
  extractHeaderNavLinks,
  headerAppearsDesigned,
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

  it("is true bij custom x-data variabele met menuknop en @click", () => {
    const html = `
      <div x-data="{ menuVisible: false }">
        <header class="fixed inset-x-0 top-0 z-50">
          <button type="button" class="md:hidden" @click="menuVisible = !menuVisible" aria-label="Menu">☰</button>
        </header>
      </div>`;
    expect(headerHasWiredAlpineMobileMenuToggle(html)).toBe(true);
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

  it("injecteert niet als er een custom Alpine-togglevariabele is met @click", () => {
    const html = `
      <div x-data="{ menuVisible: false }">
        <header class="fixed inset-x-0 top-0 z-50 w-full">
          <button type="button" class="md:hidden" @click="menuVisible = !menuVisible" aria-label="Menu">☰</button>
        </header>
      </div>`;
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

  it("injecteert niet bij een minimale vaste header met echte links (geen blur nodig)", () => {
    const html = `
<header class="fixed inset-x-0 top-0 z-50 flex justify-between bg-black px-4 py-3 text-white">
  <a href="#top">Logo</a>
  <a href="#wat">Wat wij doen</a>
</header>
<section id="hero">…</section>`;
    expect(headerAppearsDesigned(html)).toBe(true);
    expect(shouldInjectStudioAutoMobileNav(html)).toBe(false);
  });

  it("injecteert niet bij een rijke AI-header zonder mobiele toggle", () => {
    const html = `
<header class="fixed inset-x-0 top-0 z-50 border-b border-white/5 bg-slate-950/70 shadow-lg backdrop-blur-xl">
  <div class="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
    <span class="font-bold text-white">Merk</span>
    <nav class="hidden gap-8 text-sm lg:flex" aria-label="Hoofdmenu">
      <a href="#a">A</a><a href="#b">B</a><a href="#c">C</a>
    </nav>
    <button type="button" class="hidden lg:block" aria-label="Skip">Skip</button>
  </div>
</header>
<section id="hero">…</section>`;
    expect(headerAppearsDesigned(html)).toBe(true);
    expect(shouldInjectStudioAutoMobileNav(html)).toBe(false);
  });

  it("injecteert niet bij een rijke AI-header met gebroken mobiele toggle", () => {
    const html = `
<header class="fixed inset-x-0 top-0 z-50 border-b border-white/5 bg-slate-950/70 shadow-lg backdrop-blur-xl">
  <div class="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
    <span class="font-bold text-white">Merk</span>
    <nav class="hidden gap-8 text-sm lg:flex" aria-label="Hoofdmenu">
      <a href="#a">A</a><a href="#b">B</a><a href="#c">C</a>
    </nav>
    <button type="button" class="lg:hidden" aria-label="Menu">☰</button>
  </div>
</header>
<section id="hero">…</section>`;
    expect(headerAppearsDesigned(html)).toBe(true);
    expect(shouldInjectStudioAutoMobileNav(html)).toBe(false);
  });

  it("injecteert niet als er al een bestaande mobiele sheet in de header zit", () => {
    const html = `
<header class="fixed inset-x-0 top-0 z-50 border-b border-white/5 bg-slate-950/70 shadow-lg backdrop-blur-xl" x-data="{ menuOpen: false }">
  <div class="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
    <span class="font-bold text-white">Merk</span>
    <nav class="hidden gap-8 text-sm lg:flex" aria-label="Hoofdmenu">
      <a href="#a">A</a><a href="#b">B</a><a href="#c">C</a>
    </nav>
    <button type="button" class="lg:hidden" @click="menuOpen = !menuOpen" aria-label="Menu">☰</button>
  </div>
  <div x-show="menuOpen" x-cloak class="fixed inset-x-0 top-16 bg-slate-950 lg:hidden">
    <nav class="flex flex-col gap-2" aria-label="Mobiel menu">
      <a href="#a">A</a>
      <a href="#b">B</a>
      <a href="#c">C</a>
    </nav>
  </div>
</header>
<section id="hero">…</section>`;
    expect(headerAppearsDesigned(html)).toBe(true);
    expect(shouldInjectStudioAutoMobileNav(html)).toBe(false);
  });

  it("injecteert bij vaste header met links als er een losse rechter drawer zonder wiring staat", () => {
    const html = `
<header class="fixed inset-x-0 top-0 z-50 border-b border-white/5 bg-slate-950/70 shadow-lg backdrop-blur-xl">
  <div class="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
    <span class="font-bold text-white">Merk</span>
    <nav class="hidden gap-8 text-sm lg:flex" aria-label="Hoofdmenu">
      <a href="#a">A</a><a href="#b">B</a><a href="#c">C</a>
    </nav>
  </div>
  <div class="fixed top-0 right-0 h-full w-72 bg-[#08081a] z-[70]">
    <nav class="flex flex-col gap-2" aria-label="Mobiel menu">
      <a href="#a">A</a><a href="#b">B</a><a href="#c">C</a>
    </nav>
  </div>
</header>
<section id="hero">…</section>`;
    expect(shouldInjectStudioAutoMobileNav(html)).toBe(true);
  });
});

describe("extractHeaderNavLinks", () => {
  it("haalt nav-links uit het eerste header-nav", () => {
    const html = `
<header>
  <nav aria-label="Hoofdmenu">
    <a href="#diensten">Diensten</a>
    <a href="#faq">FAQ</a>
  </nav>
</header>`;
    expect(extractHeaderNavLinks(html)).toEqual([
      { href: "#diensten", label: "Diensten" },
      { href: "#faq", label: "FAQ" },
    ]);
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

  it("gebruikt bestaande header-links in de mobiele injectie", () => {
    const html = buildStudioAutoMobileNavHeaderHtml(
      [],
      masterConfig,
      { navBrandLabel: "Gentrix" },
      [
        { href: "#diensten", label: "Diensten" },
        { href: "#faq", label: "FAQ" },
      ],
    );
    expect(html).toContain('href="#diensten"');
    expect(html).toContain('Diensten');
    expect(html).toContain('href="#faq"');
    expect(html).toContain('FAQ');
  });
});

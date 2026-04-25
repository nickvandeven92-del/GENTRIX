import { describe, expect, it, vi } from "vitest";
import type { DesignGenerationContract } from "@/lib/ai/design-generation-contract";
import type { MasterPromptPageConfig, TailwindSection } from "@/lib/ai/tailwind-sections-schema";
import { buildTailwindSectionsBodyInnerHtml } from "@/lib/site/tailwind-page-html";
import {
  parseStudioNavChromeConfig,
  prependStudioNavChromeToFirstSection,
  renderStudioNavChromeHtml,
  stripFirstSiteChromeFromSectionHtml,
} from "@/lib/site/render-studio-nav-chrome-html";

const minimalMasterConfig = (
  studioNav?: MasterPromptPageConfig["studioNav"],
  extra?: { studioShellNav?: boolean },
): MasterPromptPageConfig => ({
  style: "Test",
  theme: {
    primary: "#0f172a",
    accent: "#d4a853",
  },
  font: "Inter, system-ui, sans-serif",
  ...(studioNav ? { studioNav } : {}),
  ...(extra?.studioShellNav !== undefined ? { studioShellNav: extra.studioShellNav } : {}),
});

describe("parseStudioNavChromeConfig", () => {
  it("zet brandHref-default bij ontbrekend veld", () => {
    const raw = {
      variant: "bar",
      brandLabel: "GENTRIX",
      items: [{ label: "Home", href: "#top" }],
    };
    const c = parseStudioNavChromeConfig(raw);
    expect(c?.brandHref).toBe("__STUDIO_SITE_BASE__");
  });
});

describe("renderStudioNavChromeHtml", () => {
  it("navChromeTheme.accent overschrijft alleen chrome-accent (niet pagina-theme nodig voor variabele)", () => {
    const html = renderStudioNavChromeHtml(
      {
        variant: "bar",
        brandLabel: "B",
        brandHref: "#top",
        items: [
          { label: "A", href: "#a" },
          { label: "B", href: "#b" },
        ],
        navVisualPreset: "minimalLight",
        navChromeTheme: { accent: "#c026d3" },
      },
      { primary: "#0f172a", accent: "#d4a853" },
    );
    expect(html).toMatch(/--studio-nav-accent:#c026d3/i);
  });

  it("navBarLayout centeredLinks: desktop-linkcluster gecentreerd, CTA rechts, data-attribuut", () => {
    const html = renderStudioNavChromeHtml(
      {
        variant: "bar",
        brandLabel: "Brand",
        brandHref: "#top",
        items: [
          { label: "Diensten", href: "#diensten" },
          { label: "Werk", href: "#werk" },
        ],
        cta: { label: "Contact", href: "#contact" },
        navBarLayout: "centeredLinks",
      },
      { primary: "#0f172a", accent: "#ca8a04" },
    );
    expect(html).toContain('data-studio-nav-bar-layout="centeredLinks"');
    expect(html).toMatch(/flex-1\s+justify-center/);
    expect(html).toContain("Diensten");
    expect(html).toContain("Contact");
  });

  it("rendert data-gentrix-scroll markers zonder @scroll.window", () => {
    const html = renderStudioNavChromeHtml(
      {
        variant: "bar",
        brandLabel: "X",
        brandHref: "#top",
        items: [{ label: "A", href: "#a" }],
        cta: { label: "Contact", href: "#contact" },
      },
      { primary: "#0f172a", accent: "#ca8a04" },
    );
    expect(html).toContain('data-studio-nav-chrome="1"');
    expect(html).toContain('data-gentrix-scroll-nav="1"');
    expect(html).toContain("gentrix-menu-icon");
    expect(html).toContain("studio-nav-chrome-menu-btn");
    expect(html).toContain("fixed top-0");
    expect(html).toContain("studio-nav-chrome-spacer");
    expect(html).toContain("@click.outside");
    expect(html).toContain("x-transition:enter-start");
    expect(html).not.toContain("@scroll.window");
    expect(html).not.toContain("backdrop-blur-md");
    expect(html).toMatch(/style="[^"]*--studio-nav-accent:#ca8a04/);
  });

  it("luxuryGold preset: solide CTA + preset data-attribuut", () => {
    const html = renderStudioNavChromeHtml(
      {
        variant: "bar",
        navVisualPreset: "luxuryGold",
        brandLabel: "X",
        brandHref: "#top",
        items: [{ label: "A", href: "#a" }],
        cta: { label: "Contact", href: "#contact" },
      },
      { primary: "#0f172a", accent: "#ca8a04" },
    );
    expect(html).toContain('data-studio-nav-preset="luxuryGold"');
    expect(html).toContain("border-[color:var(--studio-nav-accent)]");
    expect(html).toMatch(/border-bottom:2px solid #ca8a04/i);
    expect(html).toMatch(/background:rgba\(15,\s*23,\s*42/i);
  });
});

describe("prependStudioNavChromeToFirstSection", () => {
  it("verwijdert bestaande AI-header en plakt declaratieve nav voor de rest", () => {
    const sections: TailwindSection[] = [
      {
        sectionName: "hero",
        html: `<header class="sticky top-0 z-50 bg-black text-white"><nav><a href="#x">Old</a></nav></header><div class="hero">H</div>`,
      },
    ];
    const nav = renderStudioNavChromeHtml({
      variant: "pill",
      brandLabel: "NEW",
      items: [{ label: "Wat wij doen", href: "#diensten" }],
    });
    const out = prependStudioNavChromeToFirstSection(sections, nav);
    expect(out[0]!.html).toContain("NEW");
    expect(out[0]!.html).not.toContain(">Old<");
    expect(stripFirstSiteChromeFromSectionHtml(out[0]!.html)).not.toContain("NEW");
  });
});

describe("buildTailwindSectionsBodyInnerHtml + studioNav", () => {
  it("neemt declaratieve nav op in body wanneer config.studioNav gezet is", () => {
    const pageConfig = minimalMasterConfig({
      variant: "bar",
      brandLabel: "GENTRIX",
      items: [{ label: "Home", href: "#top" }],
    });
    const sections: TailwindSection[] = [
      {
        sectionName: "hero",
        html: `<header class="sticky top-0 z-50"><span>AI</span></header><main id="hero">Body</main>`,
      },
    ];
    const body = buildTailwindSectionsBodyInnerHtml(sections, pageConfig, {});
    expect(body).toContain("GENTRIX");
    expect(body).not.toContain(">AI<");
    expect(body).toContain("Body");
    expect(body).toContain('data-section="hero"');
  });

  it("designContract glass_blur → glass nav host (backdrop blur)", () => {
    const pageConfig = minimalMasterConfig({
      variant: "bar",
      brandLabel: "Brand",
      brandHref: "#top",
      items: [{ label: "Home", href: "#top" }],
      cta: { label: "Contact", href: "#contact" },
    });
    const sections: TailwindSection[] = [
      { sectionName: "hero", html: `<main id="hero"><p>Body</p></main>` },
    ];
    const dc = {
      heroVisualSubject: "Product UI with frosted panels and depth",
      paletteMode: "light",
      imageryMustReflect: ["clarity"],
      motionLevel: "subtle",
      referenceVisualAxes: {
        layoutRhythm: "balanced",
        themeMode: "light",
        paletteIntent: "Light neutral surfaces with soft separation",
        typographyDirection: "sans_modern",
        heroComposition: "Centered product mockup with headline",
        sectionDensity: "medium",
        motionStyle: "static_minimal",
        borderTreatment: "none_minimal",
        cardStyle: "glass_blur",
      },
    } as DesignGenerationContract;
    const body = buildTailwindSectionsBodyInnerHtml(sections, pageConfig, { designContract: dc });
    expect(body).toContain("backdrop-filter:blur");
  });

  it("designContract editorial_mosaic → transparent bar background", () => {
    const pageConfig = minimalMasterConfig({
      variant: "bar",
      brandLabel: "Studio",
      brandHref: "#top",
      items: [{ label: "Werk", href: "#werk" }],
    });
    const sections: TailwindSection[] = [
      { sectionName: "hero", html: `<main id="hero"><p>Inhoud</p></main>` },
    ];
    const dc = {
      heroVisualSubject: "Editorial layout for an independent magazine",
      paletteMode: "light",
      imageryMustReflect: ["editorial"],
      motionLevel: "subtle",
      referenceVisualAxes: {
        layoutRhythm: "editorial_mosaic",
        themeMode: "light",
        paletteIntent: "Paper white with ink contrast and thin rules",
        typographyDirection: "serif_editorial",
        heroComposition: "Full-bleed image with overlaid headline",
        sectionDensity: "sparse",
        motionStyle: "static_minimal",
        borderTreatment: "none_minimal",
        cardStyle: "flat",
      },
    } as DesignGenerationContract;
    const body = buildTailwindSectionsBodyInnerHtml(sections, pageConfig, { designContract: dc });
    expect(body).toMatch(/background:\s*transparent/i);
  });

  it("designContract luxury tone → outline CTA + donkere shell (luxuryGold)", () => {
    const pageConfig = minimalMasterConfig({
      variant: "bar",
      brandLabel: "Maison",
      brandHref: "#top",
      items: [{ label: "Collectie", href: "#collectie" }],
      cta: { label: "Afspraak", href: "#contact" },
    });
    const sections: TailwindSection[] = [
      { sectionName: "hero", html: `<main id="hero"><p>Welkom</p></main>` },
    ];
    const dc = {
      heroVisualSubject: "Boutique hospitality brand with premium positioning",
      paletteMode: "light",
      imageryMustReflect: ["warmth"],
      motionLevel: "subtle",
      toneSummary: "Luxury boutique hotel with understated premium cues",
    } as DesignGenerationContract;
    const body = buildTailwindSectionsBodyInnerHtml(sections, pageConfig, { designContract: dc });
    expect(body).toContain("rgba(15,23,42,0.9)");
    expect(body).toMatch(/border border-\[color:var\(--studio-nav-accent\)\]/);
  });

  it("studioShellNav: zonder geldige studioNav → throw (server policy)", () => {
    const pageConfig = minimalMasterConfig(undefined, { studioShellNav: true });
    expect(() =>
      buildTailwindSectionsBodyInnerHtml(
        [{ sectionName: "hero", html: `<main id="hero">OK</main>` }],
        pageConfig,
        {},
      ),
    ).toThrow(/studioShellNav is true but config\.studioNav is missing or invalid/i);
  });

  it("studioShellNav + studioNav + AI-header: één shell-nav, AI-chrome gestript, waarschuwing", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const pageConfig = minimalMasterConfig(
      {
        variant: "bar",
        brandLabel: "ShellBrand",
        brandHref: "#top",
        items: [{ label: "Home", href: "#top" }],
      },
      { studioShellNav: true },
    );
    const sections: TailwindSection[] = [
      {
        sectionName: "hero",
        html: `<header class="sticky top-0 z-50 bg-black text-white"><nav><a href="#x">AI</a></nav></header><main id="hero">Body</main>`,
      },
    ];
    const body = buildTailwindSectionsBodyInnerHtml(sections, pageConfig, {});

    const chromeCount = (body.match(/data-studio-nav-chrome="1"/g) ?? []).length;
    expect(chromeCount).toBe(1);
    expect(body).toContain("ShellBrand");
    expect(body).not.toContain(">AI<");
    expect(body).toContain("Body");
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("studioShellNav uit: studioNav ontbreekt maar AI-header → infer vult nav (legacy)", () => {
    const pageConfig = minimalMasterConfig(undefined);
    const sections: TailwindSection[] = [
      {
        sectionName: "hero",
        html: `<header class="sticky top-0"><a href="#top">Home</a><a href="#diensten">Diensten</a></header><main id="hero">X</main>`,
      },
    ];
    const body = buildTailwindSectionsBodyInnerHtml(sections, pageConfig, {});
    expect(body).toContain("Diensten");
    expect((body.match(/data-studio-nav-chrome="1"/g) ?? []).length).toBe(1);
  });
});

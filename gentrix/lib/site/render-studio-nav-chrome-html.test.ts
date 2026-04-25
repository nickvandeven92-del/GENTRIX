import { describe, expect, it } from "vitest";
import type { MasterPromptPageConfig, TailwindSection } from "@/lib/ai/tailwind-sections-schema";
import { buildTailwindSectionsBodyInnerHtml } from "@/lib/site/tailwind-page-html";
import {
  parseStudioNavChromeConfig,
  prependStudioNavChromeToFirstSection,
  renderStudioNavChromeHtml,
  stripFirstSiteChromeFromSectionHtml,
} from "@/lib/site/render-studio-nav-chrome-html";

const minimalMasterConfig = (studioNav: MasterPromptPageConfig["studioNav"]): MasterPromptPageConfig => ({
  style: "Test",
  theme: {
    primary: "#0f172a",
    accent: "#d4a853",
  },
  font: "Inter, system-ui, sans-serif",
  ...(studioNav ? { studioNav } : {}),
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
    expect(html).toContain("fixed top-0");
    expect(html).toContain("studio-nav-chrome-spacer");
    expect(html).toContain("@click.outside");
    expect(html).toContain("x-transition:enter-start");
    expect(html).not.toContain("@scroll.window");
    expect(html).not.toContain("backdrop-blur-md");
    expect(html).toMatch(/style="[^"]*--studio-nav-accent:#ca8a04/);
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
});

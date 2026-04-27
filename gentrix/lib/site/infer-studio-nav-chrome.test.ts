import { describe, expect, it } from "vitest";
import type { MasterPromptPageConfig, TailwindSection } from "@/lib/ai/tailwind-sections-schema";
import { buildTailwindSectionsBodyInnerHtml } from "@/lib/site/tailwind-page-html";
import { inferStudioNavChromeFromSections } from "@/lib/site/infer-studio-nav-chrome";

const masterCfg = (studioNav?: MasterPromptPageConfig["studioNav"]): MasterPromptPageConfig => ({
  style: "S",
  theme: { primary: "#111", accent: "#d4a853" },
  font: "Inter, system-ui, sans-serif",
  ...(studioNav !== undefined ? { studioNav } : {}),
});

describe("inferStudioNavChromeFromSections", () => {
  it("leest merk + items + CTA uit bestaande header", () => {
    const html = `<header class="sticky top-0 z-50 rounded-full bg-black/50">
  <a href="__STUDIO_SITE_BASE__">GENTRIX</a>
  <a href="__STUDIO_SITE_BASE__/diensten">Wat wij doen</a>
  <a href="__STUDIO_SITE_BASE__/contact">Contact</a>
</header><div>hero</div>`;
    const sections: TailwindSection[] = [{ sectionName: "hero", html }];
    const cfg = inferStudioNavChromeFromSections(sections);
    expect(cfg?.brandLabel).toBe("GENTRIX");
    expect(cfg?.variant).toBe("pill");
    expect(cfg?.navVisualPreset).toBe("floatingPill");
    expect(cfg?.items.map((x) => x.label)).toEqual(["Wat wij doen"]);
    expect(cfg?.cta?.label).toBe("Contact");
  });

  it("retourneert null zonder bruikbare chrome", () => {
    expect(inferStudioNavChromeFromSections([{ sectionName: "hero", html: "<div>only</div>" }])).toBeNull();
  });

  it("zet linksRightInHero bij bar + donkere hero (tekst wit / id hero)", () => {
    const html = `<header class="sticky top-0 z-50 bg-white/90 border-b">
  <a href="__STUDIO_SITE_BASE__">GENTRIX</a>
  <a href="#diensten">Wat wij doen</a>
  <a href="#contact">Contact</a>
</header>
<section id="hero" class="relative min-h-screen bg-zinc-950 text-white"><p>Hero</p></section>`;
    const sections: TailwindSection[] = [{ sectionName: "Hero", html }];
    const cfg = inferStudioNavChromeFromSections(sections);
    expect(cfg?.variant).toBe("bar");
    expect(cfg?.navBarLayout).toBe("linksRightInHero");
  });

  it("herkent zwevende shell met rounded-2xl + shadow zonder rounded-full", () => {
    const html = `<header class="fixed top-4 left-1/2 z-50 flex w-full max-w-5xl -translate-x-1/2 rounded-2xl bg-slate-900/80 px-4 py-3 shadow-xl ring-1 ring-white/10">
  <a href="__STUDIO_SITE_BASE__">WW83</a>
  <a href="__STUDIO_SITE_BASE__/diensten">Diensten</a>
  <a href="#contact">Contact</a>
</header>`;
    const sections: TailwindSection[] = [{ sectionName: "hero", html }];
    const cfg = inferStudioNavChromeFromSections(sections);
    expect(cfg?.variant).toBe("pill");
    expect(cfg?.navVisualPreset).toBe("floatingPill");
  });

  it("volle-breedte sticky bar met rounded-full alleen op CTA-knop blijft variant bar", () => {
    const html = `<header class="sticky top-0 z-50 w-full border-b border-zinc-200 bg-white/95 backdrop-blur">
  <a href="__STUDIO_SITE_BASE__">GENTRIX</a>
  <a href="#diensten">Wat wij doen</a>
  <a href="#contact" class="rounded-full bg-zinc-900 px-5 py-2 text-sm text-white">Contact</a>
</header>`;
    const sections: TailwindSection[] = [{ sectionName: "hero", html }];
    const cfg = inferStudioNavChromeFromSections(sections);
    expect(cfg?.variant).toBe("bar");
    expect(cfg?.navVisualPreset).toBe("minimalLight");
  });
});

describe("buildTailwindSectionsBodyInnerHtml auto-infer", () => {
  it("vervangt AI-chrome zonder config.studioNav (alleen master-config)", () => {
    const pageConfig = masterCfg();
    const sections: TailwindSection[] = [
      {
        sectionName: "hero",
        html: `<header class="sticky top-0 z-50"><a href="__STUDIO_SITE_BASE__">Co</a><a href="#x">Eén</a><a href="#y">Twee</a></header><p>Hero</p>`,
      },
    ];
    const body = buildTailwindSectionsBodyInnerHtml(sections, pageConfig, {});
    expect(body).toContain("gentrix-menu-icon");
    expect(body).toContain("Hero");
    expect((body.match(/<header\b/gi) ?? []).length).toBe(1);
    expect(body).not.toContain('href="#">Old');
  });

  it("gebruikt expliciete studioNav wanneer gezet", () => {
    const pageConfig = masterCfg({
      variant: "bar",
      brandLabel: "FIXED",
      items: [{ label: "A", href: "#a" }],
    });
    const sections: TailwindSection[] = [
      {
        sectionName: "hero",
        html: `<header class="sticky top-0"><a href="#">Old</a></header><p>X</p>`,
      },
    ];
    const body = buildTailwindSectionsBodyInnerHtml(sections, pageConfig, {});
    expect(body).toContain("FIXED");
    expect(body).not.toContain("Old");
  });
});

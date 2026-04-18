import { describe, expect, it } from "vitest";
import type { TailwindSection } from "@/lib/ai/tailwind-sections-schema";
import {
  shouldIncludeCompactLandingFaq,
  buildCompactLandingSectionIds,
  combinedIndustryProbeText,
} from "@/lib/ai/generate-site-with-claude";
import { validateStrictLandingPageContract } from "@/lib/ai/validate-strict-landing-page";

function sec(id: string, html: string): TailwindSection {
  return { id, sectionName: id, html };
}

describe("shouldIncludeCompactLandingFaq / buildCompactLandingSectionIds", () => {
  it("compacte landing heeft geen faq-sectie op sections (FAQ via marketingPages)", () => {
    expect(shouldIncludeCompactLandingFaq("")).toBe(false);
    expect(buildCompactLandingSectionIds("").join(",")).toBe("hero,stats,features,footer");

    expect(buildCompactLandingSectionIds("Website voor onze salon in Groningen").join(",")).toBe(
      "hero,features,footer",
    );

    expect(shouldIncludeCompactLandingFaq("Veelgestelde vragen over onze diensten")).toBe(true);
    expect(buildCompactLandingSectionIds("Veelgestelde vragen over onze diensten").join(",")).not.toContain("faq");
    expect(buildCompactLandingSectionIds("Veelgestelde vragen over onze diensten").join(",")).toBe(
      "hero,stats,features,footer",
    );

    const barberProbe = combinedIndustryProbeText("Herenkapster De Snijder", "");
    expect(shouldIncludeCompactLandingFaq(barberProbe)).toBe(true);
    expect(buildCompactLandingSectionIds(barberProbe).join(",")).toBe("hero,stats,features,footer");
  });

  it("kappers/branches: geen steps op de landing", () => {
    expect(buildCompactLandingSectionIds("Barbershop fade en baard Vught werkwijze in stappen").join(",")).toBe(
      "hero,stats,features,footer",
    );
  });

  it("5 secties: werkwijze-signalen en geen kappersprofiel → features + steps gescheiden", () => {
    const d =
      "Digitaal bureau voor MKB. Onze werkwijze: intake, ontwerp en oplevering in duidelijke stappen. We werken met vaste partners en KPI-dashboards.";
    expect(buildCompactLandingSectionIds(d).join(",")).toBe("hero,brands,features,steps,footer");
  });
});

describe("validateStrictLandingPageContract", () => {
  it("accepteert een geldige 3-sectie ultra-compacte opzet", () => {
    const sections = [
      sec("hero", '<section id="hero"></section>'),
      sec("features", '<section id="features"></section>'),
      sec("footer", '<section id="footer"></section>'),
    ];
    expect(validateStrictLandingPageContract(sections)).toEqual([]);
  });

  it("accepteert een geldige 4-sectie-opzet zonder faq", () => {
    const sections = [
      sec("hero", '<section id="hero"><a class="rounded-full bg-white">A</a></section>'),
      sec("stats", '<section id="stats"></section>'),
      sec("features", '<section id="features"></section>'),
      sec("footer", '<section id="footer"></section>'),
    ];
    expect(validateStrictLandingPageContract(sections)).toEqual([]);
  });

  it("accepteert een geldige 5-sectie-opzet (proof + features + steps)", () => {
    const sections = [
      sec("hero", '<section id="hero"></section>'),
      sec("stats", '<section id="stats"></section>'),
      sec("features", '<section id="features"></section>'),
      sec("steps", '<section id="steps"></section>'),
      sec("footer", '<section id="footer"></section>'),
    ];
    expect(validateStrictLandingPageContract(sections)).toEqual([]);
  });

  it("wijst 6 secties af", () => {
    const sections = [
      sec("hero", "<section></section>"),
      sec("stats", "<section></section>"),
      sec("features", "<section></section>"),
      sec("steps", "<section></section>"),
      sec("faq", "<section></section>"),
      sec("footer", "<section></section>"),
    ];
    expect(validateStrictLandingPageContract(sections).length).toBeGreaterThan(0);
  });

  it("wijst stats én brands af", () => {
    const sections = [
      sec("hero", "<section></section>"),
      sec("stats", "<section></section>"),
      sec("brands", "<section></section>"),
      sec("footer", "<section></section>"),
    ];
    expect(validateStrictLandingPageContract(sections).some((e) => /stats|brands|bewijs/i.test(e))).toBe(true);
  });

  it("wijst marquee af", () => {
    const sections = [
      sec("hero", '<section id="hero"></section>'),
      sec("stats", "<section></section>"),
      sec("features", "<section></section>"),
      sec("footer", '<section id="footer"><div class="studio-marquee-track"></div></footer>'),
    ];
    expect(validateStrictLandingPageContract(sections).some((e) => /marquee|ticker/i.test(e))).toBe(true);
  });

  it("wijst faq op landing af", () => {
    const sections = [
      sec("hero", "<section></section>"),
      sec("stats", "<section></section>"),
      sec("features", "<section></section>"),
      sec("faq", "<section></section>"),
    ];
    expect(validateStrictLandingPageContract(sections).some((e) => /faq|Verboden|footer|3|4|5/i.test(e))).toBe(
      true,
    );
  });
});

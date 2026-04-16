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
  it("zet faq bij FAQ-trefwoorden, bij branche-met-faq-in-sections, of bij compactLandingDefaultFaq-profielen", () => {
    expect(shouldIncludeCompactLandingFaq("")).toBe(false);
    expect(buildCompactLandingSectionIds("").join(",")).toBe("hero,stats,features,footer");

    expect(shouldIncludeCompactLandingFaq("Veelgestelde vragen over onze diensten")).toBe(true);
    expect(buildCompactLandingSectionIds("Veelgestelde vragen over onze diensten").join(",")).toContain("faq");

    const barberProbe = combinedIndustryProbeText("Herenkapster De Snijder", "");
    expect(shouldIncludeCompactLandingFaq(barberProbe)).toBe(true);
    expect(buildCompactLandingSectionIds(barberProbe).join(",")).toContain("faq");
  });
});

describe("validateStrictLandingPageContract", () => {
  it("accepteert een geldige 5-sectie-opzet met faq", () => {
    const sections = [
      sec("hero", '<section id="hero"><a class="rounded-full bg-white">A</a></section>'),
      sec("stats", '<section id="stats"></section>'),
      sec("features", '<section id="features"></section>'),
      sec("faq", '<section id="faq"><details></details>'.repeat(6) + "</section>"),
      sec("footer", '<section id="footer"></section>'),
    ];
    expect(validateStrictLandingPageContract(sections)).toEqual([]);
  });

  it("accepteert een geldige 4-sectie-opzet zonder faq", () => {
    const sections = [
      sec("hero", "<section></section>"),
      sec("stats", "<section></section>"),
      sec("features", "<section></section>"),
      sec("footer", "<section></section>"),
    ];
    expect(validateStrictLandingPageContract(sections)).toEqual([]);
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
      sec("footer", '<section id="footer"><div class="studio-marquee-track"></div></section>'),
    ];
    expect(validateStrictLandingPageContract(sections).some((e) => /marquee|ticker/i.test(e))).toBe(true);
  });

  it("wijst meer dan 6 FAQ-items af", () => {
    const sections = [
      sec("hero", "<section></section>"),
      sec("stats", "<section></section>"),
      sec("features", "<section></section>"),
      sec("faq", `<section id="faq">${"<details></details>".repeat(7)}</section>`),
      sec("footer", "<section></section>"),
    ];
    expect(validateStrictLandingPageContract(sections).some((e) => /FAQ|6/i.test(e))).toBe(true);
  });

  it("wijst faq af bij precies 4 secties", () => {
    const sections = [
      sec("hero", "<section></section>"),
      sec("stats", "<section></section>"),
      sec("features", "<section></section>"),
      sec("faq", "<section></section>"),
    ];
    expect(validateStrictLandingPageContract(sections).some((e) => /footer|4/i.test(e))).toBe(true);
  });
});

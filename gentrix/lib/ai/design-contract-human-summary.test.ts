import { describe, expect, it } from "vitest";
import { formatDesignContractHumanSummaryNl } from "@/lib/ai/design-contract-human-summary";
import type { DesignGenerationContract } from "@/lib/ai/design-generation-contract";

const baseContract: DesignGenerationContract = {
  heroVisualSubject: "Een rustige hero met natuurlijk licht op het product.",
  paletteMode: "light",
  imageryMustReflect: ["natuurlijk licht"],
  imageryAvoid: [],
  motionLevel: "subtle",
};

describe("formatDesignContractHumanSummaryNl", () => {
  it("bevat palet, motion en hero", () => {
    const s = formatDesignContractHumanSummaryNl(baseContract);
    expect(s).toContain("licht hoofdthema");
    expect(s).toContain("subtiele motion");
    expect(s).toContain("Hero-focus:");
  });

  it("voegt site-signatuur en referentie-assen toe wanneer aanwezig", () => {
    const c: DesignGenerationContract = {
      ...baseContract,
      siteSignature: {
        archetype: "editorial_typography",
        commitment_nl:
          "Koppen en witruimte leiden; weinig chrome; rustige hiërarchie passend bij de branche.",
        anti_templates_nl: ["Geen standaard 3×2 USP-raster als hoofdstructuur"],
      },
      referenceVisualAxes: {
        layoutRhythm: "airy",
        themeMode: "light",
        paletteIntent: "Warm zand met diep groen accent.",
        typographyDirection: "serif_editorial",
        heroComposition: "Gecentreerde statement boven full-bleed beeld.",
        sectionDensity: "sparse",
        motionStyle: "scroll_reveal",
        borderTreatment: "accent_lines",
        cardStyle: "flat",
      },
    };
    const s = formatDesignContractHumanSummaryNl(c);
    expect(s).toContain("Editorial typografie");
    expect(s).toContain("Referentie vertaald");
    expect(s).toContain("Kleurintentie:");
  });

  it("respecteert maxChars", () => {
    const long = formatDesignContractHumanSummaryNl(baseContract);
    const short = formatDesignContractHumanSummaryNl(baseContract, { maxChars: 80 });
    expect(short.length).toBeLessThanOrEqual(85);
    expect(long.length).toBeGreaterThan(short.length);
  });
});

import { describe, expect, it } from "vitest";
import {
  buildDesignContractPromptInjection,
  clampUnknownContractForSchemaParse,
  designGenerationContractSchema,
  parseDesignContractFromStoredJson,
} from "@/lib/ai/design-generation-contract";

const sampleAxes = {
  layoutRhythm: "balanced" as const,
  themeMode: "dark" as const,
  paletteIntent: "Diep navy met teal accent en hoog contrast op bodytekst.",
  typographyDirection: "sans_modern" as const,
  heroComposition: "Split: links copy + CTA, rechts full-bleed visueel met overlay-gradient.",
  sectionDensity: "medium" as const,
  motionStyle: "scroll_reveal" as const,
  borderTreatment: "border_reveal_forward" as const,
  cardStyle: "soft_shadow" as const,
};

const sampleSiteSignature = {
  archetype: "minimal_luxury_sparse" as const,
  commitment_nl:
    "Rustige luxe met veel witruimte en één sterk visueel anker in de hero; geen drukke marketing-stack of tegelmuur.",
  anti_templates_nl: [
    "Geen identieke 3-koloms USP-kaarten achter elkaar op de hele pagina",
    "Geen standaard SaaS-blauwe gradient op wit als dominante achtergrond",
  ],
};

describe("designGenerationContractSchema", () => {
  it("accepteert contract met referenceVisualAxes", () => {
    const raw = {
      heroVisualSubject: "Hero met waterbeeld.",
      paletteMode: "dark",
      imageryMustReflect: ["water"],
      motionLevel: "moderate",
      siteSignature: sampleSiteSignature,
      referenceVisualAxes: sampleAxes,
    };
    const r = designGenerationContractSchema.safeParse(raw);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.referenceVisualAxes?.layoutRhythm).toBe("balanced");
      expect(r.data.referenceVisualAxes?.paletteIntent).toContain("navy");
    }
  });

  it("mapt legacy motionStyle marquee_forward naar scroll_reveal", () => {
    const raw = {
      heroVisualSubject: "12345678",
      paletteMode: "dark" as const,
      imageryMustReflect: ["x"],
      motionLevel: "moderate" as const,
      siteSignature: sampleSiteSignature,
      referenceVisualAxes: { ...sampleAxes, motionStyle: "marquee_forward" as const },
    };
    const r = designGenerationContractSchema.safeParse(raw);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.referenceVisualAxes?.motionStyle).toBe("scroll_reveal");
    }
  });

  it("normaliseert heroImageSearchHints van array naar string", () => {
    const raw = {
      heroVisualSubject: "Hero met kappersstoelen en spiegelwand.",
      heroImageSearchHints: ["barbershop interior", "vintage chairs", "tile floor"],
      paletteMode: "dark" as const,
      imageryMustReflect: ["barbershop"],
      motionLevel: "subtle" as const,
      siteSignature: sampleSiteSignature,
    };
    const r = designGenerationContractSchema.safeParse(raw);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.heroImageSearchHints).toBe(
        "barbershop interior; vintage chairs; tile floor",
      );
    }
  });

  it("accepteert een minimaal geldig contract", () => {
    const raw = {
      heroVisualSubject: "Hengelsport aan het water met actiebeeld van werphengel.",
      paletteMode: "dark",
      imageryMustReflect: ["hengelsport", "water", "visuitrusting"],
      imageryAvoid: ["generiek kantoor", "losse plant macro zonder context"],
      motionLevel: "moderate",
      toneSummary: "Warm en vakbekwaam.",
      siteSignature: sampleSiteSignature,
    };
    const r = designGenerationContractSchema.safeParse(raw);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.motionLevel).toBe("moderate");
      expect(r.data.imageryAvoid.length).toBe(2);
    }
  });

  it("krimpt te lange siteSignature.commitment_nl via clamp vóór validatie", () => {
    const longCommit = "x".repeat(500);
    const raw = {
      heroVisualSubject: "Hengelsport aan het water met actiebeeld van werphengel.",
      paletteMode: "dark",
      imageryMustReflect: ["hengelsport", "water", "visuitrusting"],
      motionLevel: "moderate" as const,
      siteSignature: {
        ...sampleSiteSignature,
        commitment_nl: longCommit,
      },
    };
    const r = designGenerationContractSchema.safeParse(clampUnknownContractForSchemaParse(raw));
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.siteSignature?.commitment_nl.length).toBeLessThanOrEqual(420);
      expect(r.data.siteSignature?.commitment_nl.length).toBeGreaterThanOrEqual(28);
    }
  });

  it("accepteert contract zonder siteSignature (legacy)", () => {
    const raw = {
      heroVisualSubject: "Minimaal onderwerp voor contract.",
      paletteMode: "light" as const,
      imageryMustReflect: ["test"],
      motionLevel: "none" as const,
    };
    const r = designGenerationContractSchema.safeParse(raw);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.siteSignature).toBeUndefined();
    }
  });

  it("normaliseert imageryMustReflect en imageryAvoid van CSV-string naar array", () => {
    const raw = {
      heroVisualSubject: "Hero met werkplaats en gereedschap op de voorgrond.",
      paletteMode: "light" as const,
      imageryMustReflect: "werkplaats, vakmanschap; gereedschap",
      imageryAvoid: "stock kantoor, generieke handdruk",
      motionLevel: "subtle" as const,
      siteSignature: sampleSiteSignature,
    };
    const r = designGenerationContractSchema.safeParse(raw);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.imageryMustReflect).toEqual(["werkplaats", "vakmanschap", "gereedschap"]);
      expect(r.data.imageryAvoid).toEqual(["stock kantoor", "generieke handdruk"]);
    }
  });

  it("normaliseert paletteMode-synoniemen (bv. mixed → either, warm → light)", () => {
    const mixed = designGenerationContractSchema.safeParse({
      heroVisualSubject: "12345678",
      paletteMode: "MIXED",
      imageryMustReflect: ["x"],
      motionLevel: "moderate",
      siteSignature: sampleSiteSignature,
    });
    expect(mixed.success).toBe(true);
    if (mixed.success) expect(mixed.data.paletteMode).toBe("either");

    const warm = designGenerationContractSchema.safeParse({
      heroVisualSubject: "12345678",
      paletteMode: "warm",
      imageryMustReflect: ["x"],
      motionLevel: "moderate",
      siteSignature: sampleSiteSignature,
    });
    expect(warm.success).toBe(true);
    if (warm.success) expect(warm.data.paletteMode).toBe("light");
  });

  it("normaliseert motionLevel-synoniemen (bv. high → strong)", () => {
    const raw = {
      heroVisualSubject: "12345678",
      paletteMode: "either" as const,
      imageryMustReflect: ["zwemparadijs"],
      motionLevel: "HIGH",
      siteSignature: sampleSiteSignature,
    };
    const r = designGenerationContractSchema.safeParse(raw);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.motionLevel).toBe("strong");
    }
  });

  it("coëert getal naar imagery-strings (model levert soms JSON-number)", () => {
    const raw = {
      heroVisualSubject: "12345678",
      paletteMode: "either" as const,
      imageryMustReflect: 42,
      motionLevel: "none" as const,
      siteSignature: sampleSiteSignature,
    };
    const r = designGenerationContractSchema.safeParse(raw);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.imageryMustReflect).toEqual(["42"]);
    }
  });
});

describe("buildDesignContractPromptInjection", () => {
  it("bevat hero- en motiontekst", () => {
    const c = designGenerationContractSchema.parse({
      heroVisualSubject: "Test hero",
      paletteMode: "either",
      imageryMustReflect: ["a", "b"],
      motionLevel: "subtle",
      siteSignature: sampleSiteSignature,
    });
    const block = buildDesignContractPromptInjection(c);
    expect(block).toContain("Test hero");
    expect(block).toContain("Subtiele motion");
    const withRef = buildDesignContractPromptInjection(c, { url: "https://example.com/ref" });
    expect(withRef).toContain("https://example.com/ref");
  });

  it("bevat harde beeld- en zelfcontrole-regels", () => {
    const c = designGenerationContractSchema.parse({
      heroVisualSubject: "Pretpark-actie",
      paletteMode: "dark",
      imageryMustReflect: ["achtbaan", "publiek"],
      motionLevel: "strong",
      siteSignature: sampleSiteSignature,
    });
    const block = buildDesignContractPromptInjection(c);
    expect(block).toContain("ZELFCONTROLE");
    expect(block).toContain("BEELDEN");
    expect(block).toContain("lege belofte");
    expect(block).not.toContain("studio-marquee");
  });

  it("voegt SITE-SIGNATURE toe wanneer siteSignature gezet is", () => {
    const c = designGenerationContractSchema.parse({
      heroVisualSubject: "Test hero",
      paletteMode: "light",
      imageryMustReflect: ["x"],
      motionLevel: "subtle",
      siteSignature: sampleSiteSignature,
    });
    const block = buildDesignContractPromptInjection(c);
    expect(block).toContain("SITE-SIGNATURE");
    expect(block).toContain("minimal_luxury_sparse");
    expect(block).toContain(sampleSiteSignature.commitment_nl.slice(0, 40));
  });

  it("voegt assen- en rolverdeling toe wanneer referenceVisualAxes gezet is", () => {
    const c = designGenerationContractSchema.parse({
      heroVisualSubject: "Test hero",
      paletteMode: "light",
      imageryMustReflect: ["x"],
      motionLevel: "subtle",
      siteSignature: sampleSiteSignature,
      referenceVisualAxes: sampleAxes,
    });
    const block = buildDesignContractPromptInjection(c, { url: "https://ref.example/" });
    expect(block).toContain("ROLVERDELING");
    expect(block).toContain("REFERENCE VISUAL AXES");
    expect(block).toContain("layoutRhythm");
    expect(block).toContain("https://ref.example/");
  });
});

describe("parseDesignContractFromStoredJson", () => {
  it("retourneert null voor null/undefined", () => {
    expect(parseDesignContractFromStoredJson(null)).toBeNull();
    expect(parseDesignContractFromStoredJson(undefined)).toBeNull();
  });

  it("parset geldige JSON naar contract", () => {
    const raw = {
      heroVisualSubject: "Valid hero subject line here",
      paletteMode: "light",
      imageryMustReflect: ["trust"],
      motionLevel: "subtle",
    };
    const c = parseDesignContractFromStoredJson(raw);
    expect(c).not.toBeNull();
    expect(c?.paletteMode).toBe("light");
  });

  it("retourneert null bij ongeldige payload", () => {
    expect(parseDesignContractFromStoredJson({ not: "a contract" })).toBeNull();
  });
});

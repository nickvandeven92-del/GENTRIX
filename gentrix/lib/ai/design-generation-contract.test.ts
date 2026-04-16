import { describe, expect, it } from "vitest";
import {
  buildDesignContractPromptInjection,
  designGenerationContractSchema,
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

describe("designGenerationContractSchema", () => {
  it("accepteert contract met referenceVisualAxes", () => {
    const raw = {
      heroVisualSubject: "Hero met waterbeeld.",
      paletteMode: "dark",
      imageryMustReflect: ["water"],
      motionLevel: "moderate",
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
    };
    const r = designGenerationContractSchema.safeParse(raw);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.motionLevel).toBe("moderate");
      expect(r.data.imageryAvoid.length).toBe(2);
    }
  });

  it("normaliseert imageryMustReflect en imageryAvoid van CSV-string naar array", () => {
    const raw = {
      heroVisualSubject: "Hero met werkplaats en gereedschap op de voorgrond.",
      paletteMode: "light" as const,
      imageryMustReflect: "werkplaats, vakmanschap; gereedschap",
      imageryAvoid: "stock kantoor, generieke handdruk",
      motionLevel: "subtle" as const,
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
    });
    expect(mixed.success).toBe(true);
    if (mixed.success) expect(mixed.data.paletteMode).toBe("either");

    const warm = designGenerationContractSchema.safeParse({
      heroVisualSubject: "12345678",
      paletteMode: "warm",
      imageryMustReflect: ["x"],
      motionLevel: "moderate",
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
    });
    const block = buildDesignContractPromptInjection(c);
    expect(block).toContain("ZELFCONTROLE");
    expect(block).toContain("BEELDEN");
    expect(block).toContain("lege belofte");
    expect(block).not.toContain("studio-marquee");
  });

  it("voegt assen- en rolverdeling toe wanneer referenceVisualAxes gezet is", () => {
    const c = designGenerationContractSchema.parse({
      heroVisualSubject: "Test hero",
      paletteMode: "light",
      imageryMustReflect: ["x"],
      motionLevel: "subtle",
      referenceVisualAxes: sampleAxes,
    });
    const block = buildDesignContractPromptInjection(c, { url: "https://ref.example/" });
    expect(block).toContain("ROLVERDELING");
    expect(block).toContain("REFERENCE VISUAL AXES");
    expect(block).toContain("layoutRhythm");
    expect(block).toContain("https://ref.example/");
  });
});

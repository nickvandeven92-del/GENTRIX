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

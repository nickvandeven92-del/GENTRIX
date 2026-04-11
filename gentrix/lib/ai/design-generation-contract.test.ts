import { describe, expect, it } from "vitest";
import {
  buildDesignContractPromptInjection,
  designGenerationContractSchema,
} from "@/lib/ai/design-generation-contract";

describe("designGenerationContractSchema", () => {
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
});

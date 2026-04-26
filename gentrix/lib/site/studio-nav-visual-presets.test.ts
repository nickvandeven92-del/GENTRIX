import { describe, expect, it } from "vitest";
import type { DesignGenerationContract } from "@/lib/ai/design-generation-contract";
import {
  coerceNavVisualActiveIndicator,
  coerceNavVisualCtaStyle,
  coerceNavVisualHeight,
  coerceNavVisualPresetId,
  inferNavVisualPresetId,
  NAV_VISUAL_PRESETS,
  normalizeNavVisualOverridesInput,
  resolveNavVisualPreset,
  resolveStudioNavVisual,
} from "@/lib/site/studio-nav-visual-presets";

describe("resolveNavVisualPreset", () => {
  it("preset minimalLight + variant pill in JSON: preset-kleuren/indicator, maar shell is pill (geen bar)", () => {
    const r = resolveNavVisualPreset({ variant: "pill", navVisualPreset: "minimalLight" }, null, null);
    expect(r.presetId).toBe("minimalLight");
    expect(r.contract.variant).toBe("pill");
    expect(r.contract.surface).toBe("light");
    expect(r.contract.activeIndicator).toBe("underline");
  });

  it("preset minimalLight + override alleen height", () => {
    const r = resolveNavVisualPreset(
      {
        variant: "bar",
        navVisualPreset: "minimalLight",
        navVisualOverrides: { height: "spacious" },
      },
      null,
      null,
    );
    expect(r.presetId).toBe("minimalLight");
    expect(r.contract.surface).toBe("light");
    expect(r.contract.height).toBe("spacious");
    expect(r.contract.shadow).toBe("none");
  });

  it("onbekende override-keys worden gestript; geldige velden blijven", () => {
    const r = resolveNavVisualPreset(
      {
        variant: "bar",
        navVisualPreset: "minimalLight",
        navVisualOverrides: { height: "compact", surface: "dark" } as never,
      },
      null,
      null,
    );
    expect(r.contract.surface).toBe("light");
    expect(r.contract.height).toBe("compact");
  });

  it("legacy bar + frosted → minimalLight-basis + infer theme", () => {
    const r = resolveNavVisualPreset({ variant: "bar", surface: "frosted" }, { primary: "#f5f5f4" }, null);
    expect(r.presetId).toBeNull();
    expect(r.contract).toEqual({ ...NAV_VISUAL_PRESETS.minimalLight, variant: "bar" });
  });

  it("legacy bar + tinted → darkSolid-basis", () => {
    const r = resolveNavVisualPreset({ variant: "bar", surface: "tinted" }, null, null);
    expect(r.contract.surface).toBe("dark");
  });

  it("legacy pill zonder preset → floatingPill (glass + subtiele rand)", () => {
    const r = resolveNavVisualPreset({ variant: "pill" }, null, null);
    expect(r.contract.variant).toBe("pill");
    expect(r.contract.surface).toBe("glass");
    expect(r.contract.border).toBe("subtle");
    expect(r.contract.ctaStyle).toBe("solid");
  });

  it("resolveStudioNavVisual alias", () => {
    expect(resolveStudioNavVisual({ variant: "bar" }, { primary: "#fff" }, null).contract.surface).toBe("light");
  });
});

describe("coerceNavVisualPresetId", () => {
  it("floating / zwevend → floatingPill", () => {
    expect(coerceNavVisualPresetId("floating")).toBe("floatingPill");
    expect(coerceNavVisualPresetId("ZWEVEND")).toBe("floatingPill");
    expect(coerceNavVisualPresetId("minimalLight")).toBe("minimalLight");
  });
});

describe("navVisualOverrides normalisatie", () => {
  it("coerceert gangbare AI-synoniemen naar canonieke enums", () => {
    expect(coerceNavVisualHeight("TALL")).toBe("spacious");
    expect(coerceNavVisualCtaStyle("filled")).toBe("solid");
    expect(coerceNavVisualActiveIndicator("LINE")).toBe("underline");
    expect(normalizeNavVisualOverridesInput({ height: "large", ctaStyle: "primary", activeIndicator: "rounded" })).toEqual({
      height: "spacious",
      ctaStyle: "solid",
      activeIndicator: "pill",
    });
  });

  it("onzinnige waarden verdwijnen (lege overrides)", () => {
    expect(normalizeNavVisualOverridesInput({ height: "galaxy", ctaStyle: 42 })).toEqual({});
  });
});

describe("inferNavVisualPresetId", () => {
  it("luxury vibe → luxuryGold", () => {
    expect(inferNavVisualPresetId({ vibe: "luxury" }, null)).toBe("luxuryGold");
  });
  it("glass card style → glassLight", () => {
    const dc = {
      heroVisualSubject: "Subject line for hero visual",
      paletteMode: "light",
      imageryMustReflect: ["trust"],
      motionLevel: "subtle",
      referenceVisualAxes: {
        layoutRhythm: "balanced",
        themeMode: "light",
        paletteIntent: "clean light palette with subtle depth",
        typographyDirection: "sans_modern",
        heroComposition: "centered hero with overlay text",
        sectionDensity: "medium",
        motionStyle: "static_minimal",
        borderTreatment: "none_minimal",
        cardStyle: "glass_blur",
      },
    } as DesignGenerationContract;
    expect(inferNavVisualPresetId({}, dc)).toBe("glassLight");
  });

  it("editorial mosaic layout → editorialTransparent (na glass-check)", () => {
    const dc = {
      heroVisualSubject: "Editorial magazine-style layout for a creative studio",
      paletteMode: "light",
      imageryMustReflect: ["craftsmanship"],
      motionLevel: "subtle",
      referenceVisualAxes: {
        layoutRhythm: "editorial_mosaic",
        themeMode: "light",
        paletteIntent: "Warm paper whites with deep ink accents and generous whitespace",
        typographyDirection: "serif_editorial",
        heroComposition: "Full-bleed photography with overlaid serif headline and thin rules",
        sectionDensity: "sparse",
        motionStyle: "static_minimal",
        borderTreatment: "none_minimal",
        cardStyle: "flat",
      },
    } as DesignGenerationContract;
    expect(inferNavVisualPresetId({ primary: "#f8fafc" }, dc)).toBe("editorialTransparent");
  });

  it("toneSummary luxury → luxuryGold vóór donker-palet heuristiek", () => {
    const dc = {
      heroVisualSubject: "Exclusive private banking and wealth advisory brand presence",
      paletteMode: "dark",
      imageryMustReflect: ["trust", "discretion"],
      motionLevel: "subtle",
      toneSummary: "High-end luxury financial services with restrained elegance",
    } as DesignGenerationContract;
    expect(inferNavVisualPresetId({ primary: "#0f172a" }, dc)).toBe("luxuryGold");
  });
});

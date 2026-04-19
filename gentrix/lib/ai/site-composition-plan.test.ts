import { describe, expect, it } from "vitest";
import {
  appendCompositionPlanToUserContent,
  buildCompositionPlanPromptInjection,
  mergeCompositionPlanWithCanonical,
  siteCompositionPlanSchema,
} from "@/lib/ai/site-composition-plan";

describe("mergeCompositionPlanWithCanonical", () => {
  it("orders section plans by canonical ids and fills missing", () => {
    const raw = {
      siteTypeNl: "Herenbarbershop in stadscentrum",
      sectionPlans: [
        { id: "footer", goalNl: "Compacte footer met links.", maxWords: 100 },
        { id: "hero", goalNl: "Typografische hero.", maxBullets: 0 },
      ],
      hero: {
        archetype: "editorial_statement",
        maxHeadlineWords: 6,
        maxSubcopyWords: 12,
        maxCtas: 2,
      },
      ctaStrategyNl: "Bel primair, WhatsApp secundair.",
      ctaMode: "primary_secondary",
      copyDensity: "compact",
      visualIntensity: "bold",
      flags: {
        testimonialsOnLanding: true,
        galleryOnLanding: false,
        pricingOnLanding: false,
        faqOnLanding: false,
      },
    };
    const merged = mergeCompositionPlanWithCanonical(["hero", "features", "footer"], raw);
    expect(merged.sectionPlans.map((s) => s.id)).toEqual(["hero", "features", "footer"]);
    expect(merged.sectionPlans[0]?.goalNl).toContain("Typografische");
    expect(merged.flags.testimonialsOnLanding).toBe(false);
    expect(siteCompositionPlanSchema.safeParse(merged).success).toBe(true);
  });
});

describe("buildCompositionPlanPromptInjection", () => {
  it("includes no-late-compression line", () => {
    const plan = mergeCompositionPlanWithCanonical(["hero", "footer"], null);
    const md = buildCompositionPlanPromptInjection(plan);
    expect(md).toMatch(/No late structural compression/i);
    expect(md).toMatch(/`hero`/);
  });

  it("mentions marketingPages keys when slugs are passed", () => {
    const plan = mergeCompositionPlanWithCanonical(["hero", "footer"], null);
    const md = buildCompositionPlanPromptInjection(plan, ["wat-wij-doen", "faq"]);
    expect(md).toMatch(/`wat-wij-doen`/);
    expect(md).toMatch(/`faq`/);
    expect(md).toMatch(/marketingPages/i);
  });
});

describe("appendCompositionPlanToUserContent", () => {
  it("appends to string user content", () => {
    const out = appendCompositionPlanToUserContent("BASE", "PLANBODY");
    expect(out).toContain("BASE");
    expect(out).toContain("PLANBODY");
    expect(out).toContain("COMPOSITIEPLAN");
  });
});

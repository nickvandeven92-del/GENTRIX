import { describe, expect, it } from "vitest";
import { ensureSiteIntentAboveFoldFields } from "@/lib/ai/ensure-site-intent-above-fold";
import { extractSiteIntentFromPrompt } from "@/lib/ai/extract-site-intent";
import { interpretPromptHeuristicOnly } from "@/lib/ai/interpret-prompt-heuristic";
import { preparePromptForInterpretation } from "@/lib/ai/prompt-normalization";
import { resolveSiteIntentFromInterpretation } from "@/lib/ai/resolve-site-intent-from-interpretation";

describe("extractSiteIntentFromPrompt", () => {
  it("multimedia-briefing → brand_storytelling (geen saas_landing-default)", () => {
    const intent = extractSiteIntentFromPrompt(
      "Genereer een Multimedia website. Veel dynamische beelden. Hyper modern.",
    );
    expect(intent.experienceModel).toBe("brand_storytelling");
  });

  it("generieke zin zonder keywords → interpretatiepipeline (vaak service_leadgen)", () => {
    const intent = extractSiteIntentFromPrompt("Bedrijfsnaam: Acme\n\nWij leveren kwaliteit.");
    expect(intent.experienceModel).toBe("service_leadgen");
    expect(intent.designRegime).toBe("hero_mixed");
  });

  it("korte barbier + luxe/donker → brand_storytelling (geen service_leadgen+compact-jacht)", () => {
    const intent = extractSiteIntentFromPrompt(
      "Barbershop Goude wikkel, donker luxe met goud",
    );
    expect(intent.experienceModel).toBe("brand_storytelling");
  });

  it("premium waterpretpark + tickets → premium_product (geen saas_landing)", () => {
    const intent = extractSiteIntentFromPrompt(
      "Premium waterpretpark met spectaculaire glijbanen, cinematische beleving, tickets online boeken.",
    );
    expect(intent.experienceModel).toBe("premium_product");
  });

  it("portfolio → editorial_content_hub", () => {
    const intent = extractSiteIntentFromPrompt("Fotograaf in Amsterdam — portfolio en galerij.");
    expect(intent.experienceModel).toBe("editorial_content_hub");
  });

  it("e-commerce → designRegime hero_split", () => {
    const intent = extractSiteIntentFromPrompt("Webshop met checkout en winkelwagen voor schoenen.");
    expect(intent.experienceModel).toBe("ecommerce_home");
    expect(intent.designRegime).toBe("hero_split");
    expect(intent.heroExpression).toBeDefined();
    expect(intent.resolverConfidence?.level).toBeDefined();
    expect(intent.aboveFoldArchetypeId).toBeDefined();
  });

  it("magazine → designRegime hero_integrated", () => {
    const intent = extractSiteIntentFromPrompt("Online magazine met artikelen en podcast.");
    expect(intent.experienceModel).toBe("editorial_content_hub");
    expect(intent.designRegime).toBe("hero_integrated");
  });
});

describe("resolveSiteIntentFromInterpretation (echte pipeline zonder Claude)", () => {
  it("multimedia + dynamische beelden → brand_storytelling", () => {
    const prompt = "Genereer een Multimedia website. Veel dynamische beelden. Hyper modern.";
    const { normalized } = preparePromptForInterpretation(prompt);
    const { interpretation, profile } = interpretPromptHeuristicOnly(normalized);
    const intent = resolveSiteIntentFromInterpretation(interpretation, normalized, profile);
    expect(intent.experienceModel).toBe("brand_storytelling");
    expect(intent.designRegime).toBe("hero_integrated");
  });

  it("extractSiteIntentFromPrompt en ensure(resolve) geven dezelfde kern + above-fold velden", () => {
    const prompt = "B2B catalogus met groot assortiment en prijsvergelijk.";
    const a = extractSiteIntentFromPrompt(prompt);
    const { normalized } = preparePromptForInterpretation(prompt);
    const { interpretation, profile } = interpretPromptHeuristicOnly(normalized);
    const b = ensureSiteIntentAboveFoldFields(
      resolveSiteIntentFromInterpretation(interpretation, normalized, profile),
      { interpretation, profile },
    );
    expect(a.experienceModel).toBe(b.experienceModel);
    expect(a.designRegime).toBe(b.designRegime);
    expect(a.heroExpression).toBe(b.heroExpression);
    expect(a.aboveFoldArchetypeId).toBe(b.aboveFoldArchetypeId);
  });
});

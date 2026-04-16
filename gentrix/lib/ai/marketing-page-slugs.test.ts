import { describe, expect, it } from "vitest";
import {
  DEFAULT_RETAIL_MARKETING_SLUGS,
  DEFAULT_SERVICE_MARKETING_SLUGS,
  resolveMarketingPageSlugsForGeneration,
} from "@/lib/ai/marketing-page-slugs";

describe("resolveMarketingPageSlugsForGeneration", () => {
  it("returns service defaults for generic briefing", () => {
    const slugs = resolveMarketingPageSlugsForGeneration({
      combinedProbe: "Lokaal schildersbedrijf voor binnen en buiten",
      detectedIndustryId: "painter",
    });
    expect(slugs).toEqual([...DEFAULT_SERVICE_MARKETING_SLUGS]);
  });

  it("returns retail defaults for webshop wording", () => {
    const slugs = resolveMarketingPageSlugsForGeneration({
      combinedProbe: "Online webshop met snelle levering",
      detectedIndustryId: undefined,
    });
    expect(slugs).toEqual([...DEFAULT_RETAIL_MARKETING_SLUGS]);
  });

  it("respects override", () => {
    const slugs = resolveMarketingPageSlugsForGeneration({
      combinedProbe: "webshop",
      detectedIndustryId: undefined,
      override: ["faq", "over-ons"],
    });
    expect(slugs).toEqual(["faq", "over-ons"]);
  });
});

import { describe, expect, it } from "vitest";
import { getGenerationPackagePromptBlock } from "@/lib/ai/generation-packages";
import { buildWebsiteGenerationUserPrompt } from "@/lib/ai/generate-site-with-claude";
import { STUDIO_BOOKING_PATH_PLACEHOLDER, STUDIO_SHOP_PATH_PLACEHOLDER } from "@/lib/site/studio-section-visibility";

describe("getGenerationPackagePromptBlock — CRM-module vlaggen", () => {
  it("CRM afspraken AAN: booking-placeholder en instructie in §0B", () => {
    const body = getGenerationPackagePromptBlock(undefined, { appointmentsEnabled: true });
    expect(body).toContain(STUDIO_BOOKING_PATH_PLACEHOLDER);
    expect(body).toMatch(/Online afspraken AAN|afspraken AAN/i);
    expect(body).not.toContain("CRM-modules staan in deze run UIT");
  });

  it("CRM webshop AAN: shop-placeholder in §0B", () => {
    const body = getGenerationPackagePromptBlock(undefined, { webshopEnabled: true });
    expect(body).toContain(STUDIO_SHOP_PATH_PLACEHOLDER);
    expect(body).toMatch(/Webshop AAN/i);
  });

  it("CRM uit: marketingblok vermeldt modules UIT", () => {
    const body = getGenerationPackagePromptBlock();
    expect(body).toContain("CRM-modules staan in deze run UIT");
    expect(body).toMatch(
      new RegExp(`geen[^\n]{0,120}${STUDIO_BOOKING_PATH_PLACEHOLDER.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`),
    );
  });
});

describe("buildWebsiteGenerationUserPrompt — CRM bij upgrade", () => {
  it("upgrade + CRM afspraken: 1B CRM-modulehint en booking in §0B", () => {
    const full = buildWebsiteGenerationUserPrompt("Test BV", "Voeg boekknop toe.", [], {
      preserveLayoutUpgrade: true,
      appointmentsEnabled: true,
      existingSiteTailwindJson: '{"config":null,"sections":[{"id":"hero","html":"<section></section>"}]}',
    });
    expect(full).toContain("1B. UPGRADE");
    expect(full).toContain("CRM-MODULELINKS");
    expect(full).toContain(STUDIO_BOOKING_PATH_PLACEHOLDER);
  });
});

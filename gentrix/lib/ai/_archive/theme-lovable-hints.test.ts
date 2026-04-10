import { describe, expect, it } from "vitest";
import {
  detectVintageWarmPaperContext,
  buildLovableThemeDirectiveBlock,
} from "@/lib/ai/theme-lovable-hints";

describe("theme-lovable-hints", () => {
  it("detectVintageWarmPaperContext herkent vintage + warm papier (NL)", () => {
    expect(detectVintageWarmPaperContext("klassiek vintage, warm papier, old-school typo")).toBe(true);
    expect(detectVintageWarmPaperContext("moderne SaaS dashboard")).toBe(false);
  });

  it("buildLovableThemeDirectiveBlock voegt vintage-blok toe", () => {
    const block = buildLovableThemeDirectiveBlock({
      preserveLayoutUpgrade: false,
      businessName: "De Barbier",
      description: "klassiek vintage, warm papier, old-school typo",
    });
    expect(block).toContain("Vintage / warm papier");
    expect(block).toContain("Geen dominerende");
  });

  it("buildLovableThemeDirectiveBlock (barbier) noemt luxe licht én luxe donker", () => {
    const block = buildLovableThemeDirectiveBlock({
      preserveLayoutUpgrade: false,
      businessName: "Studio Barbier",
      description: "Herenkapper premium barbershop Utrecht",
    });
    expect(block).toContain("Luxe licht");
    expect(block).toContain("Luxe donker");
    expect(block).toContain("geen synoniem voor donker");
  });
});

import { describe, expect, it } from "vitest";
import {
  buildSectionIdsFromBriefing,
  combinedIndustryProbeText,
  detectIndustry,
} from "@/lib/ai/generate-site-with-claude";

describe("combinedIndustryProbeText + branche-secties", () => {
  it("combineert naam en briefing", () => {
    expect(combinedIndustryProbeText("Salon X", "Knippen en kleuren")).toBe("Salon X\nKnippen en kleuren");
    expect(combinedIndustryProbeText("  ", "alleen dit")).toBe("alleen dit");
  });

  it("matcht kappers-profiel op naam alleen (herenkapster)", () => {
    const probe = combinedIndustryProbeText("Herenkapster De Snijder", "");
    expect(detectIndustry(probe)?.id).toBe("barber");
    const ids = buildSectionIdsFromBriefing(probe);
    expect(ids).toContain("hero");
    expect(ids).toContain("gallery");
    expect(ids).toContain("footer");
  });

  it("matcht nog steeds op klassieke kapper-omschrijving", () => {
    const probe = combinedIndustryProbeText("", "Website voor onze kapsalon in Utrecht");
    expect(detectIndustry(probe)?.id).toBe("hair_salon");
    expect(buildSectionIdsFromBriefing(probe)).toContain("team");
  });
});

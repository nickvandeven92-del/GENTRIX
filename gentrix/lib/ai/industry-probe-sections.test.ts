import { describe, expect, it } from "vitest";
import {
  applyHomepageSectionBudget,
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

  it("matcht nog steeds op klassieke kapper-omschrijving (strakke standaardsecties)", () => {
    const probe = combinedIndustryProbeText("", "Website voor onze kapsalon in Utrecht");
    expect(detectIndustry(probe)?.id).toBe("hair_salon");
    const ids = buildSectionIdsFromBriefing(probe);
    expect(ids).toEqual(expect.arrayContaining(["hero", "features", "gallery", "footer"]));
    expect(ids.length).toBeGreaterThanOrEqual(3);
    expect(ids.length).toBeLessThanOrEqual(5);
    expect(ids).not.toContain("team");
  });

  it("hair_salon: team-sectie bij expliciete team-taal in briefing (keyword krijgt voorrang in budget)", () => {
    const probe = combinedIndustryProbeText("", "Kapsalon met ervaren team van stylisten in Utrecht");
    expect(detectIndustry(probe)?.id).toBe("hair_salon");
    expect(buildSectionIdsFromBriefing(probe)).toContain("team");
  });

  it("hengelsport-profiel: geen gallery in sectielijst (webshop-module dekt productbeeld)", () => {
    const probe = combinedIndustryProbeText("Rudenko", "Visspeciaalzaak met webshop en hengels");
    expect(detectIndustry(probe)?.id).toBe("angling_shop");
    const ids = buildSectionIdsFromBriefing(probe);
    expect(ids).not.toContain("gallery");
    expect(ids).toContain("features");
    expect(ids).toContain("footer");
  });

  it("strip gallery wanneer briefing duidelijke webshop-signalen heeft", () => {
    const probe = combinedIndustryProbeText("", "Online bestellen via onze webshop, verzorgingsproducten");
    expect(buildSectionIdsFromBriefing(probe)).not.toContain("gallery");
  });

  it("applyHomepageSectionBudget: max 5 en kortere briefing → 4 secties", () => {
    const short = "Kapper";
    const long = "x".repeat(120);
    const many = ["hero", "features", "gallery", "about", "team", "brands", "footer"];
    expect(applyHomepageSectionBudget(short, many).length).toBe(4);
    expect(applyHomepageSectionBudget(long, many).length).toBe(5);
  });
});

import { describe, expect, it } from "vitest";
import {
  buildCinematicMultimediaPromptBlock,
  isCinematicMultimediaBriefing,
  isImmersiveDestinationBriefing,
} from "@/lib/ai/build-cinematic-multimedia-prompt-block";
import { buildHomepagePlan, deriveLeanSectionsFromHomepagePlan } from "@/lib/ai/build-homepage-plan";
import { defaultSiteIntent, type SiteIntent } from "@/lib/ai/site-experience-model";

describe("buildCinematicMultimediaPromptBlock", () => {
  it("detecteert multimedia-studio briefing", () => {
    const d = "Multimedia het schermpje — videoproductie en merkfilm voor MKB.";
    expect(isCinematicMultimediaBriefing(d)).toBe(true);
    expect(buildCinematicMultimediaPromptBlock(d)).toContain("0C.");
    expect(buildCinematicMultimediaPromptBlock(d)).toContain("<video");
  });

  it("detecteert cinematische trefwoorden", () => {
    expect(isCinematicMultimediaBriefing("Video-first, fullscreen hero, filmisch")).toBe(true);
  });

  it("detecteert leisure-bestemming en zet verplichte hero-video in het blok", () => {
    const d = "Premium waterpretpark met glijbanen en tickets online.";
    expect(isImmersiveDestinationBriefing(d)).toBe(true);
    expect(isCinematicMultimediaBriefing(d)).toBe(true);
    const block = buildCinematicMultimediaPromptBlock(d);
    expect(block).toContain("IMMERSIVE BESTEMMING");
    expect(block).toContain("Verplicht");
    expect(block).toMatch(/optionele\s+keuze|foto\s+i\.p\.v\.\s+video/i);
  });

  it("detecteert bewegende beelden / cinematische beleving", () => {
    expect(isCinematicMultimediaBriefing("Campagne met bewegende beelden en social")).toBe(true);
    expect(isCinematicMultimediaBriefing("Cinematische beleving rond het product")).toBe(true);
    expect(isImmersiveDestinationBriefing("Cinematische beleving rond het product")).toBe(false);
  });

  it("geeft leeg voor generieke zin", () => {
    expect(buildCinematicMultimediaPromptBlock("Wij leveren kwaliteit en service.")).toBe("");
  });
});

describe("brand_storytelling homepage → lean sections", () => {
  it("zonder cinematische trefwoorden: geen verplichte portfolio-sectie", () => {
    const intent: SiteIntent = {
      ...defaultSiteIntent(),
      experienceModel: "brand_storytelling",
      densityProfile: "airy",
    };
    const plan = buildHomepagePlan(intent, "Merkverhaal voor een regionaal advocatenkantoor.", undefined);
    const ids = deriveLeanSectionsFromHomepagePlan(plan, intent);
    expect(ids).toContain("hero");
    expect(ids).toContain("story");
    expect(ids).toContain("cta");
    expect(ids).toContain("footer");
    expect(ids.includes("portfolio")).toBe(false);
    expect(ids.filter((x) => x === "features").length).toBe(0);
  });

  it("met multimedia-briefing: showreel → portfolio", () => {
    const intent: SiteIntent = {
      ...defaultSiteIntent(),
      experienceModel: "brand_storytelling",
      densityProfile: "airy",
    };
    const plan = buildHomepagePlan(intent, "Videoproductiestudio — showreel en merkfilm.", undefined);
    const ids = deriveLeanSectionsFromHomepagePlan(plan, intent);
    expect(ids).toContain("portfolio");
    expect(ids).toContain("story");
    expect(ids.filter((x) => x === "features").length).toBe(0);
  });

  it("waterpretpark triggert ook cinematische plan-regels (showreel → portfolio) bij brand_storytelling", () => {
    const intent: SiteIntent = {
      ...defaultSiteIntent(),
      experienceModel: "brand_storytelling",
      densityProfile: "airy",
    };
    const plan = buildHomepagePlan(intent, "Waterpretpark met spectaculaire glijbanen.", undefined);
    const ids = deriveLeanSectionsFromHomepagePlan(plan, intent);
    expect(ids).toContain("portfolio");
  });
});

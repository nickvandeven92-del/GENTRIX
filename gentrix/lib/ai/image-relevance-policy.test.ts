import { describe, expect, it } from "vitest";
import {
  detectNicheBundle,
  evaluateUnsplashCandidate,
  inferSectionBucket,
  pickBestUnsplashResult,
} from "@/lib/ai/image-relevance-policy";

describe("detectNicheBundle", () => {
  it("detecteert hengelsport-context", () => {
    expect(detectNicheBundle("Online hengelsportwinkel met kunstaas")).toBe("fishing_angling_retail");
  });

  it("detecteert barbershop-context", () => {
    expect(detectNicheBundle("Premium barbershop voor heren in Rotterdam")).toBe("barbershop");
  });

  it("geeft null zonder duidelijke niche", () => {
    expect(detectNicheBundle("Algemene boekhoudkantoor voor MKB")).toBeNull();
  });
});

describe("inferSectionBucket", () => {
  it("hero uit id", () => {
    expect(inferSectionBucket("hero", "Intro")).toBe("hero");
  });

  it("shop uit naam", () => {
    expect(inferSectionBucket("sectie-2", "Producten winkel")).toBe("product_grid");
  });
});

describe("evaluateUnsplashCandidate", () => {
  it("straft scuba in hengelsport-context", () => {
    const ev = evaluateUnsplashCandidate("scuba diver underwater reef", null, {
      niche: {
        id: "fishing_angling_retail",
        triggers: [],
        anchorTerms: ["fishing"],
        forbiddenTerms: ["scuba"],
        weakContextTerms: ["water"],
      },
      nicheActive: true,
      pageIntent: "home",
      sectionBucket: "hero",
      contractAvoid: [],
      contractMustTokens: [],
    });
    expect(ev.forbiddenHit).toBe(true);
    expect(ev.matchedForbidden.some((x) => x.toLowerCase().includes("scuba"))).toBe(true);
  });

  it("domain gate faalt zonder anker in niche home", () => {
    const ev = evaluateUnsplashCandidate("peaceful lake at sunset", null, {
      niche: {
        id: "fishing_angling_retail",
        triggers: [],
        anchorTerms: ["fishing", "reel"],
        forbiddenTerms: [],
        weakContextTerms: ["lake"],
      },
      nicheActive: true,
      pageIntent: "home",
      sectionBucket: "hero",
      contractAvoid: [],
      contractMustTokens: [],
    });
    expect(ev.passedDomainGate).toBe(false);
    expect(ev.matchedWeak.length).toBeGreaterThan(0);
  });

  it("contactpagina: domain gate niet van toepassing", () => {
    const ev = evaluateUnsplashCandidate("peaceful lake at sunset", null, {
      niche: {
        id: "fishing_angling_retail",
        triggers: [],
        anchorTerms: ["fishing"],
        forbiddenTerms: [],
        weakContextTerms: ["lake"],
      },
      nicheActive: true,
      pageIntent: "contact",
      sectionBucket: "contact",
      contractAvoid: [],
      contractMustTokens: [],
    });
    expect(ev.passedDomainGate).toBe(true);
  });
});

describe("pickBestUnsplashResult", () => {
  const hits = [
    { urls: { regular: "https://u.test/a" }, alt_description: "scuba diving in blue ocean", description: null },
    { urls: { regular: "https://u.test/b" }, alt_description: "angler holding fishing rod at lake", description: null },
    { urls: { regular: "https://u.test/c" }, alt_description: "sunset over calm water", description: null },
  ];

  it("kiest vissen boven duiken voor hengelsport-briefing", () => {
    const theme = "Hengelsportzaak met hengels en molens";
    const out = pickBestUnsplashResult(hits, {
      themeContext: theme,
      sectionId: "hero",
      sectionName: "Hero",
      pageIntent: "home",
      designContract: null,
      pickOffset: 0,
    });
    expect(out?.photo.urls.regular).toBe("https://u.test/b");
  });

  it("kiest niet scuba als eerste forbidden is", () => {
    const out = pickBestUnsplashResult(hits, {
      themeContext: "Viswinkel en hengelsport",
      sectionId: "hero",
      sectionName: "Hero",
      pageIntent: "home",
      designContract: null,
      pickOffset: 0,
    });
    expect(out?.photo.alt_description).not.toMatch(/scuba/i);
  });
});

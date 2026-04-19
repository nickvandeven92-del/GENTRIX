import { describe, expect, it } from "vitest";
import {
  buildMarketingSlugSegmentResolutionMap,
  resolveMarketingPageKeyForUrlSegment,
} from "@/lib/site/marketing-path-aliases";

describe("buildMarketingSlugSegmentResolutionMap", () => {
  it("mapt veelgebruikte URL-segmenten naar canonieke marketing-keys", () => {
    const ms = ["diensten", "over-ons", "werkwijze", "faq"] as const;
    const m = buildMarketingSlugSegmentResolutionMap(ms);
    expect(m["diensten"]).toBe("diensten");
    expect(m["wat-wij-doen"]).toBe("diensten");
    expect(m["what-we-do"]).toBe("diensten");
    expect(m["over-ons"]).toBe("over-ons");
    expect(m["about"]).toBe("over-ons");
    expect(m["overons"]).toBe("over-ons");
    expect(m["werkwijze"]).toBe("werkwijze");
    expect(m["our-process"]).toBe("werkwijze");
    expect(m["faq"]).toBe("faq");
    expect(m["veelgestelde-vragen"]).toBe("faq");
  });

  it("voegt geen mapping toe voor onbekende segmenten", () => {
    const m = buildMarketingSlugSegmentResolutionMap(["prijzen"]);
    expect(m["wat-wij-doen"]).toBeUndefined();
    expect(m["prijzen"]).toBe("prijzen");
  });

  it("mapt /diensten naar standaardkey wat-wij-doen (generator-default)", () => {
    const m = buildMarketingSlugSegmentResolutionMap(["wat-wij-doen", "over-ons", "faq"]);
    expect(m["diensten"]).toBe("wat-wij-doen");
    expect(m["wat-wij-doen"]).toBe("wat-wij-doen");
  });
});

describe("resolveMarketingPageKeyForUrlSegment", () => {
  it("lost URL-segmenten op naar canonieke marketingPages-sleutel", () => {
    const pages = {
      "over-ons": [{ html: "" }],
      diensten: [{ html: "" }],
    };
    expect(resolveMarketingPageKeyForUrlSegment("overons", pages)).toBe("over-ons");
    expect(resolveMarketingPageKeyForUrlSegment("about", pages)).toBe("over-ons");
    expect(resolveMarketingPageKeyForUrlSegment("over-ons", pages)).toBe("over-ons");
    expect(resolveMarketingPageKeyForUrlSegment("wat-wij-doen", pages)).toBe("diensten");
  });

  it("retourneert null bij ontbrekende of lege pagina", () => {
    expect(resolveMarketingPageKeyForUrlSegment("faq", { faq: [] })).toBeNull();
    expect(resolveMarketingPageKeyForUrlSegment("onbekend", { "over-ons": [{ html: "" }] })).toBeNull();
  });

  it("matcht ruwe labels via slugify tegen een bestaande key", () => {
    const pages = { "over-ons": [{ html: "" }] };
    expect(resolveMarketingPageKeyForUrlSegment("Over Ons", pages)).toBe("over-ons");
  });

  it("lost /diensten op naar wat-wij-doen wanneer alleen die key in marketingPages staat", () => {
    const pages = {
      "wat-wij-doen": [{ html: "<section></section>" }],
      "over-ons": [{ html: "<section></section>" }],
      faq: [{ html: "<section></section>" }],
    };
    expect(resolveMarketingPageKeyForUrlSegment("diensten", pages)).toBe("wat-wij-doen");
  });
});

import { describe, expect, it } from "vitest";
import { buildMarketingSlugSegmentResolutionMap } from "@/lib/site/marketing-path-aliases";

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
});

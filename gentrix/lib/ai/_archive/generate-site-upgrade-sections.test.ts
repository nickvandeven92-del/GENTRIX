import { describe, expect, it } from "vitest";
import {
  extractSectionIdsFromTailwindUpgradeJson,
  mergeUpgradeSectionOrder,
} from "@/lib/ai/generate-site-with-claude";

describe("upgrade section order (bron-JSON vs briefing)", () => {
  it("extractSectionIdsFromTailwindUpgradeJson leest id-volgorde", () => {
    const json = JSON.stringify({
      config: null,
      sections: [{ id: "hero", html: "<section></section>" }, { id: "faq", html: "" }],
    });
    expect(extractSectionIdsFromTailwindUpgradeJson(json)).toEqual(["hero", "faq"]);
  });

  it("mergeUpgradeSectionOrder: bestaand eerst, daarna nieuwe uit planned", () => {
    expect(mergeUpgradeSectionOrder(["hero", "footer"], ["hero", "pricing", "footer"])).toEqual([
      "hero",
      "footer",
      "pricing",
    ]);
  });

  it("mergeUpgradeSectionOrder: zonder bestaand → planned", () => {
    expect(mergeUpgradeSectionOrder(null, ["a", "b"])).toEqual(["a", "b"]);
  });
});

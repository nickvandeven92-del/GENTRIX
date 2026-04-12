import { describe, expect, it } from "vitest";
import {
  orderStudioDefaultHeroVideosForPrompt,
  STUDIO_DEFAULT_SILENT_HERO_MP4_URLS,
} from "@/lib/site/studio-default-hero-videos";

describe("orderStudioDefaultHeroVideosForPrompt", () => {
  it("geeft een permutatie van alle standaard-URL's", () => {
    const o = orderStudioDefaultHeroVideosForPrompt("test-seed-a");
    expect(o).toHaveLength(STUDIO_DEFAULT_SILENT_HERO_MP4_URLS.length);
    expect(new Set(o).size).toBe(STUDIO_DEFAULT_SILENT_HERO_MP4_URLS.length);
    for (const u of o) {
      expect(STUDIO_DEFAULT_SILENT_HERO_MP4_URLS).toContain(u);
    }
  });

  it("is deterministisch op dezelfde seed", () => {
    const a = orderStudioDefaultHeroVideosForPrompt("same");
    const b = orderStudioDefaultHeroVideosForPrompt("same");
    expect(a).toEqual(b);
  });

  it("heeft verschillende eerste URL voor verschillende seeds (anti-vaste-volgorde)", () => {
    const firsts = ["s0", "s1", "s2", "s3", "s4", "s5"].map((s) => orderStudioDefaultHeroVideosForPrompt(s)[0]);
    expect(new Set(firsts).size).toBeGreaterThan(1);
  });
});

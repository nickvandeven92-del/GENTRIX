import { describe, expect, it } from "vitest";
import { buildCompactnessPromptBlock } from "@/lib/ai/build-compactness-prompt-block";
import { compressCopyBlock, compressText } from "@/lib/ai/compress-copy";
import { limitCustomSections } from "@/lib/ai/custom-section-budget";
import { mergeHomepageSections } from "@/lib/ai/merge-homepage-sections";
import { getCompactnessPreset } from "@/lib/ai/page-compactness-presets";
import {
  coerceToHomepageSectionIds,
  isHomepageSectionId,
  pruneHomepageSections,
} from "@/lib/ai/prune-homepage-sections";
import { buildHomepageCompactnessPlan, applyHomepageCompactnessToSiteConfig } from "@/lib/ai/homepage-compactness-plan";
import { resolvePageCompactness } from "@/lib/ai/resolve-page-compactness";
import { resolveRenderConstraints } from "@/lib/ai/resolve-render-constraints";
import { resolveSectionContentBudget } from "@/lib/ai/resolve-section-content-budget";
import { createDefaultSiteConfig } from "@/lib/ai/build-site-config";

describe("page compactness", () => {
  it("getCompactnessPreset: compact heeft kortere paragraaflimiet", () => {
    const c = getCompactnessPreset("compact");
    const e = getCompactnessPreset("extended");
    expect(c.maxParagraphChars).toBeLessThan(e.maxParagraphChars);
  });

  it("resolvePageCompactness: layout_density compact → compact target", () => {
    const cfg = createDefaultSiteConfig({ layout_density: "compact" });
    const p = resolvePageCompactness(cfg);
    expect(p.pageLengthTarget).toBe("compact");
  });

  it("resolvePageCompactness: spacious alleen → geen harde extended", () => {
    const cfg = createDefaultSiteConfig({
      layout_density: "spacious",
      primary_goal: "awareness",
      target_audience: "general public",
      brand_style: "minimal_light",
      visual_style: "high_contrast_depth",
    });
    const p = resolvePageCompactness(cfg);
    expect(p.pageLengthTarget).not.toBe("extended");
  });

  it("resolvePageCompactness: spacious + luxury_dark brand_style → extended (licht/luxe varianten zijn apart; geen dark-only vereiste)", () => {
    const cfg = createDefaultSiteConfig({
      layout_density: "spacious",
      brand_style: "luxury_dark",
      visual_style: "high_contrast_depth",
    });
    expect(resolvePageCompactness(cfg).pageLengthTarget).toBe("extended");
  });

  it("resolvePageCompactness: page_length_target override", () => {
    const cfg = createDefaultSiteConfig({ page_length_target: "extended", layout_density: "compact" });
    expect(resolvePageCompactness(cfg).pageLengthTarget).toBe("extended");
  });

  it("pruneHomepageSections: respecteert maxPrimarySections en footer", () => {
    const c = getCompactnessPreset("compact");
    const input = coerceToHomepageSectionIds([
      "hero",
      "services",
      "features",
      "about",
      "testimonials",
      "cta",
      "footer",
    ]);
    const out = pruneHomepageSections(input, c);
    expect(out[out.length - 1]).toBe("footer");
    expect(out.filter((s) => s !== "footer").length).toBeLessThanOrEqual(c.maxPrimarySections);
    expect(out.includes("hero")).toBe(true);
  });

  it("mergeHomepageSections: geen dubbele trust na hero+trust merge", () => {
    const c = getCompactnessPreset("compact");
    const sections = coerceToHomepageSectionIds(["hero", "trust", "services", "footer"]);
    const merged = mergeHomepageSections(sections, c);
    const flat = merged.flatMap((m) => m.includes);
    expect(flat.filter((x) => x === "trust").length).toBe(1);
  });

  it("compressText: verkort lange input", () => {
    const c = getCompactnessPreset("compact");
    const long = "word ".repeat(80);
    const t = compressText(long, c);
    expect(t.length).toBeLessThanOrEqual(c.maxParagraphChars + 2);
  });

  it("compressCopyBlock: bullets begrensd", () => {
    const c = getCompactnessPreset("compact");
    const b = compressCopyBlock({ bullets: ["a", "b", "c", "d", "e"] }, c);
    expect(b.bullets?.length).toBe(c.maxBulletsPerCard);
  });

  it("resolveRenderConstraints: extended → equal height cards", () => {
    const rc = resolveRenderConstraints(getCompactnessPreset("extended"));
    expect(rc.forceEqualHeightCards).toBe(true);
    expect(rc.preferShortCards).toBe(false);
    expect(rc.sectionPaddingDesktop).toBeTruthy();
  });

  it("resolveRenderConstraints: balanced → tussenliggende gap", () => {
    const rc = resolveRenderConstraints(getCompactnessPreset("balanced"));
    expect(rc.sectionGapClass).toContain("gap-8");
    expect(rc.maxCardBodyLines).toBe(5);
  });

  it("resolveSectionContentBudget: compact → striktere FAQ-cap", () => {
    const b = resolveSectionContentBudget(getCompactnessPreset("compact"));
    const e = resolveSectionContentBudget(getCompactnessPreset("extended"));
    expect(b.maxFaqItems).toBeLessThan(e.maxFaqItems);
  });

  it("limitCustomSections: compact → max 1", () => {
    const c = getCompactnessPreset("compact");
    expect(limitCustomSections(["a", "b", "c"], c).length).toBe(1);
  });

  it("buildCompactnessPromptBlock: bevat budget en nav/footer limieten", () => {
    const c = getCompactnessPreset("balanced");
    const b = resolveSectionContentBudget(c);
    const block = buildCompactnessPromptBlock(c, b);
    expect(block).toMatch(/Maximum nav links/);
    expect(block).toMatch(/footer columns/i);
  });

  it("buildCompactnessPromptBlock: één-arg HomepageCompactnessPlan === gekoppelde compactness+budget", () => {
    const cfg = createDefaultSiteConfig({ page_length_target: "balanced" });
    const plan = buildHomepageCompactnessPlan(cfg);
    const fromPlan = buildCompactnessPromptBlock(plan);
    const fromPair = buildCompactnessPromptBlock(plan.compactness, plan.contentBudget);
    expect(fromPlan).toBe(fromPair);
  });

  it("applyHomepageCompactnessToSiteConfig: doorgeven bestaand plan = zelfde als opnieuw bouwen", () => {
    const cfg = createDefaultSiteConfig({
      page_length_target: "compact",
      sections: ["hero", "features", "footer", "x", "y"],
    });
    const plan = buildHomepageCompactnessPlan(cfg);
    expect(applyHomepageCompactnessToSiteConfig(cfg, plan)).toEqual(applyHomepageCompactnessToSiteConfig(cfg));
  });

  it("applyHomepageCompactnessToSiteConfig: cap op custom secties (compact)", () => {
    const cfg = createDefaultSiteConfig({
      layout_density: "compact",
      page_length_target: "compact",
      sections: ["hero", "services", "footer", "custom-a", "custom-b", "custom-c"],
    });
    const next = applyHomepageCompactnessToSiteConfig(cfg);
    const customs = next.sections.filter((s) => !isHomepageSectionId(s));
    expect(customs.length).toBeLessThanOrEqual(1);
    expect(next.page_length_target).toBe("compact");
  });

  it("buildHomepageCompactnessPlan: mergedSections + fullSectionList sluiten aan op apply", () => {
    const cfg = createDefaultSiteConfig({
      page_length_target: "balanced",
      sections: ["hero", "features", "cta", "footer", "extra-widget"],
    });
    const plan = buildHomepageCompactnessPlan(cfg);
    const applied = applyHomepageCompactnessToSiteConfig(cfg);
    expect(plan.fullSectionList).toEqual(applied.sections);
    expect(plan.mergedSections.length).toBeGreaterThanOrEqual(1);
    expect(plan.contentBudget.maxFaqItems).toBeGreaterThan(0);
    expect(plan.renderConstraints.containerMaxWidth).toBeTruthy();
  });
});

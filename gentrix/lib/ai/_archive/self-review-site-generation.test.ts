import { describe, expect, it } from "vitest";
import {
  generatedTailwindPageToClaudeOutput,
  isSiteSelfReviewEnabled,
} from "@/lib/ai/self-review-site-generation";
import type { GeneratedTailwindPage } from "@/lib/ai/tailwind-sections-schema";

describe("self-review-site-generation", () => {
  it("generatedTailwindPageToClaudeOutput mapt id/html/sectionName", () => {
    const page: GeneratedTailwindPage = {
      config: {
        style: "premium",
        font: "Inter",
        theme: { primary: "#0f172a", accent: "#c5a059", secondary: "#64748b" },
      },
      sections: [
        { id: "hero", sectionName: "Hero", html: '<section id="hero"><h1>Test</h1></section>' },
      ],
    };
    const out = generatedTailwindPageToClaudeOutput(page);
    expect(out.config).toEqual(page.config);
    expect(out.sections).toEqual([
      { id: "hero", name: "Hero", html: '<section id="hero"><h1>Test</h1></section>' },
    ]);
  });

  it("isSiteSelfReviewEnabled standaard aan; ENABLE=0 zet uit; DISABLE=1 wint", () => {
    const prevD = process.env.DISABLE_SITE_SELF_REVIEW;
    const prevE = process.env.ENABLE_SITE_SELF_REVIEW;
    try {
      delete process.env.DISABLE_SITE_SELF_REVIEW;
      delete process.env.ENABLE_SITE_SELF_REVIEW;
      expect(isSiteSelfReviewEnabled()).toBe(true);
      process.env.ENABLE_SITE_SELF_REVIEW = "0";
      expect(isSiteSelfReviewEnabled()).toBe(false);
      delete process.env.ENABLE_SITE_SELF_REVIEW;
      expect(isSiteSelfReviewEnabled()).toBe(true);
      process.env.DISABLE_SITE_SELF_REVIEW = "1";
      expect(isSiteSelfReviewEnabled()).toBe(false);
    } finally {
      if (prevD === undefined) delete process.env.DISABLE_SITE_SELF_REVIEW;
      else process.env.DISABLE_SITE_SELF_REVIEW = prevD;
      if (prevE === undefined) delete process.env.ENABLE_SITE_SELF_REVIEW;
      else process.env.ENABLE_SITE_SELF_REVIEW = prevE;
    }
  });
});

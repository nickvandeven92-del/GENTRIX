import { describe, expect, it } from "vitest";
import {
  generatedTailwindPageToClaudeOutput,
  isSiteSelfReviewEnabled,
} from "@/lib/ai/self-review-site-generation";
import { STUDIO_SITE_GENERATION } from "@/lib/ai/studio-generation-fixed-config";
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

  it("isSiteSelfReviewEnabled volgt studio-generation-fixed-config", () => {
    expect(isSiteSelfReviewEnabled()).toBe(STUDIO_SITE_GENERATION.selfReviewEnabled);
  });
});

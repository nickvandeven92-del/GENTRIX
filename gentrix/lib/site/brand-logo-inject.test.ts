import { describe, expect, it } from "vitest";
import type { TailwindSection } from "@/lib/ai/tailwind-sections-schema";
import { applyBrandLogoFallbackToSections, STUDIO_BRAND_MARK_ATTR } from "@/lib/site/brand-logo-inject";
import type { GeneratedLogoSet } from "@/types/logo";

describe("applyBrandLogoFallbackToSections", () => {
  it("injecteert na de volledige open-header (quote-aware: `>` in @scroll.window breekt niet)", () => {
    const sections: TailwindSection[] = [
      {
        id: "hero",
        name: "Hero",
        html: `<header class="sticky top-0 z-50" @scroll.window="navScrolled = window.scrollY > 10" :class="{ 'bg-slate-900/90': navScrolled }" x-data="{ navOpen: false }">
  <a href="/">Logo</a>
</header>`,
      },
    ];
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="8"><rect width="40" height="8" fill="currentColor"/></svg>`;
    const logoSet: GeneratedLogoSet = {
      brandName: "Gentrix",
      selectedConcept: "test",
      variants: {
        primary: svg,
        light: svg,
        dark: svg,
        mono: svg,
        icon: svg,
        favicon: svg,
      },
      metadata: {
        logoStyle: "wordmark",
        typographyDirection: "sans",
        symbolConcept: "test",
        usageNotes: ["test"],
      },
    };
    const out = applyBrandLogoFallbackToSections(sections, logoSet);
    const joined = out.map((s) => s.html).join("\n");
    expect(joined).toContain(STUDIO_BRAND_MARK_ATTR);
    expect(joined.trimStart().match(/^<header\b/i)).toBeTruthy();
    expect((joined.match(/<header\b/gi) ?? []).length).toBe(1);
    expect(joined).toContain("navScrolled = window.scrollY > 10");
    expect(joined).toContain(":class=");
  });
});

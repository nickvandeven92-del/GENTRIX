import { describe, expect, it } from "vitest";
import type { MasterPromptTheme } from "@/lib/ai/tailwind-sections-schema";
import { buildStudioNavChromeTone } from "@/lib/site/studio-nav-theme";
import { STUDIO_NAV_VISUAL_PRESETS } from "@/lib/site/studio-nav-visual-presets";

describe("buildStudioNavChromeTone", () => {
  it("light surface: lichte shell ook bij donkere primary", () => {
    const t = buildStudioNavChromeTone(
      { primary: "#0f172a", accent: "#eab308" } as MasterPromptTheme,
      STUDIO_NAV_VISUAL_PRESETS.minimalLight,
    );
    expect(t.isDarkChrome).toBe(false);
    expect(t.barHostStyle).toContain("rgba(255,255,255");
    expect(t.barHostStyle).toContain("--studio-nav-accent:#eab308");
    expect(t.hostShadowClass).toBe("");
  });

  it("dark surface: primary-getinte shell", () => {
    const t = buildStudioNavChromeTone(
      { primary: "#0f172a", accent: "#eab308" } as MasterPromptTheme,
      STUDIO_NAV_VISUAL_PRESETS.darkSolid,
    );
    expect(t.isDarkChrome).toBe(true);
    expect(t.barHostStyle).toMatch(/background:rgba\(15,\s*23,\s*42/);
  });

  it("glass surface: blur + lichte achtergrond", () => {
    const t = buildStudioNavChromeTone(
      { primary: "#0f172a", accent: "#eab308" } as MasterPromptTheme,
      STUDIO_NAV_VISUAL_PRESETS.glassLight,
    );
    expect(t.isDarkChrome).toBe(false);
    expect(t.barHostStyle).toContain("backdrop-filter:blur(14px)");
  });

  it("respecteert theme.borderRadius op de pill", () => {
    const t = buildStudioNavChromeTone(
      {
        primary: "#1e293b",
        accent: "#f59e0b",
        borderRadius: "full",
      } as MasterPromptTheme,
      STUDIO_NAV_VISUAL_PRESETS.floatingPill,
    );
    expect(t.pillRadiusClass).toBe("rounded-full");
  });
});

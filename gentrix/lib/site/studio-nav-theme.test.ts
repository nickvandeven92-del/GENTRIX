import { describe, expect, it } from "vitest";
import type { MasterPromptTheme } from "@/lib/ai/tailwind-sections-schema";
import { buildStudioNavChromeTone } from "@/lib/site/studio-nav-theme";

describe("buildStudioNavChromeTone", () => {
  it("gebruikt donkere chrome bij donkere primary", () => {
    const t = buildStudioNavChromeTone({ primary: "#0f172a", accent: "#eab308" } as MasterPromptTheme);
    expect(t.isDarkChrome).toBe(true);
    expect(t.barHostStyle).toContain("rgba(");
    expect(t.barHostStyle).toContain("--studio-nav-accent:#eab308");
  });

  it("gebruikt lichte chrome bij lichte primary", () => {
    const t = buildStudioNavChromeTone({ primary: "#fef9c3", accent: "#b45309" } as MasterPromptTheme);
    expect(t.isDarkChrome).toBe(false);
    expect(t.barHostStyle).toContain("rgba(255,255,255");
    expect(t.pillRadiusClass).toBeTruthy();
  });

  it("respecteert theme.borderRadius op de pill", () => {
    const t = buildStudioNavChromeTone({
      primary: "#1e293b",
      accent: "#f59e0b",
      borderRadius: "full",
    } as MasterPromptTheme);
    expect(t.pillRadiusClass).toBe("rounded-full");
  });
});

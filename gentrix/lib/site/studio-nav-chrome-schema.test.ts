import { describe, expect, it } from "vitest";
import { coerceStudioNavBarLayout, studioNavChromeConfigSchema } from "@/lib/site/studio-nav-chrome-schema";

describe("coerceStudioNavBarLayout", () => {
  it("mapt briefing-synoniemen naar centeredLinks", () => {
    expect(coerceStudioNavBarLayout("CENTER")).toBe("centeredLinks");
    expect(coerceStudioNavBarLayout("links centered")).toBe("centeredLinks");
  });

  it("standaard-synoniemen", () => {
    expect(coerceStudioNavBarLayout("default")).toBe("standard");
  });

  it("onzin → undefined", () => {
    expect(coerceStudioNavBarLayout("radial")).toBeUndefined();
  });
});

describe("studioNavChromeConfigSchema + navVisualPreset synoniemen", () => {
  it("floating + bar variant → floatingPill + pill (floating vereist pill-layout in JSON)", () => {
    const r = studioNavChromeConfigSchema.safeParse({
      variant: "bar",
      brandLabel: "X",
      items: [
        { label: "A", href: "#a" },
        { label: "B", href: "#b" },
      ],
      navVisualPreset: "floating",
    });
    expect(r.success).toBe(true);
    expect(r.data?.navVisualPreset).toBe("floatingPill");
    expect(r.data?.variant).toBe("pill");
  });
});

describe("studioNavChromeConfigSchema + navChromeTheme", () => {
  it("accepteert optionele navChromeTheme", () => {
    const r = studioNavChromeConfigSchema.safeParse({
      variant: "bar",
      brandLabel: "X",
      items: [
        { label: "A", href: "#a" },
        { label: "B", href: "#b" },
      ],
      navChromeTheme: { accent: "#ff00aa", primary: "#111111" },
    });
    expect(r.success).toBe(true);
    expect(r.data?.navChromeTheme?.accent).toBe("#ff00aa");
  });
});

describe("studioNavChromeConfigSchema + navBarLayout", () => {
  it("parsed navBarLayout na preprocess", () => {
    const r = studioNavChromeConfigSchema.safeParse({
      variant: "bar",
      brandLabel: "X",
      items: [
        { label: "A", href: "#a" },
        { label: "B", href: "#b" },
      ],
      navBarLayout: "center",
    });
    expect(r.success).toBe(true);
    expect(r.data?.navBarLayout).toBe("centeredLinks");
  });
});

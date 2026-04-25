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

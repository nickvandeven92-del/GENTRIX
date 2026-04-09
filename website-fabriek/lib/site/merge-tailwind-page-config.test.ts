import { describe, expect, it } from "vitest";
import type { TailwindPageConfig } from "@/lib/ai/tailwind-sections-schema";
import { deepMergeJson, mergeTailwindPageConfigPatch } from "@/lib/site/merge-tailwind-page-config";

describe("mergeTailwindPageConfigPatch", () => {
  const masterBase: TailwindPageConfig = {
    style: "Corporate",
    font: "Inter",
    theme: {
      primary: "#111111",
      accent: "#222222",
      vibe: "modern",
    },
  };

  it("master: deep-merge overschrijft nested theme.primary, rest blijft", () => {
    const r = mergeTailwindPageConfigPatch(masterBase, { theme: { primary: "#abcdef" } });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.strategy).toBe("deep_partial");
    expect(r.value).toMatchObject({
      style: "Corporate",
      font: "Inter",
      theme: expect.objectContaining({
        primary: "#abcdef",
        accent: "#222222",
        vibe: "modern",
      }),
    });
  });

  it("master: style en font optioneel overschrijven", () => {
    const r = mergeTailwindPageConfigPatch(masterBase, { style: "Luxury", font: "Playfair Display" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect("style" in r.value && r.value.style).toBe("Luxury");
    expect("font" in r.value && r.value.font).toBe("Playfair Display");
    expect((r.value as typeof masterBase).theme.primary).toBe("#111111");
  });

  it("legacy: vlakke subset-merge", () => {
    const legacy: TailwindPageConfig = {
      themeName: "Acme",
      primaryColor: "#000000",
      fontFamily: "Arial",
      borderRadius: "md",
    };
    const r = mergeTailwindPageConfigPatch(legacy, { primaryColor: "#ffffff" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.strategy).toBe("deep_partial");
    expect(r.value).toMatchObject({
      themeName: "Acme",
      primaryColor: "#ffffff",
      fontFamily: "Arial",
      borderRadius: "md",
    });
  });

  it("lege patch laat base ongemoeid", () => {
    const r = mergeTailwindPageConfigPatch(masterBase, {});
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.patchKeyCount).toBe(0);
    expect(r.value).toEqual(masterBase);
  });

  it("deepMergeJson vervangt arrays", () => {
    expect(deepMergeJson({ a: [1, 2] }, { a: [3] })).toEqual({ a: [3] });
  });
});

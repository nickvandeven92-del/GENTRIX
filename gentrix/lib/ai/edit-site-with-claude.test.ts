import { describe, expect, it } from "vitest";
import {
  inferTargetIndicesFromInstruction,
  resolveTargetSectionIndices,
} from "@/lib/ai/edit-site-with-claude";

describe("resolveTargetSectionIndices", () => {
  it("returns null for undefined or empty (full-page context)", () => {
    expect(resolveTargetSectionIndices(undefined, 3)).toEqual({ ok: true, indices: null });
    expect(resolveTargetSectionIndices([], 3)).toEqual({ ok: true, indices: null });
  });

  it("dedupes and sorts valid indices", () => {
    expect(resolveTargetSectionIndices([2, 0, 2], 4)).toEqual({ ok: true, indices: [0, 2] });
  });

  it("rejects out-of-range indices", () => {
    const r = resolveTargetSectionIndices([0, 9], 3);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("9");
  });
});

describe("inferTargetIndicesFromInstruction", () => {
  const sections = [
    { sectionName: "Hero", html: "<section></section>" },
    { sectionName: "Contact", html: "<section></section>" },
  ];

  it("matches substrings of section names (case-insensitive)", () => {
    expect(inferTargetIndicesFromInstruction("Pas de Hero aan", sections)).toEqual([0]);
    expect(inferTargetIndicesFromInstruction("contact sectie", sections)).toEqual([1]);
  });

  it("returns empty when no name matches", () => {
    expect(inferTargetIndicesFromInstruction("Alleen algemene copy", sections)).toEqual([]);
  });

  it("matcht ook canonieke id en semanticRole", () => {
    const rich = [
      { id: "hero" as const, sectionName: "Intro", html: "<section></section>", semanticRole: "hero" as const },
      { id: "pricing" as const, sectionName: "Tarieven", html: "<section></section>", semanticRole: "pricing" as const },
    ];
    expect(inferTargetIndicesFromInstruction("Wijzig sectie hero", rich)).toEqual([0]);
    expect(inferTargetIndicesFromInstruction("pas pricing aan", rich)).toEqual([1]);
  });
});

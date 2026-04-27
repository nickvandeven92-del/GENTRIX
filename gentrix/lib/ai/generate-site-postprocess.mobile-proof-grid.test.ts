import { describe, expect, it } from "vitest";
import { repairDenseTwoColumnProofGridsInHtml } from "@/lib/ai/generate-site-postprocess";

describe("repairDenseTwoColumnProofGridsInHtml", () => {
  it("maakt KPI-band mobiel-eerst (grid-cols-2 md:grid-cols-4 → grid-cols-1 sm:grid-cols-2 lg:grid-cols-4)", () => {
    const html =
      '<div class="mx-auto grid max-w-6xl grid-cols-2 gap-8 md:gap-10 md:grid-cols-4">';
    const out = repairDenseTwoColumnProofGridsInHtml(html);
    expect(out).toContain("grid-cols-1 sm:grid-cols-2");
    expect(out).toContain("lg:grid-cols-4");
    expect(out).not.toContain("md:grid-cols-4");
    expect(out).not.toMatch(/(?:^|[\s"'])grid-cols-2(?:[\s"']|$)/);
  });

  it("past alleen aan als er ook een vier-koloms breakpoint is", () => {
    const plain = '<ul class="grid grid-cols-2 gap-4">';
    expect(repairDenseTwoColumnProofGridsInHtml(plain)).toBe(plain);
  });

  it("laat niet-grid classes met rust", () => {
    const html = '<p class="flex flex-col gap-2">';
    expect(repairDenseTwoColumnProofGridsInHtml(html)).toBe(html);
  });
});

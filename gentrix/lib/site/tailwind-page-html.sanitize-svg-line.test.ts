import { describe, expect, it } from "vitest";
import { buildGentrixMenuIconToggle } from "@/lib/ai/generate-site-postprocess";
import { sanitizeTailwindFragment } from "@/lib/site/tailwind-page-html";

describe("sanitizeTailwindFragment SVG line geometry", () => {
  it("preserves x1/y1/x2/y2 on line elements so menu toggle stripes stay visible", () => {
    const html = `<button type="button">${buildGentrixMenuIconToggle("mobileMenuOpen")}</button>`;
    const out = sanitizeTailwindFragment(html);
    expect(out).toContain('x1="4"');
    expect(out).toContain('y1="7"');
    expect(out).toContain('x2="20"');
    expect(out).toContain('y2="7"');
    expect((out.match(/<line\b[^>]*\bx1=/g) ?? []).length).toBeGreaterThanOrEqual(3);
  });
});

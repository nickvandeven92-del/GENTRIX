import { describe, expect, it } from "vitest";
import { normalizeStudioHeroDomIdsAndRootMotion } from "@/lib/ai/generate-site-postprocess";

describe("normalizeStudioHeroDomIdsAndRootMotion", () => {
  it("verwijdert data-aos en data-animation van de eerste <section id=\"hero\"> open-tag", () => {
    const html =
      `<section id="hero" class="relative min-h-screen" data-aos="fade-up" data-aos-duration="800" data-animation="fade-up">` +
      `<div class="p-4">x</div></section>`;
    const out = normalizeStudioHeroDomIdsAndRootMotion(html);
    expect(out).toContain('id="hero"');
    expect(out).not.toContain("data-aos");
    expect(out).not.toContain("data-animation");
  });

  it("verwijdert id=hero van de tweede section en markeert duplicaat", () => {
    const html =
      `<section id="hero" class="a"><div>een</div></section>` + `<section id="hero" class="b"><div>twee</div></section>`;
    const out = normalizeStudioHeroDomIdsAndRootMotion(html);
    expect(out.match(/\bid\s*=\s*["']hero["']/gi)?.length ?? 0).toBe(1);
    expect(out).toContain("data-gentrix-secondary-hero");
  });

  it("laat niet-hero sections ongemoeid", () => {
    const html = `<section id="features" data-aos="fade-up"><p>x</p></section>`;
    expect(normalizeStudioHeroDomIdsAndRootMotion(html)).toBe(html);
  });
});

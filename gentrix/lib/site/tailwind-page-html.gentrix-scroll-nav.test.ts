import { describe, expect, it } from "vitest";
import type { TailwindSection } from "@/lib/ai/tailwind-sections-schema";
import { buildTailwindIframeSrcDoc } from "@/lib/site/tailwind-page-html";

const simpleSections: TailwindSection[] = [
  {
    id: "hero",
    sectionName: "Hero",
    html: `<section id="hero"><header class="sticky top-0 z-50 bg-white/90 border-b"><nav><a href="#hero">Home</a></nav></header><div class="h-[120vh]">Hero</div></section>`,
  },
];

describe("buildTailwindIframeSrcDoc gentrix scroll nav", () => {
  it("skips AOS/GSAP libraries when output does not use them", () => {
    const doc = buildTailwindIframeSrcDoc(simpleSections, null, { publishedSlug: "home" });
    expect(doc).toMatch(/<link rel="icon"[^>]+data:image\/svg\+xml/);
    expect(doc).not.toContain("unpkg.com/aos@2.3.4/dist/aos.css");
    expect(doc).not.toContain("unpkg.com/aos@2.3.4/dist/aos.js");
    expect(doc).not.toContain("cdn.jsdelivr.net/npm/gsap@");
  });

  it("keeps AOS/GSAP runtime when page markup or user JS references them", () => {
    const withAosSection: TailwindSection[] = [
      {
        id: "hero",
        sectionName: "Hero",
        html: `<section id="hero"><div data-aos="fade-up">Hero</div></section>`,
      },
    ];
    const withAos = buildTailwindIframeSrcDoc(withAosSection, null, { publishedSlug: "home" });
    expect(withAos).toContain("unpkg.com/aos@2.3.4/dist/aos.css");
    expect(withAos).toContain("unpkg.com/aos@2.3.4/dist/aos.js");

    const withGsap = buildTailwindIframeSrcDoc(simpleSections, null, {
      publishedSlug: "home",
      userJs: "gsap.to('.hero', { y: 10 });",
    });
    expect(withGsap).toContain("cdn.jsdelivr.net/npm/gsap@");
    expect(withGsap).toContain("ScrollTrigger.min.js");
  });

  it("enables gentrix scroll-nav fallback for home slug", () => {
    const doc = buildTailwindIframeSrcDoc(simpleSections, null, { publishedSlug: "home" });
    expect(doc).toMatch(/<html[^>]*\bdata-gentrix-scroll-nav-fallback="1"/);
    expect(doc).toMatch(/data-gentrix-scroll-nav/);
    expect(doc).toMatch(/rgb\(8 16 34 \/ 0\.44\)/);
  });

  it("does not enable gentrix scroll-nav fallback for non-home slugs", () => {
    const doc = buildTailwindIframeSrcDoc(simpleSections, null, { publishedSlug: "acme-demo" });
    expect(doc).not.toMatch(/<html[^>]*\bdata-gentrix-scroll-nav-fallback="1"/);
  });

  it("keeps fixed nav from pushing hero down for home slug", () => {
    const doc = buildTailwindIframeSrcDoc(simpleSections, null, { publishedSlug: "home" });
    expect(doc).toMatch(/html\s*\{\s*scroll-padding-top:\s*0(?:rem)?;/);
  });

  it("adds immediate top-state transparency fallback rule for home slug", () => {
    const doc = buildTailwindIframeSrcDoc(simpleSections, null, { publishedSlug: "home" });
    expect(doc).toContain('html[data-gentrix-scroll-nav-fallback="1"] header[class*="sticky"][class*="top-0"]');
    expect(doc).toContain("background-color: transparent !important;");
  });

  it("keeps scroll-overlay bookkeeping but applies chrome purely on scrolled state", () => {
    const doc = buildTailwindIframeSrcDoc(simpleSections, null, { publishedSlug: "home" });
    expect(doc).toContain("scrollIdleTimer=0");
    expect(doc).toContain("touchGentrixScrolling()");
    expect(doc).toContain("setGentrixScrolling(false)");
    expect(doc).toContain("data-gentrix-scrolling");
    expect(doc).toContain("data-gentrix-scroll-overlay");
    // Frosted chrome mag niet langer afhangen van de `data-gentrix-scrolling`-attribuut — dat caused flicker:
    // zodra de idle-timer de scrolling-flag op "0" zette werd de navbar weer volledig transparant over de content.
    expect(doc).not.toMatch(
      /\[data-gentrix-scroll-(?:nav|overlay)="1"\]\[data-gentrix-scrolled="1"\]\[data-gentrix-scrolling="1"\]/,
    );
  });
});

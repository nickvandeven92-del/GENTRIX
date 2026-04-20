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
  it("enables gentrix scroll-nav fallback for home slug", () => {
    const doc = buildTailwindIframeSrcDoc(simpleSections, null, { publishedSlug: "home" });
    expect(doc).toMatch(/<html[^>]*\bdata-gentrix-scroll-nav-fallback="1"/);
    expect(doc).toMatch(/data-gentrix-scroll-nav/);
    expect(doc).toMatch(/color:\s*rgb\(15 23 42\)\s*!important/);
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

  it("includes idle timeout logic so scrolled chrome clears after scrolling stops", () => {
    const doc = buildTailwindIframeSrcDoc(simpleSections, null, { publishedSlug: "home" });
    expect(doc).toContain("scrollIdleTimer=0");
    expect(doc).toContain("touchGentrixScrolling()");
    expect(doc).toContain("setGentrixScrolling(false)");
  });
});

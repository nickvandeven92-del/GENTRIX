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

describe("buildTailwindIframeSrcDoc mobile horizontal lock", () => {
  it("injects horizontal x-lock css for studio mobile editor iframe", () => {
    const doc = buildTailwindIframeSrcDoc(simpleSections, null, { studioMobileEditorFrame: true });
    expect(doc).toContain('html[data-gentrix-studio-mobile="1"][data-gentrix-studio-iframe="1"]');
    expect(doc).toContain("overflow-x: clip !important;");
    expect(doc).toContain("overscroll-behavior-x: none !important;");
    expect(doc).toContain("touch-action: pan-y !important;");
  });

  it("does not inject mobile x-lock when studio mobile editor flag is off", () => {
    const doc = buildTailwindIframeSrcDoc(simpleSections, null, { studioMobileEditorFrame: false });
    expect(doc).not.toContain('html[data-gentrix-studio-mobile="1"][data-gentrix-studio-iframe="1"]');
    expect(doc).not.toContain('html[data-gentrix-studio-mobile="1"][data-gentrix-studio-iframe="1"] body');
  });

  it("injects published home mobile x-lock to prevent sideways panning", () => {
    const doc = buildTailwindIframeSrcDoc(simpleSections, null, { publishedSlug: "home" });
    expect(doc).toContain('html[data-gentrix-scroll-nav-fallback="1"]');
    expect(doc).toContain("overflow-x: clip !important;");
    expect(doc).toContain("overflow-x: hidden !important;");
    expect(doc).toContain("touch-action: pan-y !important;");
  });
});

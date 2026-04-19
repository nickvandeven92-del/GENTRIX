import { describe, expect, it } from "vitest";
import {
  enforceStickyPrimaryTailwindChromeAcrossSections,
  injectStickyPrimaryChromeOnceInHtml,
  postProcessClaudeTailwindPage,
} from "@/lib/ai/generate-site-postprocess";
import type { ClaudeTailwindPageOutput } from "@/lib/ai/tailwind-sections-schema";

describe("injectStickyPrimaryChromeOnceInHtml", () => {
  it("voegt sticky top-0 z-50 toe op eerste header zonder position", () => {
    const html = '<header class="bg-white border-b"><div>nav</div></header>';
    const { html: out, applied } = injectStickyPrimaryChromeOnceInHtml(html);
    expect(applied).toBe(true);
    expect(out).toContain("sticky");
    expect(out).toContain("top-0");
    expect(out).toContain("z-50");
  });

  it("slaat absolute nav over en past volgende header aan", () => {
    const html = '<nav class="absolute inset-x-0 top-0 z-20"></nav><header class="bg-white"></header>';
    const { html: out, applied } = injectStickyPrimaryChromeOnceInHtml(html);
    expect(applied).toBe(true);
    expect(out).toContain('<nav class="absolute');
    expect(out).toMatch(/<header[^>]*\bsticky\b[^>]*\btop-0\b[^>]*\bz-50\b/);
  });

  it("laat volledige sticky+top-0+z ongemoeid", () => {
    const html = '<header class="sticky top-0 z-50 bg-white"></header>';
    const { html: out, applied } = injectStickyPrimaryChromeOnceInHtml(html);
    expect(applied).toBe(true);
    expect(out).toBe(html);
  });

  it("vult z-50 bij sticky top-0 zonder z", () => {
    const html = '<header class="sticky top-0 bg-white"></header>';
    const { html: out } = injectStickyPrimaryChromeOnceInHtml(html);
    expect(out).toMatch(/z-50/);
  });

  it("vervangt fixed door sticky op primaire header", () => {
    const html = '<header class="fixed top-0 inset-x-0 z-40 border-b bg-white/90"></header>';
    const { html: out } = injectStickyPrimaryChromeOnceInHtml(html);
    expect(out).toMatch(/\bsticky\b/);
    expect(out).not.toMatch(/\bfixed\b/);
    expect(out).toContain("z-40");
  });
});

describe("enforceStickyPrimaryTailwindChromeAcrossSections", () => {
  it("past alleen de eerste sectie met chrome aan", () => {
    const sections = [
      { id: "hero", html: '<section id="hero"><div>geen header</div></section>' },
      { id: "features", html: '<section><header class="border-b bg-white"><span>nav</span></header></section>' },
      { id: "footer", html: '<section><header class="bg-black"><span>footer</span></header></section>' },
    ];
    const out = enforceStickyPrimaryTailwindChromeAcrossSections(sections);
    expect(out[0]!.html).not.toMatch(/\bsticky\b/);
    expect(out[1]!.html).toMatch(/\bsticky\b/);
    expect(out[2]!.html).not.toMatch(/\bsticky\b/);
  });
});

describe("postProcessClaudeTailwindPage sticky nav", () => {
  it("zoekt eerste header over meerdere secties", () => {
    const page: ClaudeTailwindPageOutput = {
      config: {
        style: "tailwind",
        theme: { primary: "#0f172a", accent: "#0d9488", secondary: "#64748b" },
        font: "system-ui, sans-serif",
      },
      sections: [
        { id: "hero", html: '<section id="hero"><div class="x">no header</div></section>' },
        {
          id: "features",
          html: '<section id="features"><header class="bg-white border-b"><span>nav</span></header></section>',
        },
      ],
    };
    const out = postProcessClaudeTailwindPage(page);
    expect(out.sections[1]!.html).toMatch(/\bsticky\b/);
  });
});

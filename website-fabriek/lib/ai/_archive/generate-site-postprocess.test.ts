import { describe, expect, it } from "vitest";
import { injectStickyPrimaryChromeOnce, postProcessClaudeTailwindPage } from "@/lib/ai/generate-site-postprocess";
import type { ClaudeTailwindPageOutput } from "@/lib/ai/tailwind-sections-schema";

describe("injectStickyPrimaryChromeOnce", () => {
  it("voegt sticky toe op eerste header zonder position", () => {
    const html = '<header class="bg-white border-b"><div>nav</div></header>';
    expect(injectStickyPrimaryChromeOnce(html)).toContain("sticky");
    expect(injectStickyPrimaryChromeOnce(html)).toContain("top-0");
  });

  it("slaat absolute nav over en plakt sticky op volgende header", () => {
    const html = '<nav class="absolute inset-x-0 top-0 z-20"></nav><header class="bg-white"></header>';
    const out = injectStickyPrimaryChromeOnce(html);
    expect(out).toContain('<nav class="absolute');
    expect(out).toMatch(/<header[^>]*sticky top-0 z-50/);
  });

  it("slaat over als sticky al gezet is", () => {
    const html = '<header class="sticky top-0 bg-white"></header>';
    expect(injectStickyPrimaryChromeOnce(html)).toBe(html);
  });
});

describe("postProcessClaudeTailwindPage sticky", () => {
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
    expect(out.sections[1]!.html).toMatch(/sticky/);
  });
});

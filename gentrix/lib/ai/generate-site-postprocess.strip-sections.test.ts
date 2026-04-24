import { describe, expect, it } from "vitest";
import {
  postProcessClaudeTailwindPage,
  shouldStripGeneratorTickerOrIntermediateCtaSectionId,
} from "@/lib/ai/generate-site-postprocess";
import type { ClaudeTailwindPageOutput } from "@/lib/ai/tailwind-sections-schema";

const baseConfig: ClaudeTailwindPageOutput["config"] = {
  style: "test",
  theme: {
    primary: "#111111",
    accent: "#222222",
    primaryLight: "#333333",
    primaryMain: "#444444",
    primaryDark: "#555555",
  },
  font: "Inter, sans-serif",
};

describe("shouldStripGeneratorTickerOrIntermediateCtaSectionId", () => {
  it("markeert typische ticker- en tussen-CTA-sectie-id's", () => {
    expect(shouldStripGeneratorTickerOrIntermediateCtaSectionId("marquee-strip")).toBe(true);
    expect(shouldStripGeneratorTickerOrIntermediateCtaSectionId("cta-band")).toBe(true);
    expect(shouldStripGeneratorTickerOrIntermediateCtaSectionId("features")).toBe(false);
    expect(shouldStripGeneratorTickerOrIntermediateCtaSectionId("footer")).toBe(false);
  });
});

describe("postProcessClaudeTailwindPage strip", () => {
  it("verwijdert marquee-strip en cta-band rijen vóór overige postprocess", () => {
    const page: ClaudeTailwindPageOutput = {
      config: baseConfig,
      sections: [
        { id: "hero", html: '<section id="hero" class="min-h-[72vh]">H</section>' },
        { id: "marquee-strip", html: '<section id="marquee-strip">Ticker</section>' },
        { id: "cta-band", html: '<section id="cta-band">CTA</section>' },
        { id: "footer", html: '<section id="footer">F</section>' },
      ],
    };
    const out = postProcessClaudeTailwindPage(page);
    expect(out.sections.map((s) => s.id)).toEqual(["hero", "footer"]);
  });

  it("haalt inline studio-marquee uit sectie-HTML", () => {
    const page: ClaudeTailwindPageOutput = {
      config: baseConfig,
      sections: [
        {
          id: "hero",
          html: `<section id="hero" class="min-h-[72vh]"><div class="studio-marquee w-full"><div class="studio-marquee-track flex"><span>A</span><span>A</span></div></div><p>Rest</p></section>`,
        },
      ],
    };
    const out = postProcessClaudeTailwindPage(page);
    expect(out.sections[0].html).toContain("Rest");
    expect(out.sections[0].html).not.toContain("studio-marquee");
    expect(out.sections[0].html).not.toContain("studio-marquee-track");
  });

  it("zet fetchpriority op eerste grote hero-afbeelding", () => {
    const page: ClaudeTailwindPageOutput = {
      config: baseConfig,
      sections: [
        {
          id: "hero",
          html:
            '<section id="hero" class="relative"><img class="w-8 h-8" src="/logo.png" alt=""/><img class="absolute inset-0 h-full w-full object-cover" src="/hero.jpg" alt=""/></section>',
        },
      ],
    };
    const out = postProcessClaudeTailwindPage(page);
    expect(out.sections[0].html).toMatch(/object-cover[^>]*fetchpriority="high"/);
    expect(out.sections[0].html).not.toMatch(/w-8 h-8[^>]*fetchpriority/);
  });

  it("zet Supabase object/public hero-src om naar render/image", () => {
    const page: ClaudeTailwindPageOutput = {
      config: baseConfig,
      sections: [
        {
          id: "hero",
          html: `<section id="hero"><img class="w-full h-full object-cover" src="https://abcdxyz.supabase.co/storage/v1/object/public/site-assets/p/hero.jpg" alt=""/></section>`,
        },
      ],
    };
    const out = postProcessClaudeTailwindPage(page);
    expect(out.sections[0].html).toContain("/storage/v1/render/image/public/");
    expect(out.sections[0].html).not.toContain("/storage/v1/object/public/");
    expect(out.sections[0].html).toMatch(/srcset="/);
    expect(out.sections[0].html).toMatch(/sizes="100vw"/);
  });

  it("promoot hero bg-[url(supabase)] naar img met srcset in volledige postprocess", () => {
    const page: ClaudeTailwindPageOutput = {
      config: baseConfig,
      sections: [
        {
          id: "hero",
          html: `<section id="hero" class="relative min-h-screen bg-[url('https://xy.supabase.co/storage/v1/object/public/site-assets/h/photo.jpg')] bg-cover text-white"><p>Hello</p></section>`,
        },
      ],
    };
    const out = postProcessClaudeTailwindPage(page);
    expect(out.sections[0].html).toContain("<img ");
    expect(out.sections[0].html).toMatch(/srcset="/);
    expect(out.sections[0].html).not.toContain("bg-[url(");
  });
});

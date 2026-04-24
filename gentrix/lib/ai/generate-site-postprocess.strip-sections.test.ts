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
    expect(out.sections.map((s) => s.id)).toEqual(["hero", "footer", "floating-whatsapp"]);
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
});

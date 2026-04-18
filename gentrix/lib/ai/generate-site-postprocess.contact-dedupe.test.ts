import { describe, expect, it } from "vitest";
import {
  dedupeExcessTelAndWhatsAppAnchorsAcrossSections,
  postProcessClaudeTailwindPage,
} from "@/lib/ai/generate-site-postprocess";
import type { ClaudeTailwindPageOutput } from "@/lib/ai/tailwind-sections-schema";

const minimalConfig: ClaudeTailwindPageOutput["config"] = {
  style: "test",
  font: "Inter, sans-serif",
  theme: { primary: "#000000", accent: "#c9a227" },
};

describe("dedupeExcessTelAndWhatsAppAnchorsAcrossSections", () => {
  it("drie identieke tel-ankers in één sectie: demoteert het middelste", () => {
    const out = dedupeExcessTelAndWhatsAppAnchorsAcrossSections([
      {
        id: "block",
        html: `<a href="tel:+31612345678">x</a><a href="tel:+31612345678">y</a><a href="tel:+31612345678">z</a>`,
      },
    ]);
    expect((out[0].html.match(/href="tel:/gi) ?? []).length).toBe(2);
    expect(out[0].html).toContain("<span");
  });

  it("behoudt eerste en laatste tel-link; demoteert tussenliggende naar span", () => {
    const sections = dedupeExcessTelAndWhatsAppAnchorsAcrossSections([
      {
        id: "hero",
        html: `<section id="hero"><a href="tel:+31612345678" class="btn">A</a></section>`,
      },
      {
        id: "cta",
        html: `<section id="cta"><a href="tel:+31612345678" class="btn">B</a></section>`,
      },
      {
        id: "footer",
        html: `<section id="footer"><a href="tel:+31612345678" class="btn">C</a></section>`,
      },
    ]);
    const joined = sections.map((s) => s.html).join("\n");
    expect((joined.match(/href="tel:/gi) ?? []).length).toBe(2);
    expect(joined).toContain("<span");
    expect(joined).not.toMatch(/<span[^>]*href=/i);
  });

  it("demoteert overtollige wa.me-links op dezelfde manier", () => {
    const sections = dedupeExcessTelAndWhatsAppAnchorsAcrossSections([
      { id: "a", html: `<a href="https://wa.me/31612345678">1</a>` },
      { id: "b", html: `<a href="https://wa.me/31612345678?text=hi">2</a>` },
      { id: "c", html: `<a href="https://wa.me/31612345678">3</a>` },
    ]);
    const joined = sections.map((s) => s.html).join("\n");
    expect((joined.match(/href="https:\/\/wa\.me\//gi) ?? []).length).toBe(2);
  });

  it("normaliseert tel-formaat: +31 6 … en +316… tellen als hetzelfde nummer", () => {
    const sections = dedupeExcessTelAndWhatsAppAnchorsAcrossSections([
      { id: "hero", html: `<a href="tel:+31612345678">A</a>` },
      { id: "cta", html: `<a href="tel:+31 6 12345678">B</a>` },
      { id: "footer", html: `<a href="tel:+31612345678">C</a>` },
    ]);
    const joined = sections.map((s) => s.html).join("\n");
    expect((joined.match(/href="tel:/gi) ?? []).length).toBe(2);
    expect(joined).toContain("<span");
  });

  it("twee keer hetzelfde nummer: ongewijzigd", () => {
    const rows = [
      { id: "hero", html: `<a href="tel:+31611111111">x</a>` },
      { id: "footer", html: `<a href="tel:+31611111111">y</a>` },
    ];
    const out = dedupeExcessTelAndWhatsAppAnchorsAcrossSections(rows);
    expect(out[0].html).toBe(rows[0].html);
    expect(out[1].html).toBe(rows[1].html);
  });

  it("draait mee in postProcessClaudeTailwindPage", () => {
    const page: ClaudeTailwindPageOutput = {
      config: minimalConfig,
      sections: [
        { id: "hero", html: `<section id="hero"><a href="tel:+31699999999">1</a></section>` },
        { id: "mid", html: `<section id="mid"><a href="tel:+31699999999">2</a></section>` },
        { id: "footer", html: `<section id="footer"><a href="tel:+31699999999">3</a></section>` },
      ],
    };
    const out = postProcessClaudeTailwindPage(page);
    const joined = out.sections.map((s) => s.html).join("\n");
    expect((joined.match(/href="tel:/gi) ?? []).length).toBe(2);
  });
});

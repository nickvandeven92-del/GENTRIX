import { describe, expect, it } from "vitest";
import {
  collectHtmlElementIds,
  postProcessClaudeTailwindPage,
  repairSamePagePathHrefsInHtml,
} from "@/lib/ai/generate-site-postprocess";
import type { ClaudeTailwindPageOutput } from "@/lib/ai/tailwind-sections-schema";

describe("repairSamePagePathHrefsInHtml", () => {
  it("rewrites /site/slug without hash to #top when top exists", () => {
    const valid = new Set(["hero", "top", "contact"]);
    const html = `<a href="/site/gentrix" class="x">x</a>`;
    expect(repairSamePagePathHrefsInHtml(html, valid)).toContain('href="#top"');
  });

  it("rewrites absolute /site/slug#faq to #faq when faq exists", () => {
    const valid = new Set(["hero", "faq", "top"]);
    const html = `<a href="https://www.gentrix.nl/site/gentrix#faq">FAQ</a>`;
    expect(repairSamePagePathHrefsInHtml(html, valid)).toContain('href="#faq"');
  });

  it("maps unknown hash on /site/ to a fallback id present in validIds", () => {
    const valid = new Set(["hero", "contact", "top"]);
    const html = `<a href="/site/x#onbekend">x</a>`;
    const out = repairSamePagePathHrefsInHtml(html, valid);
    expect(out).toMatch(/href="#(hero|contact|top)"/);
    expect(out).not.toContain("#onbekend");
  });

  it("rewrites single-segment path when id exists", () => {
    const valid = new Set(["diensten", "hero", "top"]);
    const html = `<a href="/diensten">Diensten</a>`;
    expect(repairSamePagePathHrefsInHtml(html, valid)).toContain('href="#diensten"');
  });

  it("does not rewrite /portal/ links", () => {
    const valid = new Set(["hero", "top"]);
    const html = `<a href="/portal/gentrix">Portaal</a>`;
    expect(repairSamePagePathHrefsInHtml(html, valid)).toBe(html);
  });

  it("does not touch mailto", () => {
    const valid = new Set(["contact"]);
    const html = `<a href="mailto:info@voorbeeld.nl">Mail</a>`;
    expect(repairSamePagePathHrefsInHtml(html, valid)).toBe(html);
  });
});

describe("collectHtmlElementIds", () => {
  it("collects ids from markup", () => {
    const ids = collectHtmlElementIds(`<section id="hero"><div id="sub"></div></section>`);
    expect(ids.has("hero")).toBe(true);
    expect(ids.has("sub")).toBe(true);
  });
});

describe("postProcessClaudeTailwindPage path href integration", () => {
  it("normalizes duplicate /site/slug links across sections", () => {
    const page: ClaudeTailwindPageOutput = {
      config: {
        style: "tailwind",
        theme: { primary: "#0f172a", accent: "#0d9488", secondary: "#64748b" },
        font: "system-ui, sans-serif",
      },
      sections: [
        {
          id: "hero",
          html: `<header><nav><a href="https://example.com/site/foo">Home</a><a href="/site/foo#diensten">D</a></nav></header>`,
        },
        {
          id: "diensten",
          html: `<section class="w-full"><h2>Diensten</h2></section>`,
        },
      ],
    };
    const out = postProcessClaudeTailwindPage(page);
    const joined = out.sections.map((s) => s.html).join("\n");
    expect(joined).toContain('href="#top"');
    expect(joined).toContain('href="#diensten"');
  });
});

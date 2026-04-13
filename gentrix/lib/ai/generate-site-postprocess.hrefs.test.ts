import { describe, expect, it } from "vitest";
import {
  collectHtmlElementIds,
  ensureClaudeMarketingSiteJsonHasContactSections,
  fixAlpineNavToggleDefaultsInXData,
  normalizeClaudeSectionArraysInParsedJson,
  postProcessClaudeTailwindPage,
  postProcessTailwindSectionsForStreamingPreview,
  repairInternalLinksInHtml,
  repairSamePagePathHrefsInHtml,
  stripDecorativeScrollCueMarkup,
} from "@/lib/ai/generate-site-postprocess";
import { validateMarketingSiteHardRules } from "@/lib/ai/validate-marketing-site-output";
import {
  claudeTailwindMarketingSiteOutputSchema,
  claudeTailwindPageOutputSchema,
  mapClaudeOutputToSections,
} from "@/lib/ai/tailwind-sections-schema";
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

  it("rewrites single-segment path when id matches after slug-normalize (case / spacing)", () => {
    const valid = new Set(["over-ons", "hero", "top"]);
    expect(repairSamePagePathHrefsInHtml(`<a href="/Over-Ons">Over ons</a>`, valid)).toContain('href="#over-ons"');
    expect(repairSamePagePathHrefsInHtml(`<a href="/over%20ons">Over ons</a>`, valid)).toContain('href="#over-ons"');
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

  const marketingCross = {
    marketingPageKeys: new Set(["wat-wij-doen", "werkwijze", "over-ons", "faq"]),
    contactOnDedicatedSubpage: true,
  } as const;

  it("rewrites single-segment /over-ons to studio site base when key exists in marketingPages", () => {
    const valid = new Set(["hero", "top"]);
    const html = `<a href="/over-ons">Over ons</a>`;
    const out = repairSamePagePathHrefsInHtml(html, valid, marketingCross);
    expect(out).toBe(`<a href="__STUDIO_SITE_BASE__/over-ons">Over ons</a>`);
  });

  it("rewrites bogus /site/slug/subpath to home base when subpath is not a marketing key", () => {
    const valid = new Set(["hero", "top"]);
    const html = `<a href="/site/demo/verzonnen-pagina">X</a>`;
    const out = repairSamePagePathHrefsInHtml(html, valid, marketingCross);
    expect(out).toBe(`<a href="__STUDIO_SITE_BASE__">X</a>`);
  });

  it("leaves /site/slug/wat-wij-doen unchanged when key is valid", () => {
    const valid = new Set(["hero", "top"]);
    const html = `<a href="/site/demo/wat-wij-doen">Diensten</a>`;
    expect(repairSamePagePathHrefsInHtml(html, valid, marketingCross)).toBe(html);
  });
});

describe("repairInternalLinksInHtml marketing cross-page", () => {
  const marketingCross = {
    marketingPageKeys: new Set(["wat-wij-doen", "over-ons", "faq"]),
    contactOnDedicatedSubpage: true,
  } as const;

  it("maps #over-ons to __STUDIO_SITE_BASE__/over-ons when that page exists", () => {
    const valid = new Set(["hero", "top"]);
    const html = `<a href="#over-ons">Over ons</a>`;
    expect(repairInternalLinksInHtml(html, valid, marketingCross)).toBe(
      `<a href="__STUDIO_SITE_BASE__/over-ons">Over ons</a>`,
    );
  });

  it("maps #contact to contact placeholder on landing without contact section", () => {
    const valid = new Set(["hero", "top"]);
    const html = `<a href="#contact">Contact</a>`;
    expect(repairInternalLinksInHtml(html, valid, marketingCross)).toBe(
      `<a href="__STUDIO_CONTACT_PATH__">Contact</a>`,
    );
  });

  it("keeps #contact when contact id exists on same page", () => {
    const valid = new Set(["hero", "contact", "top"]);
    const html = `<a href="#contact">Contact</a>`;
    expect(repairInternalLinksInHtml(html, valid, marketingCross)).toBe(html);
  });
});

describe("collectHtmlElementIds", () => {
  it("collects ids from markup", () => {
    const ids = collectHtmlElementIds(`<section id="hero"><div id="sub"></div></section>`);
    expect(ids.has("hero")).toBe(true);
    expect(ids.has("sub")).toBe(true);
  });
});

describe("fixAlpineNavToggleDefaultsInXData", () => {
  it("zet open: true om naar open: false in dubbele aanhalingstekens", () => {
    const html = `<header x-data="{ open: true }" class="x"><button @click="open=!open"></button></header>`;
    expect(fixAlpineNavToggleDefaultsInXData(html)).toContain('x-data="{ open: false }"');
  });

  it("past menuOpen en compound state aan", () => {
    const html = `<div x-data='{ menuOpen: true, x: 1 }'>`;
    const out = fixAlpineNavToggleDefaultsInXData(html);
    expect(out).toContain("menuOpen: false");
    expect(out).toContain("x: 1");
  });

  it("past drawerOpen: true aan", () => {
    const html = `<div x-data="{ drawerOpen: true }">`;
    expect(fixAlpineNavToggleDefaultsInXData(html)).toContain("drawerOpen: false");
  });
});

describe("stripDecorativeScrollCueMarkup", () => {
  it("verwijdert span met alleen SCROLL", () => {
    const html = `<div class="flex flex-col"><span class="text-xs uppercase tracking-widest">SCROLL</span></div>`;
    expect(stripDecorativeScrollCueMarkup(html)).not.toContain("SCROLL");
  });

  it("laat lopende tekst met SCROLL staan", () => {
    const html = `<p class="prose">Je kunt hier verder SCROLLEN voor meer.</p>`;
    expect(stripDecorativeScrollCueMarkup(html)).toContain("SCROLLEN");
  });
});

describe("postProcessTailwindSectionsForStreamingPreview", () => {
  it("past fixAlpine toe op streaming-secties", () => {
    const out = postProcessTailwindSectionsForStreamingPreview(
      [{ id: "hero", html: `<div x-data="{ open: true }"></div>`, sectionName: "Hero" }],
      null,
    );
    expect(out[0]?.html).toContain("open: false");
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

describe("ensureClaudeMarketingSiteJsonHasContactSections", () => {
  const minimalConfig = {
    style: "Professioneel, rustig",
    theme: { primary: "#1e3a2f", accent: "#c4a574" },
    font: "system-ui, sans-serif",
  };

  it("injects contactSections when undefined and output passes marketing schema + hard rules", () => {
    const raw = {
      config: minimalConfig,
      sections: [{ id: "hero", html: '<section id="hero" class="min-h-[72vh] md:min-h-[80vh] p-8">H</section>' }],
    };
    const patched = ensureClaudeMarketingSiteJsonHasContactSections(raw);
    const validated = claudeTailwindMarketingSiteOutputSchema.safeParse(patched);
    expect(validated.success).toBe(true);
    if (!validated.success) return;
    const landing = mapClaudeOutputToSections({ config: validated.data.config, sections: validated.data.sections });
    const contact = mapClaudeOutputToSections({
      config: validated.data.config,
      sections: validated.data.contactSections,
    });
    const errors = validateMarketingSiteHardRules(landing.sections, contact.sections);
    expect(errors).toEqual([]);
    expect(validated.data.contactSections[0]?.html).toMatch(/<form\b/i);
    expect(validated.data.contactSections[0]?.html).toContain("__STUDIO_CONTACT_PATH__");
  });

  it("leaves valid contactSections unchanged", () => {
    const row = {
      id: "contact",
      html: '<section id="contact"><form method="post"><input name="x"/></form></section>',
    };
    const raw = {
      config: minimalConfig,
      sections: [{ id: "hero", html: '<section id="hero" class="min-h-[72vh] md:min-h-[80vh]">H</section>' }],
      contactSections: [row],
    };
    const patched = ensureClaudeMarketingSiteJsonHasContactSections(raw);
    expect(patched).toBe(raw);
  });

  it("replaces contactSections when there is no form", () => {
    const raw = {
      config: minimalConfig,
      sections: [{ id: "hero", html: '<section id="hero" class="min-h-[72vh] md:min-h-[80vh] p-8">H</section>' }],
      contactSections: [{ id: "contact", html: '<section id="contact"><p>Alleen tekst</p></section>' }],
    };
    const patched = ensureClaudeMarketingSiteJsonHasContactSections(raw) as Record<string, unknown>;
    const cs = patched.contactSections as { html: string }[];
    expect(cs[0]?.html).toMatch(/<form\b/i);
  });
});

describe("normalizeClaudeSectionArraysInParsedJson", () => {
  const minimalConfig = {
    style: "Professioneel, rustig",
    theme: { primary: "#1e3a2f", accent: "#c4a574" },
    font: "system-ui, sans-serif",
  };

  it("flattens nested marketingPages.faq rows and drops invalid objects before schema parse", () => {
    const raw = {
      config: minimalConfig,
      sections: [{ id: "hero", html: '<section id="hero" class="min-h-[72vh] md:min-h-[80vh] p-8">H</section>' }],
      contactSections: [
        {
          id: "contact",
          html: '<section id="contact"><form method="post"><input name="x"/></form></section>',
        },
      ],
      marketingPages: {
        faq: [
          { id: "faq-a", html: '<section id="faq-a">A</section>' },
          [
            { id: "faq-b", html: '<section id="faq-b">B</section>' },
            { id: "faq-c", html: '<section id="faq-c">C</section>' },
          ],
          { id: "faq-d", html: '<section id="faq-d">D</section>' },
          {},
        ],
      },
    };
    const normalized = normalizeClaudeSectionArraysInParsedJson(raw) as Record<string, unknown>;
    const faq = (normalized.marketingPages as Record<string, { id: string }[]>).faq;
    expect(faq.map((r) => r.id)).toEqual(["faq-a", "faq-b", "faq-c", "faq-d"]);

    const patched = ensureClaudeMarketingSiteJsonHasContactSections(normalized);
    const validated = claudeTailwindMarketingSiteOutputSchema.safeParse(patched);
    expect(validated.success).toBe(true);
  });

  it("flattens nested landing sections for one-pager schema", () => {
    const raw = {
      config: minimalConfig,
      sections: [
        { id: "hero", html: "<section id=\"hero\">H</section>" },
        [{ id: "mid", html: "<section id=\"mid\">M</section>" }],
      ],
    };
    const normalized = normalizeClaudeSectionArraysInParsedJson(raw) as { sections: { id: string }[] };
    expect(normalized.sections.map((s) => s.id)).toEqual(["hero", "mid"]);
    const validated = claudeTailwindPageOutputSchema.safeParse(normalized);
    expect(validated.success).toBe(true);
  });
});

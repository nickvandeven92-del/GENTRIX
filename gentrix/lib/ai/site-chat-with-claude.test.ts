import { describe, expect, it } from "vitest";
import {
  normalizeSiteChatModelJsonValue,
  processSiteChatFromModelText,
  resolveSiteChatTargetIndices,
} from "@/lib/ai/site-chat-with-claude";
import type { SiteChatTurn } from "@/lib/ai/site-chat-with-claude";
import type { TailwindSection } from "@/lib/ai/tailwind-sections-schema";

const twoSections: TailwindSection[] = [
  { sectionName: "Hero", html: "<section id=\"hero\">a</section>" },
  { sectionName: "Footer", html: "<section id=\"footer\">b</section>" },
];

describe("resolveSiteChatTargetIndices", () => {
  it("geeft null zonder match (volledige site-context)", () => {
    const messages: SiteChatTurn[] = [{ role: "user", content: "Algemene vraag over strategie" }];
    expect(resolveSiteChatTargetIndices(messages, twoSections, null)).toBeNull();
  });

  it("inferreert uit sectienaam in het laatste bericht", () => {
    const messages: SiteChatTurn[] = [{ role: "user", content: "Pas de footer tekst aan" }];
    expect(resolveSiteChatTargetIndices(messages, twoSections, null)).toEqual([1]);
  });

  it("gebruikt expliciete API-indices vóór inferentie", () => {
    const messages: SiteChatTurn[] = [{ role: "user", content: "Pas de footer tekst aan" }];
    expect(resolveSiteChatTargetIndices(messages, twoSections, [0])).toEqual([0]);
  });
});

describe("processSiteChatFromModelText scoped validation", () => {
  it("weigert sectionUpdates buiten toegestane indices", () => {
    const json = JSON.stringify({
      reply: "Ik pas toe.",
      sectionUpdates: [
        { index: 0, html: "<section>x</section>" },
        { index: 1, html: "<section>y</section>" },
      ],
    });
    const r = processSiteChatFromModelText(json, twoSections, null, null, [0]);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain("sectie 2");
      expect(r.error).not.toMatch(/invalid_type|Zod|JSON voldoet/i);
    }
  });

  it("accepteert updates binnen scope", () => {
    const json = JSON.stringify({
      reply: "Alleen hero.",
      sectionUpdates: [{ index: 0, html: "<section id=\"hero\">ok</section>" }],
    });
    const r = processSiteChatFromModelText(json, twoSections, null, null, [0]);
    expect(r.ok).toBe(true);
    if (r.ok && r.sections) expect(r.sections[0]?.html).toContain("ok");
  });
});

describe("normalizeSiteChatModelJsonValue", () => {
  it("wrapt een root-array met alleen patch-rijen (index + html) in reply + sectionUpdates", () => {
    const n = normalizeSiteChatModelJsonValue([
      { index: 0, html: "<section id=\"hero\">x</section>" },
      { index: 1, html: "<section id=\"footer\">y</section>" },
    ]);
    expect(n).toEqual(
      expect.objectContaining({
        reply: expect.stringMatching(/preview|verwerkt/i),
        sectionUpdates: expect.arrayContaining([
          expect.objectContaining({ index: 0 }),
          expect.objectContaining({ index: 1 }),
        ]),
      }),
    );
  });

  it("pakt één chat-object uit een per ongeluk gewikkelde enkelvoudige array", () => {
    const inner = {
      reply: "Klaar.",
      sectionUpdates: [{ index: 0, html: "<section id=\"hero\">z</section>" }],
    };
    expect(normalizeSiteChatModelJsonValue([inner])).toEqual(inner);
  });
});

describe("processSiteChatFromModelText leesbare fouten", () => {
  it("geeft geen technisch schema-jargon bij een JSON-lijst als root", () => {
    const r = processSiteChatFromModelText('["alleen","strings"]', twoSections, null, null, null);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).not.toMatch(/invalid_type|expected object|Zod|schema:/i);
      expect(r.error.length).toBeGreaterThan(20);
    }
  });
});

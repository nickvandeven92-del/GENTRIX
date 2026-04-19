import { describe, expect, it } from "vitest";
import { processSiteChatFromModelText, resolveSiteChatTargetIndices } from "@/lib/ai/site-chat-with-claude";
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
    if (!r.ok) expect(r.error).toContain("sectie-index 1");
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

import { describe, expect, it } from "vitest";
import { orderTailwindSectionsByIdPlan } from "@/lib/site/compose-site-plan";
import type { TailwindSection } from "@/lib/ai/tailwind-sections-schema";

function sec(name: string, id?: string): TailwindSection {
  return { sectionName: name, html: `<section id="${id ?? name}">x</section>`, ...(id ? { id } : {}) };
}

describe("orderTailwindSectionsByIdPlan", () => {
  it("laat volgorde ongemoeid bij lege plan", () => {
    const a = sec("A", "a");
    const b = sec("B", "b");
    expect(orderTailwindSectionsByIdPlan([a, b], undefined)).toEqual([a, b]);
    expect(orderTailwindSectionsByIdPlan([a, b], [])).toEqual([a, b]);
  });

  it("ordent volgens permutatie wanneer alle id’s aanwezig zijn", () => {
    const a = sec("A", "a");
    const b = sec("B", "b");
    const c = sec("C", "c");
    const out = orderTailwindSectionsByIdPlan([a, b, c], ["c", "a", "b"]);
    expect(out.map((s) => s.id)).toEqual(["c", "a", "b"]);
  });

  it("lost ontbrekende wire-id’s op met dezelfde slugify als snapshot", () => {
    const a = { sectionName: "Alpha", html: "<section>x</section>" } as TailwindSection;
    const b = { sectionName: "Beta", html: "<section>y</section>" } as TailwindSection;
    const out = orderTailwindSectionsByIdPlan([a, b], ["beta", "alpha"]);
    expect(out.map((s) => s.sectionName)).toEqual(["Beta", "Alpha"]);
  });

  it("bij onbekende id in plan: originele volgorde", () => {
    const a = sec("A", "a");
    const b = sec("B", "b");
    expect(orderTailwindSectionsByIdPlan([a, b], ["b", "x"])).toEqual([a, b]);
  });

  it("bij dubbele id in bron: geen herschikking", () => {
    const a = sec("A", "same");
    const b = sec("B", "same");
    expect(orderTailwindSectionsByIdPlan([a, b], ["same", "same"])).toEqual([a, b]);
  });
});

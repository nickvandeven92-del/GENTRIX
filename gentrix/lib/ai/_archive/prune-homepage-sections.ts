import type { CompactnessProfile } from "@/types/pageCompactness";

export type HomepageSectionId =
  | "hero"
  | "trust"
  | "services"
  | "features"
  | "process"
  | "about"
  | "story"
  | "testimonials"
  | "portfolio"
  | "pricing"
  | "faq"
  | "contact"
  | "cta"
  | "footer";

const ALL_HOMEPAGE_IDS = new Set<string>([
  "hero",
  "trust",
  "services",
  "features",
  "process",
  "about",
  "story",
  "testimonials",
  "portfolio",
  "pricing",
  "faq",
  "contact",
  "cta",
  "footer",
]);

export function isHomepageSectionId(s: string): s is HomepageSectionId {
  return ALL_HOMEPAGE_IDS.has(s);
}

export function coerceToHomepageSectionIds(sections: string[]): HomepageSectionId[] {
  return sections.filter((x): x is HomepageSectionId => isHomepageSectionId(x));
}

type SectionMeta = {
  kind: "hero" | "proof" | "cards" | "narrative" | "conversion" | "footer";
  priority: number;
};

const META: Record<HomepageSectionId, SectionMeta> = {
  hero: { kind: "hero", priority: 100 },
  contact: { kind: "conversion", priority: 95 },
  services: { kind: "cards", priority: 90 },
  portfolio: { kind: "proof", priority: 85 },
  features: { kind: "cards", priority: 80 },
  trust: { kind: "proof", priority: 75 },
  pricing: { kind: "proof", priority: 70 },
  process: { kind: "cards", priority: 65 },
  about: { kind: "narrative", priority: 60 },
  story: { kind: "narrative", priority: 62 },
  testimonials: { kind: "proof", priority: 55 },
  faq: { kind: "proof", priority: 50 },
  cta: { kind: "conversion", priority: 70 },
  footer: { kind: "footer", priority: 999 },
};

function priorityOf(id: HomepageSectionId): number {
  return META[id]?.priority ?? 0;
}

/**
 * Kap homepage-secties af naar compactness-limieten; behoudt zoveel mogelijk de volgorde van `input`.
 */
export function pruneHomepageSections(input: HomepageSectionId[], c: CompactnessProfile): HomepageSectionId[] {
  const deduped = [...new Set(input)];
  const hadFooter = deduped.includes("footer");
  const primary = deduped.filter((s) => s !== "footer");

  const sorted = [...primary].sort((a, b) => priorityOf(b) - priorityOf(a));

  const chosen: HomepageSectionId[] = [];
  let narrative = 0;
  let cta = 0;
  let cardGrids = 0;

  for (const id of sorted) {
    if (chosen.length >= c.maxPrimarySections) break;

    const meta = META[id];

    if (meta.kind === "narrative") {
      if (!c.allowDedicatedAboutSection && id === "about") continue;
      if (narrative >= c.maxNarrativeSections) continue;
      narrative++;
    }

    if (meta.kind === "conversion") {
      if (cta >= c.maxCtaSections) continue;
      cta++;
    }

    if (meta.kind === "cards") {
      if (cardGrids >= c.maxCardGridSections) continue;
      cardGrids++;
    }

    chosen.push(id);
  }

  let body: HomepageSectionId[] = chosen.includes("hero")
    ? [...chosen]
    : (["hero", ...chosen] as HomepageSectionId[]);

  if (body.length > c.maxPrimarySections) {
    const nonHero = body.filter((x) => x !== "hero");
    const overflow = body.length - c.maxPrimarySections;
    const dropLowestFirst = [...nonHero].sort((a, b) => priorityOf(a) - priorityOf(b));
    const trimmed = dropLowestFirst.slice(overflow);
    body = ["hero", ...trimmed];
  }

  const chosenSet = new Set(body);
  let ordered = input.filter((i) => chosenSet.has(i) && i !== "footer");
  if (body.includes("hero") && !ordered.includes("hero")) {
    ordered = ["hero", ...ordered.filter((i) => i !== "hero")];
  }

  return hadFooter ? [...ordered, "footer"] : ordered;
}

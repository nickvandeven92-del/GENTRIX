import type { HomepageSectionId } from "@/lib/ai/prune-homepage-sections";
import type { CompactnessProfile } from "@/types/pageCompactness";

export type MergedSection = {
  /** Stabiele id voor render/prompt (samengestelde blokken krijgen vaste namen). */
  id: string;
  includes: HomepageSectionId[];
};

const STORY_CLUSTER: HomepageSectionId[] = ["story", "services", "features", "process", "about"];
const PROOF_POOL: HomepageSectionId[] = ["trust", "portfolio", "testimonials", "pricing", "faq"];
const CONVERSION_PAIR: HomepageSectionId[] = ["contact", "cta"];

function firstIndexOfAny(sections: HomepageSectionId[], ids: HomepageSectionId[]): number {
  let best = Infinity;
  for (const id of ids) {
    const i = sections.indexOf(id);
    if (i >= 0 && i < best) best = i;
  }
  return best === Infinity ? -1 : best;
}

function sortMergedByInputOrder(out: MergedSection[], sections: HomepageSectionId[]): MergedSection[] {
  return [...out].sort((a, b) => {
    const ia = firstIndexOfAny(sections, a.includes);
    const ib = firstIndexOfAny(sections, b.includes);
    return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
  });
}

/**
 * Vouwt homepage-secties samen voor compacte layouts. Secties die al in een cluster zitten worden niet dubbel gebruikt.
 */
export function mergeHomepageSections(sections: HomepageSectionId[], c: CompactnessProfile): MergedSection[] {
  if (!c.preferMergedSections) {
    return sections.map((s) => ({ id: s, includes: [s] }));
  }

  const used = new Set<HomepageSectionId>();
  const out: MergedSection[] = [];

  if (sections.includes("hero")) {
    const includes: HomepageSectionId[] = ["hero"];
    used.add("hero");
    if (c.preferHeroWithEmbeddedProof && sections.includes("trust")) {
      includes.push("trust");
      used.add("trust");
    }
    out.push({ id: "hero", includes });
  }

  const storyIncludes = STORY_CLUSTER.filter((s) => sections.includes(s) && !used.has(s));
  if (storyIncludes.length > 0) {
    for (const s of storyIncludes) used.add(s);
    out.push({ id: "services_with_story", includes: storyIncludes });
  }

  const proofIncludes = PROOF_POOL.filter((s) => sections.includes(s) && !used.has(s));
  if (proofIncludes.length > 0) {
    for (const s of proofIncludes) used.add(s);
    out.push({ id: "proof_grid", includes: proofIncludes });
  }

  const convIncludes = CONVERSION_PAIR.filter((s) => sections.includes(s) && !used.has(s));
  if (convIncludes.length > 0) {
    for (const s of convIncludes) used.add(s);
    out.push({ id: "contact", includes: convIncludes });
  }

  if (sections.includes("footer") && !used.has("footer")) {
    used.add("footer");
    out.push({ id: "footer", includes: ["footer"] });
  }

  for (const s of sections) {
    if (used.has(s)) continue;
    used.add(s);
    out.push({ id: s, includes: [s] });
  }

  return sortMergedByInputOrder(out, sections);
}

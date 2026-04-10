import {
  slugifyToSectionId,
  type TailwindSection,
} from "@/lib/ai/tailwind-sections-schema";
import type { PublicSiteModuleFlags } from "@/lib/site/public-site-modules-registry";
import { getSiteIrComposeValidationErrors } from "@/lib/site/site-ir-compose-validation";
import type { SiteIrV1 } from "@/lib/site/site-ir-schema";

function resolvedTailwindSectionId(s: TailwindSection, index: number): string {
  return s.id ?? slugifyToSectionId(s.sectionName, index);
}

/**
 * Zet secties in de volgorde van `sectionIdsOrdered` **alleen** als dat een permutatie is van de
 * huidige sectie-`id`'s — geen visuele template, alleen canonieke volgorde uit snapshot/IR.
 */
export function orderTailwindSectionsByIdPlan(
  sections: TailwindSection[],
  sectionIdsOrdered: readonly string[] | null | undefined,
): TailwindSection[] {
  if (!sectionIdsOrdered?.length) return sections;
  const byId = new Map(sections.map((s, i) => [resolvedTailwindSectionId(s, i), s]));
  if (byId.size !== sections.length) return sections;
  if (sectionIdsOrdered.length !== sections.length) return sections;
  for (const id of sectionIdsOrdered) {
    if (!byId.has(id)) return sections;
  }
  const seen = new Set<string>();
  for (const id of sectionIdsOrdered) {
    if (seen.has(id)) return sections;
    seen.add(id);
  }
  return sectionIdsOrdered.map((id) => byId.get(id)!);
}

/** Alleen development: IR vs secties + CRM (zachte waarschuwing; persist gebruikt harde validatie). */
export function logSiteIrComposePlanMismatches(
  siteIr: SiteIrV1 | null | undefined,
  sections: TailwindSection[],
  flags: PublicSiteModuleFlags,
): void {
  if (process.env.NODE_ENV !== "development") return;
  if (!siteIr) return;
  for (const msg of getSiteIrComposeValidationErrors(siteIr, sections, flags)) {
    console.warn("[compose/siteIr]", msg);
  }
}

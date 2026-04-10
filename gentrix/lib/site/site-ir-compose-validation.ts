import type { TailwindSection } from "@/lib/ai/tailwind-sections-schema";
import { slugifyToSectionId } from "@/lib/ai/tailwind-sections-schema";
import type { ProjectSnapshot } from "@/lib/site/project-snapshot-schema";
import {
  getPublicSiteModuleDefinition,
  type PublicSiteModuleFlags,
} from "@/lib/site/public-site-modules-registry";
import type { SiteIrV1 } from "@/lib/site/site-ir-schema";

function resolvedId(s: TailwindSection, index: number): string {
  return s.id ?? slugifyToSectionId(s.sectionName, index);
}

/**
 * Harde validatie voor persist/publish: Site IR vs sectie-id’s + actieve CRM-modules.
 * Lege lijst als er geen `siteIr` is.
 */
export function getSiteIrComposeValidationErrors(
  siteIr: SiteIrV1 | null | undefined,
  sections: TailwindSection[],
  flags: PublicSiteModuleFlags,
): string[] {
  if (!siteIr) return [];
  const errors: string[] = [];
  const resolved = sections.map((s, i) => resolvedId(s, i));
  const idSet = new Set(resolved);
  if (idSet.size !== resolved.length) {
    errors.push("Secties hebben geen unieke resolved id’s (id ontbreekt en/of dubbele slug).");
  }

  const ord = siteIr.sectionIdsOrdered;
  if (ord != null && ord.length > 0) {
    if (ord.length !== sections.length) {
      errors.push(
        `siteIr.sectionIdsOrdered.length (${ord.length}) moet gelijk zijn aan sections.length (${sections.length}).`,
      );
    } else {
      const seen = new Set<string>();
      for (const id of ord) {
        if (seen.has(id)) {
          errors.push(`siteIr.sectionIdsOrdered bevat duplicaat "${id}".`);
          break;
        }
        seen.add(id);
        if (!idSet.has(id)) {
          errors.push(`siteIr.sectionIdsOrdered bevat onbekende id "${id}".`);
          break;
        }
      }
      if (errors.length === 0 && seen.size !== idSet.size) {
        errors.push("siteIr.sectionIdsOrdered dekt niet alle sectie-id’s (geen permutatie).");
      }
    }
  }

  for (const slot of siteIr.moduleSlots) {
    if (slot.intent !== "canonical_section") continue;
    const def = getPublicSiteModuleDefinition(slot.moduleId);
    if (!def) continue;
    const active = flags[def.crmFlag];
    if (!active) continue;
    for (const sid of def.canonicalSectionIds) {
      if (!idSet.has(sid)) {
        errors.push(
          `Module "${slot.moduleId}" staat aan (CRM) maar canonieke sectie-id "${sid}" ontbreekt in de site.`,
        );
      }
    }
  }

  return errors;
}

/** Snapshot: extra check dat IR-volgorde gelijk loopt aan `composition` (één bron gesynchroniseerd). */
export function getSiteIrSnapshotSyncErrors(snapshot: ProjectSnapshot): string[] {
  const { siteIr, composition, sections } = snapshot;
  if (!siteIr?.sectionIdsOrdered?.length) return [];
  const comp = composition.sectionIdsOrdered;
  if (comp.length !== siteIr.sectionIdsOrdered.length) {
    return [
      `siteIr.sectionIdsOrdered.length (${siteIr.sectionIdsOrdered.length}) ≠ composition.sectionIdsOrdered.length (${comp.length}).`,
    ];
  }
  const mism: number[] = [];
  for (let i = 0; i < comp.length; i++) {
    if (comp[i] !== siteIr.sectionIdsOrdered[i]) mism.push(i);
  }
  if (mism.length > 0) {
    return [
      `siteIr.sectionIdsOrdered wijkt af van composition.sectionIdsOrdered (eerste index ${mism[0]}: "${siteIr.sectionIdsOrdered[mism[0]!]}" vs "${comp[mism[0]!]}").`,
    ];
  }
  const ids = new Set(sections.map((s) => s.id));
  for (const id of siteIr.sectionIdsOrdered) {
    if (!ids.has(id)) return [`siteIr.sectionIdsOrdered verwijst naar onbekende snapshot-sectie "${id}".`];
  }
  return [];
}

/** Persist/publish: snapshot-sync + IR vs CRM-modules. */
export function getPersistSiteValidationErrors(
  snapshot: ProjectSnapshot,
  flags: PublicSiteModuleFlags,
): string[] {
  return [...getSiteIrSnapshotSyncErrors(snapshot), ...getSiteIrComposeValidationErrors(snapshot.siteIr, snapshot.sections, flags)];
}

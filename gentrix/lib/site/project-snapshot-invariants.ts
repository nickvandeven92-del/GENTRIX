import type { SectionSemanticRole } from "@/lib/ai/tailwind-sections-schema";
import type { ProjectSnapshot } from "@/lib/site/project-snapshot-schema";
import { getSiteIrSnapshotSyncErrors } from "@/lib/site/site-ir-compose-validation";
import { getSiteBlueprintDefinition } from "@/lib/site/site-blueprint-registry";

export type InvariantResult = { ok: true } | { ok: false; errors: string[] };

/** Rollen waarvoor maximaal één sectie per pagina verwacht wordt. */
const UNIQUE_SEMANTIC_ROLES: SectionSemanticRole[] = ["hero", "footer", "nav"];

/**
 * Domeinregels bovenop Zod-shape.
 *
 * **Roadmap (dieper dan nu):** zie ook `semantic-role-model.ts` (zachte heuristieken). Harde regels hier: basis-uniekheid + hero-positie + html-trim;
 * later: nav-placement, verboden volgordes, mandatory rollen per paginatype.
 */
export function assertProjectSnapshotInvariants(snapshot: ProjectSnapshot): InvariantResult {
  const errors: string[] = [];
  const { sections, composition } = snapshot;
  const n = sections.length;
  const ordered = composition.sectionIdsOrdered;

  if (ordered.length !== n) {
    errors.push(
      `composition.sectionIdsOrdered.length (${ordered.length}) moet gelijk zijn aan sections.length (${n}).`,
    );
  }

  const ids = sections.map((s) => s.id);
  const idSet = new Set(ids);
  if (idSet.size !== ids.length) {
    errors.push("Sectie-id’s moeten uniek zijn.");
  }

  for (let i = 0; i < n; i++) {
    if (ordered[i] !== undefined && ordered[i] !== ids[i]) {
      errors.push(
        `sectionIdsOrdered[${i}] (${ordered[i]}) wijkt af van sections[${i}].id (${ids[i]}); canonieke volgorde = sections-array.`,
      );
      break;
    }
  }

  for (const oid of ordered) {
    if (!idSet.has(oid)) {
      errors.push(`sectionIdsOrdered bevat onbekende id "${oid}".`);
      break;
    }
  }

  for (const s of sections) {
    if (s.html.trim().length < 1) {
      errors.push(`Sectie "${s.id}": html is leeg of alleen whitespace.`);
    }
  }

  for (const role of UNIQUE_SEMANTIC_ROLES) {
    const count = sections.filter((s) => s.semanticRole === role).length;
    if (count > 1) {
      errors.push(`semanticRole "${role}" mag maximaal één keer voorkomen (nu ${count}).`);
    }
  }

  const heroIdx = sections.findIndex((s) => s.semanticRole === "hero");
  if (heroIdx >= 0 && heroIdx !== 0) {
    errors.push('Als semanticRole "hero" voorkomt, moet die op index 0 staan (eerste content-sectie).');
  }

  if (snapshot.siteIr != null) {
    if (!getSiteBlueprintDefinition(snapshot.siteIr.blueprintId)) {
      errors.push(`siteIr.blueprintId is onbekend in het blueprint-register: "${snapshot.siteIr.blueprintId}".`);
    }
  }

  errors.push(...getSiteIrSnapshotSyncErrors(snapshot));

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true };
}

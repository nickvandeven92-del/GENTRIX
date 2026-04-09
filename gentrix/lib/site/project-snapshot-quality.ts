import { analyzeCopyIntent } from "@/lib/site/copy-intent-heuristics";
import { getEffectivePageType, type SnapshotPageType } from "@/lib/site/snapshot-page-type";
import { lintSemanticRoleModel } from "@/lib/site/semantic-role-model";
import { snapshotDiagnostic, type SnapshotDiagnostic } from "@/lib/site/snapshot-diagnostic";
import type { ProjectSnapshot } from "@/lib/site/project-snapshot-schema";

/**
 * Heuristische kwaliteitslaag bovenop **harde** invarianten (merge/snapshot-schema).
 */
export function qualityHeuristicsProjectSnapshot(snapshot: ProjectSnapshot): SnapshotDiagnostic[] {
  const pageType = getEffectivePageType(snapshot.composition.pageType);
  const issues: SnapshotDiagnostic[] = [...lintSemanticRoleModel(snapshot)];

  const sections = snapshot.sections;
  const withIntent = sections.filter((s) => s.copyIntent != null && s.copyIntent.trim().length > 0);

  if (pageType !== "legal" && sections.length >= 4 && withIntent.length < Math.ceil(sections.length / 2)) {
    issues.push(
      snapshotDiagnostic({
        code: "copyIntent.sparse_across_page",
        severity: "warn",
        scope: "page",
        message: `Minder dan de helft van de secties heeft copyIntent (${withIntent.length}/${sections.length}); overweeg intent per blok voor betere AI-runs.`,
        metadata: { withIntent: withIntent.length, sectionCount: sections.length, pageType },
      }),
    );
  }

  const hero = sections.find((s) => s.semanticRole === "hero");
  if (shouldWarnHeroMissing(pageType, sections.length, hero != null)) {
    issues.push(
      snapshotDiagnostic({
        code: "semanticRole.hero_missing",
        severity: "warn",
        scope: "page",
        message:
          'Geen sectie met semanticRole "hero"; hero-commando’s en luxe-tone richten zich dan minder precies.',
        metadata: { pageType },
      }),
    );
  }

  for (const s of sections) {
    if (s.copyIntent == null) continue;
    const hit = analyzeCopyIntent(s.copyIntent, s.sectionName);
    if (hit) {
      issues.push(
        snapshotDiagnostic({
          code: hit.code,
          severity: "warn",
          scope: "section",
          message: `Sectie "${s.id}": ${hit.message}`,
          metadata: { sectionId: s.id, sectionName: s.sectionName },
        }),
      );
    }
  }

  return issues;
}

function shouldWarnHeroMissing(
  pageType: SnapshotPageType,
  sectionCount: number,
  hasHero: boolean,
): boolean {
  if (sectionCount === 0 || hasHero) return false;
  if (pageType === "legal") return false;
  return true;
}

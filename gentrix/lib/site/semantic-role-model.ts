import type { SectionSemanticRole } from "@/lib/ai/tailwind-sections-schema";
import { getEffectivePageType, type SnapshotPageType } from "@/lib/site/snapshot-page-type";
import { snapshotDiagnostic, type SnapshotDiagnostic } from "@/lib/site/snapshot-diagnostic";
import type { ProjectSnapshot } from "@/lib/site/project-snapshot-schema";

/** Rollen die in typische one-pagers vaker dan eens mogen (contentblokken). */
export const SEMANTIC_ROLES_TYPICALLY_MULTIPLE: ReadonlySet<SectionSemanticRole> = new Set([
  "features",
  "testimonials",
  "pricing",
  "generic",
  "contact",
]);

/** Aanbevolen volgorde (zachte heuristiek; geen harde invariant). Lagere index = eerder. */
const ROLE_ORDER_HINT: Partial<Record<SectionSemanticRole, number>> = {
  nav: 0,
  hero: 1,
  features: 2,
  testimonials: 3,
  pricing: 4,
  cta: 5,
  contact: 6,
  footer: 99,
};

function roleOrderHint(r: SectionSemanticRole): number {
  return ROLE_ORDER_HINT[r] ?? 50;
}

function shouldApplyLandingStyleHeuristics(pageType: SnapshotPageType): boolean {
  return pageType === "landing" || pageType === "article";
}

/**
 * Zachte semantische model-checks bovenop harde invarianten (uniek hero/footer/nav).
 */
export function lintSemanticRoleModel(snapshot: ProjectSnapshot): SnapshotDiagnostic[] {
  const issues: SnapshotDiagnostic[] = [];
  const pageType = getEffectivePageType(snapshot.composition.pageType);
  const landingLike = shouldApplyLandingStyleHeuristics(pageType);

  const { sections } = snapshot;
  const withRole = sections.filter((s) => s.semanticRole != null);

  for (const s of withRole) {
    const role = s.semanticRole as SectionSemanticRole;
    if (!SEMANTIC_ROLES_TYPICALLY_MULTIPLE.has(role)) {
      const count = withRole.filter((x) => x.semanticRole === role).length;
      if (count > 1) {
        issues.push(
          snapshotDiagnostic({
            code: "semanticRole.duplicate_unusual",
            severity: "warn",
            scope: "section",
            message: `semanticRole "${role}" komt ${count}× voor; meestal verwacht je maximaal één (behalve o.a. features/testimonials/pricing).`,
            metadata: { semanticRole: role, count, pageType },
          }),
        );
        break;
      }
    }
  }

  if (landingLike) {
    let prevHint = -1;
    let prevRole: SectionSemanticRole | undefined;
    for (const s of sections) {
      if (s.semanticRole == null) continue;
      const role = s.semanticRole;
      const h = roleOrderHint(role);
      if (prevRole != null && h < prevHint && h < 90 && prevHint < 90) {
        issues.push(
          snapshotDiagnostic({
            code: "semanticRole.order_unusual",
            severity: "warn",
            scope: "composition",
            message: `Na "${prevRole}" volgt "${role}" terwijl de gebruikelijke landingspagina-volgorde vaak anders is — controleer of dit bewust is.`,
            metadata: { prevRole, nextRole: role, pageType },
          }),
        );
        break;
      }
      prevHint = h;
      prevRole = role;
    }
  }

  if (sections.length >= 2 && sections.every((s) => s.semanticRole == null)) {
    issues.push(
      snapshotDiagnostic({
        code: "semanticRole.all_missing",
        severity: "warn",
        scope: "page",
        message: "Geen enkele sectie heeft semanticRole; AI-commando’s en kwaliteitsrapportage werken beter met rollen.",
        metadata: { pageType },
      }),
    );
  }

  return issues;
}

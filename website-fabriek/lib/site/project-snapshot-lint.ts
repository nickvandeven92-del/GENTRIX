import {
  SNAPSHOT_COPY_INTENT_MIN_MEANINGFUL,
  SNAPSHOT_LINT_CSS_SOFT_WARN,
  SNAPSHOT_LINT_JS_SOFT_WARN,
} from "@/lib/site/project-snapshot-constants";
import { snapshotDiagnostic, type SnapshotDiagnostic } from "@/lib/site/snapshot-diagnostic";
import type { ProjectSnapshot } from "@/lib/site/project-snapshot-schema";

const GENERIC_COPY_INTENT = /^(premium|ok|test|beter|meer sales|sales|nice|goed|fix|update|yes|no)\.?$/i;

/**
 * Zachte checks op schema-valide snapshots (geen harde invariant-fail).
 */
export function lintProjectSnapshot(snapshot: ProjectSnapshot): SnapshotDiagnostic[] {
  const issues: SnapshotDiagnostic[] = [];

  if (snapshot.meta.documentTitle == null || snapshot.meta.documentTitle.trim() === "") {
    issues.push(
      snapshotDiagnostic({
        code: "meta.documentTitle.missing",
        severity: "warn",
        scope: "meta",
        message: "Geen documentTitle; overweeg titel voor export/SEO.",
      }),
    );
  }

  if (snapshot.siteConfig.description == null || snapshot.siteConfig.description.trim() === "") {
    issues.push(
      snapshotDiagnostic({
        code: "siteConfig.description.empty",
        severity: "warn",
        scope: "siteConfig",
        message: "Geen sitebeschrijving in snapshot.",
      }),
    );
  }

  const cssLen = snapshot.assets.customCss?.length ?? 0;
  if (cssLen > SNAPSHOT_LINT_CSS_SOFT_WARN) {
    issues.push(
      snapshotDiagnostic({
        code: "assets.customCss.large",
        severity: "warn",
        scope: "assets",
        message: `customCss is groot (${cssLen} chars); diff/export worden zwaarder.`,
        metadata: { chars: cssLen },
      }),
    );
  }

  const jsLen = snapshot.assets.customJs?.length ?? 0;
  if (jsLen > SNAPSHOT_LINT_JS_SOFT_WARN) {
    issues.push(
      snapshotDiagnostic({
        code: "assets.customJs.large",
        severity: "warn",
        scope: "assets",
        message: `customJs is groot (${jsLen} chars).`,
        metadata: { chars: jsLen },
      }),
    );
  }

  if (snapshot.generation.source === "ai_command" && !snapshot.generation.lastModel) {
    issues.push(
      snapshotDiagnostic({
        code: "generation.lastModel.missing_after_ai",
        severity: "warn",
        scope: "generation",
        message: "Na AI-run ontbreekt lastModel in generation-blok.",
      }),
    );
  }

  const footerIdx = snapshot.sections.map((s, i) => (s.semanticRole === "footer" ? i : -1)).filter((i) => i >= 0);
  if (footerIdx.length === 1 && footerIdx[0] !== snapshot.sections.length - 1) {
    issues.push(
      snapshotDiagnostic({
        code: "sections.footer.not_last",
        severity: "warn",
        scope: "section",
        message: 'semanticRole "footer" staat niet als laatste sectie; controleer volgorde.',
        metadata: { footerIndex: footerIdx[0], sectionCount: snapshot.sections.length },
      }),
    );
  }

  for (const s of snapshot.sections) {
    if (s.copyIntent != null && s.copyIntent.trim().length < SNAPSHOT_COPY_INTENT_MIN_MEANINGFUL) {
      issues.push(
        snapshotDiagnostic({
          code: "sections.copyIntent.too_short",
          severity: "warn",
          scope: "section",
          message: `Sectie "${s.id}": copyIntent korter dan ${SNAPSHOT_COPY_INTENT_MIN_MEANINGFUL} tekens.`,
          metadata: { sectionId: s.id },
        }),
      );
    }
    if (s.copyIntent != null && GENERIC_COPY_INTENT.test(s.copyIntent.trim())) {
      issues.push(
        snapshotDiagnostic({
          code: "sections.copyIntent.generic",
          severity: "warn",
          scope: "section",
          message: `Sectie "${s.id}": copyIntent is erg generiek ("${s.copyIntent.trim()}") — overweeg specifiekere intent.`,
          metadata: { sectionId: s.id, copyIntentSample: s.copyIntent.trim() },
        }),
      );
    }
  }

  return issues;
}

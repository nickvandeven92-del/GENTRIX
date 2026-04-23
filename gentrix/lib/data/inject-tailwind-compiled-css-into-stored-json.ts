import { PROJECT_SNAPSHOT_FORMAT } from "@/lib/site/project-snapshot-schema";
import { SNAPSHOT_TAILWIND_COMPILED_CSS_MAX } from "@/lib/site/project-snapshot-constants";

/**
 * Voegt `tailwindCompiledCss` toe aan snapshot- of kolom-JSON (project_snapshot_v1 of losse tailwind payload).
 * Retourneert `null` als de structuur niet herkend wordt.
 */
export function injectTailwindCompiledCssIntoStoredPayloadJson(
  raw: unknown,
  cssFull: string,
): Record<string, unknown> | null {
  const css =
    cssFull.length > SNAPSHOT_TAILWIND_COMPILED_CSS_MAX ? cssFull.slice(0, SNAPSHOT_TAILWIND_COMPILED_CSS_MAX) : cssFull;
  if (!css.trim()) return null;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const root = raw as Record<string, unknown>;

  if (root.format === PROJECT_SNAPSHOT_FORMAT) {
    const assets = (root.assets && typeof root.assets === "object" && !Array.isArray(root.assets)
      ? (root.assets as Record<string, unknown>)
      : {}) as Record<string, unknown>;
    return {
      ...root,
      assets: {
        ...assets,
        tailwindCompiledCss: css,
      },
    };
  }

  if (Array.isArray(root.sections)) {
    return { ...root, tailwindCompiledCss: css };
  }

  return null;
}

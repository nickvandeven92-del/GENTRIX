import type { TailwindSectionsPayload } from "@/lib/ai/tailwind-sections-schema";
import { toCanonicalProjectSnapshotObject } from "@/lib/site/project-snapshot-canonical";
import { parseAnyStoredProjectDataToLatestSnapshot } from "@/lib/site/project-snapshot-migrate";
import {
  projectSnapshotSchema,
  tailwindSectionsPayloadToProjectSnapshot,
  projectSnapshotToTailwindSectionsPayload,
  type GenerationContext,
  type ProjectSnapshot,
  type ProjectSnapshotFromTailwindOptions,
} from "@/lib/site/project-snapshot-schema";

export type NormalizeToProjectSnapshotResult =
  | { ok: true; snapshot: ProjectSnapshot }
  | { ok: false; error: string };

/**
 * Accepteert canonieke `project_snapshot_v1` óf loose v1-upgrade óf legacy `tailwind_sections`.
 */
export function normalizeUnknownToProjectSnapshot(
  input: unknown,
  options?: Pick<ProjectSnapshotFromTailwindOptions, "generationSource" | "documentTitle" | "siteIrHints">,
): NormalizeToProjectSnapshotResult {
  const r = parseAnyStoredProjectDataToLatestSnapshot(input, {
    generationSource: options?.generationSource,
    documentTitle: options?.documentTitle,
  });
  if (r.ok) return { ok: true, snapshot: r.snapshot };
  return { ok: false, error: r.error };
}

/** JSON voor Supabase `Json` — canoniek (gesorteerde keys, geen undefined). */
export function projectSnapshotToJson(snapshot: ProjectSnapshot): unknown {
  return toCanonicalProjectSnapshotObject(snapshot);
}

export function projectSnapshotFromTailwindPayload(
  payload: TailwindSectionsPayload,
  options?: ProjectSnapshotFromTailwindOptions,
): ProjectSnapshot {
  const raw = tailwindSectionsPayloadToProjectSnapshot(payload, options);
  return projectSnapshotSchema.parse(raw);
}

export { projectSnapshotToTailwindSectionsPayload };

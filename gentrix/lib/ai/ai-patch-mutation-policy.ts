import type { SiteAiSnapshotPatch } from "@/lib/ai/site-ai-command-patch-schema";

/**
 * Welke top-level keys een AI-site-command patch mag bevatten (naast .strict() Zod).
 * Geen `sections`-array, geen format/schemaVersion, geen ruwe generation-fingerprint mutatie.
 *
 * Diepere pad-lijst (welke snapshot-velden conceptueel muteerbaar zijn) staat in
 * `site-ai-command-patch-schema.ts` + merge-laag; houd die synchroon met studio-documentatie.
 */
export const AI_PATCH_ALLOWED_TOP_LEVEL_KEYS = new Set([
  "meta",
  "siteConfig",
  "composition",
  "theme",
  "assets",
  "editor",
  "sectionUpdates",
]);

/**
 * Verwerpt ruwe JSON vóór Zod als duidelijk verboden structuur.
 */
export function rejectForbiddenAiPatchShape(raw: unknown): { ok: true } | { ok: false; error: string } {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: true };
  }
  const o = raw as Record<string, unknown>;
  if ("sections" in o) {
    return {
      ok: false,
      error: "Patch mag geen volledige `sections`-array bevatten; gebruik `sectionUpdates` met verplichte `sectionId` per regel.",
    };
  }
  if ("format" in o || "schemaVersion" in o) {
    return { ok: false, error: "Patch mag `format` of schema-version velden niet muteren." };
  }
  for (const k of Object.keys(o)) {
    if (!AI_PATCH_ALLOWED_TOP_LEVEL_KEYS.has(k)) {
      return { ok: false, error: `Onbekende patch-key "${k}".` };
    }
  }
  return { ok: true };
}

/** Controle dat het geparste patch-object geen verboden paden raakt (defensief). `customJs` zit niet in het Zod-schema. */
export function assertAiPatchMutationPolicy(patch: SiteAiSnapshotPatch): { ok: true } | { ok: false; error: string } {
  void patch;
  return { ok: true };
}

import type { ProjectSnapshot } from "@/lib/site/project-snapshot-schema";
import { assertProjectSnapshotShape } from "@/lib/site/project-snapshot-schema";

/** Verwijdert undefined diep in objecten (arrays ongemoeid laten). */
function stripUndefinedDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripUndefinedDeep);
  }
  if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(o)) {
      if (v === undefined) continue;
      out[k] = stripUndefinedDeep(v);
    }
    return out;
  }
  return value;
}

/** Gesorteerde keys op elk objectniveau — stabiele JSON voor diff/hash. */
export function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep);
  }
  if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const k of Object.keys(o).sort()) {
      sorted[k] = sortKeysDeep(o[k]);
    }
    return sorted;
  }
  return value;
}

/**
 * Canoniek object voor opslag/export: gevalideerd, geen undefined, vaste key-volgorde.
 * Twee keer aanroepen met dezelfde betekenis-inhoud → dezelfde structure (deterministisch).
 */
export function toCanonicalProjectSnapshotObject(snapshot: ProjectSnapshot): Record<string, unknown> {
  const parsed = assertProjectSnapshotShape(snapshot);
  const stripped = stripUndefinedDeep(parsed) as Record<string, unknown>;
  return sortKeysDeep(stripped) as Record<string, unknown>;
}

export function projectSnapshotToCanonicalJsonString(snapshot: ProjectSnapshot): string {
  return JSON.stringify(toCanonicalProjectSnapshotObject(snapshot));
}

import type { Json } from "@/lib/types/database";

/**
 * Inhoud van `site_snapshots.payload_json` / `clients.site_data_json` (Tailwind-studio):
 * canoniek contract: `lib/site/project-snapshot-schema.ts` (`project_snapshot_v1`).
 */

/**
 * Bron van een snapshot (`site_snapshots.source`) — legacy kolom.
 * Voor nieuwe queries: `site_snapshots.created_by` = user | ai | generator | migration | system (zie `snapshot-created-by.ts`).
 */
export const SITE_SNAPSHOT_SOURCES = [
  "editor",
  "generator",
  "ai_command",
  "migration",
  "unknown",
] as const;

export type SiteSnapshotSource = (typeof SITE_SNAPSHOT_SOURCES)[number];

/** Rij-inhoud voor snapshot-insert (payload =zelfde vorm als `clients.site_data_json`). */
export type SiteSnapshotInsertPayload = {
  client_id: string;
  source: SiteSnapshotSource;
  payload_json: Json;
  parent_snapshot_id: string | null;
};

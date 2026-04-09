import type { SiteSnapshotSource } from "@/lib/site/site-project-model";

/** DB-kolom `site_snapshots.created_by` — expliciet t.o.v. oude `source`-string. */
export const SNAPSHOT_CREATED_BY_VALUES = ["user", "ai", "generator", "migration", "system"] as const;

export type SnapshotCreatedBy = (typeof SNAPSHOT_CREATED_BY_VALUES)[number];

export function mapSnapshotSourceToCreatedBy(source: SiteSnapshotSource | string | undefined): SnapshotCreatedBy {
  switch (source) {
    case "editor":
      return "user";
    case "ai_command":
      return "ai";
    case "generator":
      return "generator";
    case "migration":
      return "migration";
    case "import":
      return "user";
    default:
      return "system";
  }
}

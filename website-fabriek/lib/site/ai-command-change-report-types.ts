import type { SnapshotDiagnostic } from "@/lib/site/snapshot-diagnostic";

export type AiCommandPatchMetrics = {
  snapshotJsonCharsBefore: number;
  snapshotJsonCharsAfter: number;
  /** Aantal sectionUpdate-regels in de patch (kan dezelfde id vaker raken). */
  sectionUpdateCount: number;
  /** Unieke sectie-id’s die door de patch zijn bijgewerkt. */
  distinctSectionsUpdated: number;
  pageConfigMergeStrategy: "deep_partial" | "variant_replace" | "none";
  pageConfigKeysInPatch: number;
  lintDiagnosticCount: number;
  qualityDiagnosticCount: number;
  /** Effectieve paginacontext na merge (voor interpretatie). */
  pageType: string;
};

export type AiSiteCommandChangeReport = {
  updatedSectionIds: string[];
  updatedFields: string[];
  lintDiagnostics: SnapshotDiagnostic[];
  qualityDiagnostics: SnapshotDiagnostic[];
  metrics: AiCommandPatchMetrics;
};

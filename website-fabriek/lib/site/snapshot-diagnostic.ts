/**
 * Formeel waarschuwings-/hintmodel voor lint + quality (API, UI, latere dashboards).
 */
export const DIAGNOSTIC_SEVERITIES = ["info", "warn", "error"] as const;
export type DiagnosticSeverity = (typeof DIAGNOSTIC_SEVERITIES)[number];

export const DIAGNOSTIC_SCOPES = [
  "page",
  "section",
  "theme",
  "composition",
  "generation",
  "assets",
  "meta",
  "siteConfig",
] as const;
export type DiagnosticScope = (typeof DIAGNOSTIC_SCOPES)[number];

export type SnapshotDiagnostic = {
  code: string;
  severity: DiagnosticSeverity;
  scope: DiagnosticScope;
  message: string;
  /** Bijv. `{ sectionId }`, `{ chars: number }`, `{ layer: "lint" }` */
  metadata?: Record<string, unknown>;
};

export function snapshotDiagnostic(
  input: Omit<SnapshotDiagnostic, "metadata"> & { metadata?: Record<string, unknown> },
): SnapshotDiagnostic {
  const { metadata, ...rest } = input;
  return metadata != null ? { ...rest, metadata } : rest;
}

import type { ParsedStoredSite } from "@/lib/site/parse-stored-site-data";
import type { ProjectSnapshotFromTailwindOptions } from "@/lib/site/project-snapshot-schema";

/** Zelfde velden als `POST /api/clients` `site_ir_hints` → `projectSnapshotFromTailwindPayload`. */
export function siteIrHintsFromTailwindParsed(
  p: Extract<ParsedStoredSite, { kind: "tailwind" }>,
): ProjectSnapshotFromTailwindOptions["siteIrHints"] | undefined {
  const ir = p.siteIr;
  if (!ir) return undefined;
  return {
    detectedIndustryId: ir.detectedIndustryId ?? undefined,
    blueprintId: ir.blueprintId ?? undefined,
  };
}

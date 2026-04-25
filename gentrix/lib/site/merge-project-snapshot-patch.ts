import type { SiteAiSnapshotPatch } from "@/lib/ai/site-ai-command-patch-schema";
import { assertProjectSnapshotInvariants } from "@/lib/site/project-snapshot-invariants";
import { mergeTailwindPageConfigPatch } from "@/lib/site/merge-tailwind-page-config";
import {
  projectSnapshotSchema,
  type ProjectSnapshot,
  type SnapshotSection,
} from "@/lib/site/project-snapshot-schema";
import { siteIrV1Schema } from "@/lib/site/site-ir-schema";

function mergeSectionRow(
  base: SnapshotSection,
  patch: NonNullable<SiteAiSnapshotPatch["sectionUpdates"]>[number],
): SnapshotSection {
  const out: SnapshotSection = {
    id: base.id,
    sectionName: patch.sectionName?.trim() || base.sectionName,
    html: patch.html ?? base.html,
  };
  const sr = patch.semanticRole ?? base.semanticRole;
  if (sr != null) out.semanticRole = sr;
  const ci = patch.copyIntent !== undefined ? patch.copyIntent : base.copyIntent;
  if (ci != null) out.copyIntent = ci;
  return out;
}

function resolveSectionUpdateIndex(
  base: ProjectSnapshot,
  u: NonNullable<SiteAiSnapshotPatch["sectionUpdates"]>[number],
): { ok: true; index: number } | { ok: false; error: string } {
  const idx = base.sections.findIndex((s) => s.id === u.sectionId);
  if (idx < 0) {
    return { ok: false, error: `sectionUpdates: onbekende sectionId "${u.sectionId}".` };
  }
  return { ok: true, index: idx };
}

export type MergeProjectSnapshotPatchReport = {
  updatedSectionIds: string[];
  updatedFields: string[];
  pageConfigMerge?: {
    strategy: "deep_partial" | "variant_replace";
    keysInPatch: number;
  };
};

/**
 * Past een AI-patch toe: schema + invarianten.
 * `theme.pageConfig`: **subset / deep merge** (zelfde legacy/master-variant); anders volledige vervanging indien patch valideert.
 */
export function mergeProjectSnapshotPatch(
  base: ProjectSnapshot,
  patch: SiteAiSnapshotPatch,
  options?: { generationModel?: string },
):
  | { ok: true; snapshot: ProjectSnapshot; report: MergeProjectSnapshotPatchReport }
  | { ok: false; error: string } {
  const next: ProjectSnapshot = structuredClone(base);
  const updatedFields: string[] = [];
  const updatedSectionIds: string[] = [];
  let pageConfigReport: MergeProjectSnapshotPatchReport["pageConfigMerge"] | undefined;

  if (patch.meta?.documentTitle !== undefined) {
    next.meta = {
      ...next.meta,
      documentTitle: patch.meta.documentTitle,
    };
    updatedFields.push("meta.documentTitle");
  }

  if (patch.siteConfig) {
    next.siteConfig = { ...next.siteConfig, ...patch.siteConfig };
    updatedFields.push("siteConfig");
  }

  if (patch.composition) {
    next.composition = { ...next.composition, ...patch.composition };
    updatedFields.push("composition");
  }

  if (patch.theme) {
    if (patch.theme.pageConfig !== undefined) {
      const mergedPc = mergeTailwindPageConfigPatch(next.theme.pageConfig, patch.theme.pageConfig);
      if (!mergedPc.ok) {
        return { ok: false, error: mergedPc.error };
      }
      pageConfigReport = {
        strategy: mergedPc.strategy,
        keysInPatch: mergedPc.patchKeyCount,
      };
      const afterConfig = mergedPc.value;
      const configChanged =
        JSON.stringify(next.theme.pageConfig ?? null) !== JSON.stringify(afterConfig);
      if (configChanged || mergedPc.patchKeyCount > 0) {
        next.theme = { ...next.theme, pageConfig: afterConfig };
        updatedFields.push("theme.pageConfig");
      }
    }
    if (patch.theme.tokenOverrides) {
      next.theme = {
        ...next.theme,
        tokenOverrides: {
          ...(next.theme.tokenOverrides ?? {}),
          ...patch.theme.tokenOverrides,
        },
      };
      updatedFields.push("theme.tokenOverrides");
    }
  }

  if (patch.assets) {
    next.assets = { ...next.assets };
    if (patch.assets.customCss !== undefined) {
      next.assets.customCss = patch.assets.customCss;
      updatedFields.push("assets.customCss");
    }
    if (patch.assets.logoSet !== undefined) {
      next.assets.logoSet = patch.assets.logoSet;
      updatedFields.push("assets.logoSet");
    }
    if (patch.assets.rasterBrandSet !== undefined) {
      next.assets.rasterBrandSet = patch.assets.rasterBrandSet;
      updatedFields.push("assets.rasterBrandSet");
    }
  }

  if (patch.editor) {
    next.editor = { ...next.editor, ...patch.editor };
    updatedFields.push("editor");
  }

  if (patch.sectionUpdates) {
    updatedFields.push("sectionUpdates");
    for (const u of patch.sectionUpdates) {
      const resolved = resolveSectionUpdateIndex(next, u);
      if (!resolved.ok) {
        return { ok: false, error: resolved.error };
      }
      const row = next.sections[resolved.index];
      next.sections[resolved.index] = mergeSectionRow(row, u);
      updatedSectionIds.push(row.id);
    }
  }

  next.generation = {
    ...next.generation,
    source: "ai_command",
    ...(options?.generationModel != null ? { lastModel: options.generationModel } : {}),
  };
  updatedFields.push("generation.source");
  if (options?.generationModel != null) {
    updatedFields.push("generation.lastModel");
  }

  if (next.siteIr != null) {
    next.siteIr = siteIrV1Schema.parse({
      ...next.siteIr,
      sectionIdsOrdered: [...next.composition.sectionIdsOrdered],
    });
  }

  const validated = projectSnapshotSchema.safeParse(next);
  if (!validated.success) {
    return {
      ok: false,
      error: `Snapshot na merge ongeldig: ${validated.error.issues.map((i) => i.message).join("; ")}`,
    };
  }

  const inv = assertProjectSnapshotInvariants(validated.data);
  if (!inv.ok) {
    return { ok: false, error: `Invarianten: ${inv.errors.join("; ")}` };
  }

  return {
    ok: true,
    snapshot: validated.data,
    report: {
      updatedSectionIds: [...new Set(updatedSectionIds)],
      updatedFields: [...new Set(updatedFields)],
      ...(pageConfigReport != null ? { pageConfigMerge: pageConfigReport } : {}),
    },
  };
}

import { z } from "zod";
import {
  sectionIdSchema,
  tailwindPageConfigPatchSchema,
  sectionSemanticRoleSchema,
} from "@/lib/ai/tailwind-sections-schema";
import { generatedLogoSetSchema } from "@/types/logo";
import {
  SNAPSHOT_AI_MAX_HTML_CHARS_PER_SECTION,
  SNAPSHOT_AI_MAX_SECTION_UPDATES,
  SNAPSHOT_COPY_INTENT_MAX,
  SNAPSHOT_COPY_INTENT_MIN_MEANINGFUL,
  SNAPSHOT_CUSTOM_CSS_MAX,
} from "@/lib/site/project-snapshot-constants";
import {
  compositionPlanSchema,
  editorStateSchema,
  projectMetaSchema,
  siteConfigSchema,
} from "@/lib/site/project-snapshot-schema";
import { tokenOverridesPatchSchema } from "@/lib/site/project-snapshot-tokens";

/**
 * **theme** in AI-patch:
 * - `pageConfig` = **subset / deep merge** op bestaande config (zelfde variant: legacy↔legacy, master↔master).
 *   Andere variant of ontbrekende base: patch moet een **volledige** geldige pageConfig zijn.
 * - `tokenOverrides` = vlakke merge (keys overschrijven).
 */
const aiThemePatchSchema = z
  .object({
    pageConfig: tailwindPageConfigPatchSchema.optional(),
    tokenOverrides: tokenOverridesPatchSchema.optional(),
  })
  .strict();

const aiPatchAssetsSchema = z
  .object({
    customCss: z.string().max(SNAPSHOT_CUSTOM_CSS_MAX).optional(),
    logoSet: generatedLogoSetSchema.optional(),
  })
  .strict();

/**
 * AI-contract: **alleen `sectionId`** (geen `index` — index blijft UI-intern).
 * Voorkomt fragiele positionele patches na reorder / merge-flows.
 */
const sectionUpdateRowSchema = z
  .object({
    sectionId: sectionIdSchema,
    sectionName: z.string().max(200).optional(),
    html: z.string().min(1).max(SNAPSHOT_AI_MAX_HTML_CHARS_PER_SECTION).optional(),
    semanticRole: sectionSemanticRoleSchema.optional(),
    /** Optioneel; korter dan minimum → Zod-fout (geen .transform i.v.m. `z.infer` / ontbrekende key in callers). */
    copyIntent: z.string().trim().max(SNAPSHOT_COPY_INTENT_MAX).optional(),
  })
  .strict()
  .superRefine((row, ctx) => {
    const s = row.copyIntent;
    if (s !== undefined && s.trim().length === 0) {
      ctx.addIssue({
        code: "custom",
        message: "copyIntent: niet leeg laten — weglaten van het veld als er geen intent is.",
        path: ["copyIntent"],
      });
      return;
    }
    if (s != null && s.length > 0 && s.length < SNAPSHOT_COPY_INTENT_MIN_MEANINGFUL) {
      ctx.addIssue({
        code: "custom",
        message: `copyIntent: minimaal ${SNAPSHOT_COPY_INTENT_MIN_MEANINGFUL} tekens of weglaten`,
        path: ["copyIntent"],
      });
    }
  });

export const siteAiSnapshotPatchSchema = z
  .object({
    meta: projectMetaSchema.pick({ documentTitle: true }).partial().optional(),
    siteConfig: siteConfigSchema.partial().optional(),
    composition: compositionPlanSchema.partial().optional(),
    theme: aiThemePatchSchema.optional(),
    assets: aiPatchAssetsSchema.optional(),
    editor: editorStateSchema.partial().optional(),
    sectionUpdates: z.array(sectionUpdateRowSchema).max(SNAPSHOT_AI_MAX_SECTION_UPDATES).optional(),
  })
  .strict();

export type SiteAiSnapshotPatch = z.infer<typeof siteAiSnapshotPatchSchema>;

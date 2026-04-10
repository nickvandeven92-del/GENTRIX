import { z, type ZodIssue } from "zod";
import {
  sectionIdSchema,
  slugifyToSectionId,
  tailwindPageConfigSchema,
  tailwindSectionSchema,
  type TailwindPageConfig,
  type TailwindSection,
  type TailwindSectionsPayload,
} from "@/lib/ai/tailwind-sections-schema";
import { generatedLogoSetSchema, type GeneratedLogoSet } from "@/types/logo";
import {
  SNAPSHOT_BRIEF_FINGERPRINT_MAX,
  SNAPSHOT_CUSTOM_CSS_MAX,
  SNAPSHOT_CUSTOM_JS_MAX,
  SNAPSHOT_TAILWIND_COMPILED_CSS_MAX,
  SNAPSHOT_DESCRIPTION_MAX,
  SNAPSHOT_DOCUMENT_TITLE_MAX,
  SNAPSHOT_EDITOR_NOTES_MAX,
  SNAPSHOT_LAST_MODEL_MAX,
  SNAPSHOT_PROMPT_HASH_MAX,
} from "@/lib/site/project-snapshot-constants";
import { contentDensitySchema, layoutPresetIdSchema } from "@/lib/site/project-snapshot-layout";
import { snapshotPageTypeSchema } from "@/lib/site/snapshot-page-type";
import {
  TOKEN_OVERRIDE_KEYS,
  tokenOverridesRecordSchema,
  type TokenOverrideKey,
} from "@/lib/site/project-snapshot-tokens";
import { buildSiteIrV1, siteIrV1Schema } from "@/lib/site/site-ir-schema";

// Re-export voor consumers
export { TOKEN_OVERRIDE_KEYS, tokenOverrideKeySchema, type TokenOverrideKey } from "@/lib/site/project-snapshot-tokens";
export {
  SNAPSHOT_PAGE_TYPES,
  snapshotPageTypeSchema,
  type SnapshotPageType,
} from "@/lib/site/snapshot-page-type";
export { LAYOUT_PRESET_IDS, layoutPresetIdSchema, type LayoutPresetId } from "@/lib/site/project-snapshot-layout";
export { sectionIdSchema, SECTION_ID_RE, slugifyToSectionId } from "@/lib/ai/tailwind-sections-schema";

/**
 * Portable document-snapshot: `site_data_json` / `site_snapshots.payload_json`.
 * Top-level blokken zijn .strict() — geen stille extra keys.
 */

export const PROJECT_SNAPSHOT_FORMAT = "project_snapshot_v1" as const;

const isoDateTimeSchema = z
  .string()
  .min(16)
  .max(40)
  .refine((s) => !Number.isNaN(Date.parse(s)), "Moet geldige ISO-8601 datum/tijd zijn");

/** Wie deze snapshot-inhoud heeft geproduceerd (ook in het document voor export/diff). */
export const snapshotCreatedByKindSchema = z.enum([
  "editor",
  "generator",
  "ai_command",
  "migration",
  "import",
  "system",
  "unknown",
]);

/**
 * **meta** — identiteit & provenance van dit document.
 * Niet: zakelijke content, geen editor UI-state, geen run-telemetrie.
 */
export const projectMetaSchema = z
  .object({
    schemaVersion: z.literal(1),
    documentTitle: z.string().trim().min(1).max(SNAPSHOT_DOCUMENT_TITLE_MAX).optional(),
    createdByKind: snapshotCreatedByKindSchema,
    createdAt: isoDateTimeSchema,
    lastModifiedAt: isoDateTimeSchema,
  })
  .strict();

/**
 * **siteConfig** — zakelijke / SEO-achtige defaults voor het document.
 * Niet: thema-tokens (→ theme), geen sectie-inhoud.
 */
export const siteConfigSchema = z
  .object({
    locale: z.string().trim().min(2).max(16).optional(),
    description: z.string().max(SNAPSHOT_DESCRIPTION_MAX).optional(),
  })
  .strict();

/**
 * **composition** — volgorde & layout-intent.
 * Niet: thema-kleuren, geen HTML.
 */
export const compositionPlanSchema = z
  .object({
    sectionIdsOrdered: z.array(sectionIdSchema).min(1).max(24),
    layoutPresetId: layoutPresetIdSchema.optional(),
    contentDensity: contentDensitySchema.optional(),
    pageType: snapshotPageTypeSchema.optional(),
  })
  .strict();

/**
 * **theme** — visuele tokens + optionele Tailwind pageConfig.
 * Niet: copy, geen sectie-HTML.
 */
export const themeTokensSchema = z
  .object({
    pageConfig: tailwindPageConfigSchema.optional(),
    tokenOverrides: tokenOverridesRecordSchema,
  })
  .strict();

/**
 * **assets** — logo-set en gebruikers-CSS/JS.
 * Niet: secties, geen theme.pageConfig.
 */
export const projectAssetsSchema = z
  .object({
    logoSet: generatedLogoSetSchema.optional(),
    customCss: z.string().max(SNAPSHOT_CUSTOM_CSS_MAX).optional(),
    customJs: z.string().max(SNAPSHOT_CUSTOM_JS_MAX).optional(),
    /** Server-build Tailwind v4 (JIT → CSS); live/preview gebruikt dit i.p.v. cdn.tailwindcss.com. */
    tailwindCompiledCss: z.string().max(SNAPSHOT_TAILWIND_COMPILED_CSS_MAX).optional(),
  })
  .strict();

/**
 * **editor** — persist redactie-context die mee-exporteert.
 * Niet: panel open/dicht, cursor, tijdelijke UI (→ client state / DB apart).
 */
export const editorStateSchema = z
  .object({
    notes: z.string().max(SNAPSHOT_EDITOR_NOTES_MAX).optional(),
  })
  .strict();

/**
 * **generation** — herleidbare provenance voor dit document (lichtgewicht).
 * Niet: volledige prompts, token-tellingen, stream-debug (→ site_generation_runs).
 */
export const generationContextSchema = z
  .object({
    source: z
      .enum(["generator", "editor", "ai_command", "import", "migration", "unknown"])
      .optional(),
    lastModel: z.string().max(SNAPSHOT_LAST_MODEL_MAX).optional(),
    promptHash: z
      .string()
      .max(SNAPSHOT_PROMPT_HASH_MAX)
      .regex(/^[a-f0-9]{32,128}$/i, "promptHash: hex 32–128 chars")
      .optional(),
    briefFingerprint: z
      .string()
      .max(SNAPSHOT_BRIEF_FINGERPRINT_MAX)
      .regex(/^[a-zA-Z0-9:_-]{1,128}$/, "briefFingerprint: alfanumeriek + : _ -")
      .optional(),
  })
  .strict();

/** Secties in snapshot: altijd canonieke `id` + .strict(). */
export const snapshotSectionSchema = tailwindSectionSchema.extend({
  id: sectionIdSchema,
});

export const projectSnapshotSchema = z
  .object({
    format: z.literal(PROJECT_SNAPSHOT_FORMAT),
    meta: projectMetaSchema,
    siteConfig: siteConfigSchema,
    composition: compositionPlanSchema,
    sections: z.array(snapshotSectionSchema).min(1).max(24),
    /** `/site/[slug]/contact` — optioneel; landings-`sections` zonder dit veld = legacy one-pager/split. */
    contactSections: z.array(snapshotSectionSchema).max(12).optional(),
    theme: themeTokensSchema,
    assets: projectAssetsSchema,
    editor: editorStateSchema,
    generation: generationContextSchema,
    /** Site IR v1: blueprint + primaire pagina + module-slots + canonieke volgorde (gesynchroniseerd met `composition`). */
    siteIr: siteIrV1Schema.optional(),
  })
  .strict();

export type ProjectSnapshot = z.infer<typeof projectSnapshotSchema>;
export type ProjectMeta = z.infer<typeof projectMetaSchema>;
export type SiteConfig = z.infer<typeof siteConfigSchema>;
export type CompositionPlan = z.infer<typeof compositionPlanSchema>;
export type ThemeTokens = z.infer<typeof themeTokensSchema>;
export type ProjectAssets = z.infer<typeof projectAssetsSchema>;
export type EditorState = z.infer<typeof editorStateSchema>;
export type GenerationContext = z.infer<typeof generationContextSchema>;
export type SnapshotSection = z.infer<typeof snapshotSectionSchema>;

export type { SiteIrV1 } from "@/lib/site/site-ir-schema";

export type ProjectSnapshotFromTailwindOptions = {
  generationSource?: GenerationContext["source"];
  documentTitle?: string;
  createdByKind?: z.infer<typeof snapshotCreatedByKindSchema>;
  siteIrHints?: {
    blueprintId?: string | null;
    detectedIndustryId?: string | null;
  };
};

export type ProjectSnapshotParseResult =
  | { ok: true; data: ProjectSnapshot }
  | { ok: false; error: string; issues?: ZodIssue[] };

export function safeParseProjectSnapshot(input: unknown): ProjectSnapshotParseResult {
  const r = projectSnapshotSchema.safeParse(input);
  if (r.success) return { ok: true, data: r.data };
  return {
    ok: false,
    error: r.error.issues.map((i) => i.message).join("; "),
    issues: r.error.issues,
  };
}

export function assertProjectSnapshotShape(input: unknown): ProjectSnapshot {
  return projectSnapshotSchema.parse(input);
}

export function validateProjectSnapshot(input: unknown): ProjectSnapshotParseResult {
  return safeParseProjectSnapshot(input);
}

export type AnyProjectSnapshot = ProjectSnapshot;

export function isProjectSnapshotV1(input: unknown): input is ProjectSnapshot {
  return (
    typeof input === "object" &&
    input !== null &&
    (input as { format?: string }).format === PROJECT_SNAPSHOT_FORMAT
  );
}

/** Alleen toegestane tokenOverride-keys behouden. */
export function filterTokenOverrideRecord(
  raw: Record<string, string> | undefined | null,
): Record<TokenOverrideKey, string> {
  const out: Partial<Record<TokenOverrideKey, string>> = {};
  if (!raw) return out as Record<TokenOverrideKey, string>;
  const allow = new Set<string>(TOKEN_OVERRIDE_KEYS as unknown as string[]);
  for (const [k, v] of Object.entries(raw)) {
    if (allow.has(k) && typeof v === "string" && v.length > 0 && v.length <= 500) {
      (out as Record<string, string>)[k] = v;
    }
  }
  return out as Record<TokenOverrideKey, string>;
}

/**
 * @deprecated Gebruik `buildProjectSnapshotFromTailwindPayload` in normalize-module.
 */
export function tailwindSectionsPayloadToProjectSnapshot(
  payload: TailwindSectionsPayload,
  options?: ProjectSnapshotFromTailwindOptions,
): ProjectSnapshot {
  const now = new Date().toISOString();
  const sections: SnapshotSection[] = payload.sections.map((s, i) => {
    const id = s.id ?? slugifyToSectionId(s.sectionName, i);
    return {
      id,
      sectionName: s.sectionName.trim(),
      html: s.html,
      ...(s.semanticRole != null ? { semanticRole: s.semanticRole } : {}),
      ...(s.copyIntent != null ? { copyIntent: s.copyIntent } : {}),
    };
  });
  const contactSectionsRaw = payload.contactSections;
  const contactSections: SnapshotSection[] | undefined =
    contactSectionsRaw != null && contactSectionsRaw.length > 0
      ? contactSectionsRaw.map((s, i) => {
          const id = s.id ?? slugifyToSectionId(s.sectionName, i);
          return {
            id,
            sectionName: s.sectionName.trim(),
            html: s.html,
            ...(s.semanticRole != null ? { semanticRole: s.semanticRole } : {}),
            ...(s.copyIntent != null ? { copyIntent: s.copyIntent } : {}),
          };
        })
      : undefined;
  const sectionIdsOrdered = sections.map((s) => s.id);
  const kind = options?.createdByKind ?? mapSourceToCreatedByKind(options?.generationSource);
  return projectSnapshotSchema.parse({
    format: PROJECT_SNAPSHOT_FORMAT,
    meta: {
      schemaVersion: 1,
      ...(options?.documentTitle != null && options.documentTitle.trim() !== ""
        ? { documentTitle: options.documentTitle.trim().slice(0, SNAPSHOT_DOCUMENT_TITLE_MAX) }
        : {}),
      createdByKind: kind,
      createdAt: now,
      lastModifiedAt: now,
    },
    siteConfig: {},
    composition: {
      sectionIdsOrdered,
      layoutPresetId: "default",
      ...(payload.pageType != null ? { pageType: payload.pageType } : {}),
    },
    sections,
    ...(contactSections != null && contactSections.length > 0 ? { contactSections } : {}),
    theme: {
      pageConfig: payload.config,
      tokenOverrides: {},
    },
    assets: {
      ...(payload.logoSet != null ? { logoSet: payload.logoSet } : {}),
      ...(payload.customCss != null && payload.customCss !== ""
        ? { customCss: payload.customCss.slice(0, SNAPSHOT_CUSTOM_CSS_MAX) }
        : {}),
      ...(payload.customJs != null && payload.customJs !== ""
        ? { customJs: payload.customJs.slice(0, SNAPSHOT_CUSTOM_JS_MAX) }
        : {}),
      ...(payload.tailwindCompiledCss != null && payload.tailwindCompiledCss.trim() !== ""
        ? { tailwindCompiledCss: payload.tailwindCompiledCss.slice(0, SNAPSHOT_TAILWIND_COMPILED_CSS_MAX) }
        : {}),
    },
    editor: {},
    generation: {
      source: options?.generationSource ?? "import",
    },
    siteIr: buildSiteIrV1({
      blueprintId: options?.siteIrHints?.blueprintId ?? undefined,
      detectedIndustryId: options?.siteIrHints?.detectedIndustryId ?? undefined,
      sectionIdsOrdered,
      hasDedicatedContactPage: Boolean(contactSections != null && contactSections.length > 0),
    }),
  });
}

function mapSourceToCreatedByKind(
  source: GenerationContext["source"] | undefined,
): z.infer<typeof snapshotCreatedByKindSchema> {
  switch (source) {
    case "generator":
      return "generator";
    case "editor":
      return "editor";
    case "ai_command":
      return "ai_command";
    case "migration":
      return "migration";
    case "import":
      return "import";
    default:
      return "unknown";
  }
}

export function projectSnapshotToTailwindSectionsPayload(snapshot: ProjectSnapshot): TailwindSectionsPayload {
  const sections: TailwindSection[] = snapshot.sections.map((s) => {
    const row: TailwindSection = {
      id: s.id,
      sectionName: s.sectionName,
      html: s.html,
    };
    if (s.semanticRole != null) row.semanticRole = s.semanticRole;
    if (s.copyIntent != null) row.copyIntent = s.copyIntent;
    return row;
  });
  return {
    format: "tailwind_sections",
    sections,
    ...(snapshot.contactSections != null && snapshot.contactSections.length > 0
      ? {
          contactSections: snapshot.contactSections.map((s) => {
            const row: TailwindSection = {
              id: s.id,
              sectionName: s.sectionName,
              html: s.html,
            };
            if (s.semanticRole != null) row.semanticRole = s.semanticRole;
            if (s.copyIntent != null) row.copyIntent = s.copyIntent;
            return row;
          }),
        }
      : {}),
    ...(snapshot.composition.pageType != null ? { pageType: snapshot.composition.pageType } : {}),
    ...(snapshot.theme.pageConfig != null ? { config: snapshot.theme.pageConfig as TailwindPageConfig } : {}),
    ...(snapshot.assets.customCss != null && snapshot.assets.customCss !== ""
      ? { customCss: snapshot.assets.customCss }
      : {}),
    ...(snapshot.assets.customJs != null && snapshot.assets.customJs !== ""
      ? { customJs: snapshot.assets.customJs }
      : {}),
    ...(snapshot.assets.logoSet != null ? { logoSet: snapshot.assets.logoSet as GeneratedLogoSet } : {}),
    ...(snapshot.assets.tailwindCompiledCss != null && snapshot.assets.tailwindCompiledCss.trim() !== ""
      ? { tailwindCompiledCss: snapshot.assets.tailwindCompiledCss }
      : {}),
  };
}

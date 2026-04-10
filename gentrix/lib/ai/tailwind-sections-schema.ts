import { z } from "zod";
import { designPersonalitySchema } from "@/lib/ai/design-personality";
import { snapshotPageTypeSchema } from "@/lib/site/snapshot-page-type";
import { SNAPSHOT_TAILWIND_COMPILED_CSS_MAX } from "@/lib/site/project-snapshot-constants";
import type { ContentClaimDiagnosticsReport } from "@/lib/ai/content-claim-diagnostics";
import { generatedLogoSetSchema, type GeneratedLogoSet } from "@/types/logo";

// --- Legacy config (bestaande opgeslagen sites) ---

export const legacyTailwindPageConfigSchema = z.object({
  themeName: z.string().min(1).max(120),
  primaryColor: z.string().min(4).max(32),
  fontFamily: z.string().min(1).max(200),
  borderRadius: z.string().min(1).max(80),
});

export type LegacyTailwindPageConfig = z.infer<typeof legacyTailwindPageConfigSchema>;

// --- Master-prompt config (Claude JSON) ---

/** Max. lengte voor \`config.style\` na normalisatie (langere input wordt afgekapt). */
export const MASTER_PROMPT_CONFIG_STYLE_MAX = 2000;

const CONFIG_STYLE_RAW_MAX = 50_000;

function clampConfigStyleString(raw: string): string {
  const t = raw.trim();
  if (t.length <= MASTER_PROMPT_CONFIG_STYLE_MAX) return t;
  return t.slice(0, MASTER_PROMPT_CONFIG_STYLE_MAX);
}

/** Optioneel: stuurt sfeer + schaal — moet in Tailwind-classes terugkomen, niet alleen in JSON. */
export const THEME_VIBE_VALUES = [
  "luxury",
  "rustic",
  "modern",
  "minimal",
  "playful",
  "corporate",
  "creative",
  "warm",
  /** Metaal, werkplaats, ambacht — veel modellen kiezen dit i.p.v. "creative". */
  "industrial",
  /** Handwerk, makers, galerie-achtig — tussen creative en rustic. */
  "artisan",
] as const;

export type ThemeVibe = (typeof THEME_VIBE_VALUES)[number];

export const themeVibeSchema = z.enum(THEME_VIBE_VALUES);

export const THEME_TYPOGRAPHY_VALUES = [
  "modern",
  "elegant",
  "bold",
  "minimal",
  "playful",
  "industrial",
  "artisan",
] as const;

export type ThemeTypographyStyle = (typeof THEME_TYPOGRAPHY_VALUES)[number];

export const themeTypographyStyleSchema = z.enum(THEME_TYPOGRAPHY_VALUES);

const VIBE_ALIASES: Record<string, ThemeVibe> = {
  rugged: "rustic",
  raw: "rustic",
  earthy: "rustic",
  steampunk: "industrial",
  metal: "industrial",
  steel: "industrial",
  workshop: "industrial",
  forge: "industrial",
  mechanical: "industrial",
  craft: "artisan",
  craftsman: "artisan",
  handmade: "artisan",
  gallery: "creative",
  edgy: "modern",
  sleek: "modern",
  tech: "modern",
  technical: "modern",
};

const TYPO_ALIASES: Record<string, ThemeTypographyStyle> = {
  technical: "bold",
  display: "bold",
  condensed: "bold",
  slab: "bold",
  rugged: "bold",
  raw: "bold",
  mechanical: "industrial",
  engineered: "industrial",
  utilitarian: "minimal",
  stark: "minimal",
  geometric: "modern",
  serif: "elegant",
  classic: "elegant",
  monospace: "modern",
};

const vibeSet = new Set<string>(THEME_VIBE_VALUES);
const typoSet = new Set<string>(THEME_TYPOGRAPHY_VALUES);

/** Coerce model-output naar canonieke vibe; ongeldig → undefined (veld wordt genegeerd). */
export function coerceThemeVibeInput(raw: unknown): ThemeVibe | undefined {
  if (raw === undefined || raw === null) return undefined;
  const s = String(raw).toLowerCase().trim();
  if (!s) return undefined;
  if (vibeSet.has(s)) return s as ThemeVibe;
  const mapped = VIBE_ALIASES[s];
  if (mapped) return mapped;
  return undefined;
}

/** Coerce model-output naar canonieke typografie; ongeldig → undefined. */
export function coerceThemeTypographyInput(raw: unknown): ThemeTypographyStyle | undefined {
  if (raw === undefined || raw === null) return undefined;
  const s = String(raw).toLowerCase().trim();
  if (!s) return undefined;
  if (typoSet.has(s)) return s as ThemeTypographyStyle;
  const mapped = TYPO_ALIASES[s];
  if (mapped) return mapped;
  return undefined;
}

export const themeBorderRadiusTokenSchema = z.enum(["none", "sm", "md", "lg", "xl", "2xl", "full"]);

export const themeShadowScaleSchema = z.enum(["none", "sm", "md", "lg", "xl", "2xl"]);

export const themeSpacingScaleSchema = z.enum(["compact", "normal", "relaxed", "generous"]);

export const masterPromptThemeSchema = z
  .object({
    primary: z.string().min(4).max(32),
    accent: z.string().min(4).max(32),
    secondary: z.string().min(4).max(32).optional(),
    primaryLight: z.string().min(4).max(32).optional(),
    primaryMain: z.string().min(4).max(32).optional(),
    primaryDark: z.string().min(4).max(32).optional(),
    secondaryLight: z.string().min(4).max(32).optional(),
    secondaryMain: z.string().min(4).max(32).optional(),
    secondaryDark: z.string().min(4).max(32).optional(),
    background: z.string().min(4).max(32).optional(),
    textColor: z.string().min(4).max(32).optional(),
    textMuted: z.string().min(4).max(32).optional(),
    borderRadius: themeBorderRadiusTokenSchema.optional(),
    shadowScale: themeShadowScaleSchema.optional(),
    spacingScale: themeSpacingScaleSchema.optional(),
    /** Ruwe string van het model → canoniek; onbekend wordt weggelaten. */
    typographyStyle: z.unknown().optional(),
    vibe: z.unknown().optional(),
    /** Optioneel: spiegelt _site_config.personality als het model het in JSON zet. */
    personality: designPersonalitySchema.optional(),
    contrastLevel: z.enum(["high", "medium", "low"]).optional(),
  })
  .transform((row) => {
    const vibe = coerceThemeVibeInput(row.vibe);
    const typographyStyle = coerceThemeTypographyInput(row.typographyStyle);
    const { vibe: _v, typographyStyle: _t, ...rest } = row;
    return {
      ...rest,
      ...(vibe !== undefined ? { vibe } : {}),
      ...(typographyStyle !== undefined ? { typographyStyle } : {}),
    };
  });

export const masterPromptPageConfigSchema = z.object({
  style: z
    .string()
    .min(1)
    .max(CONFIG_STYLE_RAW_MAX)
    .transform((s) => clampConfigStyleString(s)),
  theme: masterPromptThemeSchema,
  font: z.string().min(1).max(200),
});

export type MasterPromptPageConfig = z.infer<typeof masterPromptPageConfigSchema>;

/** Uitgebreid theme-object (optionele velden) zoals Claude het in \`config.theme\` mag vullen. */
export type MasterPromptTheme = z.infer<typeof masterPromptThemeSchema>;

/** Opgeslagen / preview: nieuw of legacy. */
export const tailwindPageConfigSchema = z.union([
  masterPromptPageConfigSchema,
  legacyTailwindPageConfigSchema,
]);

export type TailwindPageConfig = z.infer<typeof tailwindPageConfigSchema>;

/** Gedeeltelijke patch voor AI-merge (subset / deep merge t.o.v. bestaande snapshot). */
export const legacyTailwindPageConfigPatchSchema = legacyTailwindPageConfigSchema.partial().strict();

export const masterPromptPageConfigPatchSchema = z
  .object({
    style: z
      .string()
      .min(1)
      .max(CONFIG_STYLE_RAW_MAX)
      .transform((s) => clampConfigStyleString(s))
      .optional(),
    font: z.string().min(1).max(200).optional(),
    theme: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export const tailwindPageConfigPatchSchema = z.union([
  masterPromptPageConfigPatchSchema,
  legacyTailwindPageConfigPatchSchema,
]);

export type TailwindPageConfigPatch = z.infer<typeof tailwindPageConfigPatchSchema>;

export function isLegacyTailwindPageConfig(c: TailwindPageConfig): c is LegacyTailwindPageConfig {
  return "themeName" in c && "primaryColor" in c;
}

/** Semantische rol per sectie — voor AI-commando’s op snapshot-niveau (geen HTML-parse). */
export const SECTION_SEMANTIC_ROLES = [
  "hero",
  "features",
  "cta",
  "footer",
  "nav",
  "testimonials",
  "pricing",
  "contact",
  "shop",
  "gallery",
  "brands",
  "team",
  "booking",
  "about",
  "generic",
] as const;

export type SectionSemanticRole = (typeof SECTION_SEMANTIC_ROLES)[number];

export const sectionSemanticRoleSchema = z.enum(SECTION_SEMANTIC_ROLES);

/** Canonieke sectie-id: lowercase, cijfers, koppeltekens. */
export const SECTION_ID_RE = /^[a-z0-9-]{1,64}$/;
export const sectionIdSchema = z.string().regex(SECTION_ID_RE);

export function slugifyToSectionId(raw: string, index: number): string {
  const t = raw.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  const base = (t.length >= 1 ? t : `section-${index}`).slice(0, 64);
  return SECTION_ID_RE.test(base) ? base : `section-${index}`;
}

/**
 * Sectie in wire-formaat (editor / Claude / legacy): `id` mag ontbreken tot normalisatie.
 * .strict() — onbekende keys worden geweigerd.
 */
export const tailwindSectionSchema = z
  .object({
    id: sectionIdSchema.optional(),
    sectionName: z.string().trim().min(1).max(200),
    html: z.string().min(1).max(120_000),
    semanticRole: sectionSemanticRoleSchema.optional(),
    copyIntent: z.string().max(500).optional(),
  })
  .strict();

export type TailwindSection = z.infer<typeof tailwindSectionSchema>;

export const tailwindSectionsArraySchema = z.array(tailwindSectionSchema).min(1).max(24);

/** Ruwe Claude-output (Master Prompt): secties met id + html; name optioneel. */
export const claudeTailwindSectionRowSchema = z.object({
  id: z.string().min(1).max(80),
  html: z.string().min(1).max(120_000),
  name: z.string().min(1).max(120).optional(),
});

export const claudeTailwindPageOutputSchema = z.object({
  config: masterPromptPageConfigSchema,
  sections: z.array(claudeTailwindSectionRowSchema).min(1).max(24),
});

export type ClaudeTailwindPageOutput = z.infer<typeof claudeTailwindPageOutputSchema>;

/** Gereserveerd voor vaste app-routes — geen marketingPages-key. */
const RESERVED_MARKETING_PAGE_KEYS = new Set([
  "contact",
  "api",
  "admin",
  "portal",
  "boek",
  "winkel",
  "preview",
  "site",
  "home",
]);

const marketingPageKeyFromClaudeSchema = z
  .string()
  .min(2)
  .max(48)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .refine((s) => !RESERVED_MARKETING_PAGE_KEYS.has(s), "Gereserveerde marketing-slug");

const claudeMarketingPagesRecordSchema = z
  .record(marketingPageKeyFromClaudeSchema, z.array(claudeTailwindSectionRowSchema).min(1).max(16))
  .superRefine((rec, ctx) => {
    if (Object.keys(rec).length > 8) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Maximaal 8 marketing-subpagina's." });
    }
  });

/** Claude master-output: landingspagina + aparte contactpagina (zelfde `config`). */
export const claudeTailwindMarketingSiteOutputSchema = z.object({
  config: masterPromptPageConfigSchema,
  sections: z.array(claudeTailwindSectionRowSchema).min(1).max(24),
  contactSections: z.array(claudeTailwindSectionRowSchema).min(1).max(12),
  /**
   * Vaste subroutes onder `/site/{slug}/<key>` (bv. `wat-wij-doen`, `faq`).
   * Cross-links in HTML: `href="__STUDIO_SITE_BASE__/wat-wij-doen"` en `href="__STUDIO_CONTACT_PATH__"`.
   */
  marketingPages: claudeMarketingPagesRecordSchema.optional(),
});

export type ClaudeTailwindMarketingSiteOutput = z.infer<typeof claudeTailwindMarketingSiteOutputSchema>;

function idToSectionLabel(id: string): string {
  return id
    .split(/[-_]/g)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

export function mapClaudeOutputToSections(page: ClaudeTailwindPageOutput): {
  config: MasterPromptPageConfig;
  sections: TailwindSection[];
} {
  return {
    config: page.config,
    sections: page.sections.map((s, i) => ({
      id: slugifyToSectionId(s.id, i),
      sectionName: s.name?.trim() || idToSectionLabel(s.id) || s.id,
      html: s.html,
    })),
  };
}

export function mapClaudeMarketingSiteOutputToSections(page: ClaudeTailwindMarketingSiteOutput): {
  config: MasterPromptPageConfig;
  sections: TailwindSection[];
  contactSections: TailwindSection[];
  marketingPages?: Record<string, TailwindSection[]>;
} {
  const landing = mapClaudeOutputToSections({ config: page.config, sections: page.sections });
  const contact = mapClaudeOutputToSections({ config: page.config, sections: page.contactSections });
  const marketingPagesRaw = page.marketingPages;
  const marketingPages =
    marketingPagesRaw != null && Object.keys(marketingPagesRaw).length > 0
      ? Object.fromEntries(
          Object.entries(marketingPagesRaw).map(([key, secs]) => {
            const mapped = mapClaudeOutputToSections({ config: page.config, sections: secs });
            return [key, mapped.sections];
          }),
        )
      : undefined;
  return {
    config: landing.config,
    sections: landing.sections,
    contactSections: contact.sections,
    ...(marketingPages != null ? { marketingPages } : {}),
  };
}

const tailwindContactSectionsArraySchema = z.array(tailwindSectionSchema).min(1).max(12);

/** URL-segment voor `/site/{slug}/<key>` (opslag + snapshot). */
export const marketingPageKeyStoredSchema = z
  .string()
  .min(2)
  .max(48)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .refine((s) => !RESERVED_MARKETING_PAGE_KEYS.has(s), "Gereserveerde marketing-slug");

const tailwindMarketingPagesRecordSchema = z
  .record(marketingPageKeyStoredSchema, z.array(tailwindSectionSchema).min(1).max(16))
  .superRefine((rec, ctx) => {
    if (Object.keys(rec).length > 8) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Maximaal 8 marketing-subpagina's." });
    }
  });

const tailwindPayloadStrictObjectSchema = z
  .object({
    format: z.literal("tailwind_sections"),
    /** Paginacontext (landing vs legal, …) — mirror van `composition.pageType` in snapshot. */
    pageType: snapshotPageTypeSchema.optional(),
    config: tailwindPageConfigSchema.optional(),
    sections: tailwindSectionsArraySchema,
    /**
     * Aparte HTML voor `/contact` (formulier hier). Landings-`sections` blijven marketing-only (geen lead-<form>).
     */
    contactSections: tailwindContactSectionsArraySchema.optional(),
    /** Subroutes `/site/{slug}/<key>` naast landing + contact. */
    marketingPages: tailwindMarketingPagesRecordSchema.optional(),
    /** Eigen CSS (editor); wordt gesanitiseerd bij render/export. */
    customCss: z.string().max(48_000).optional(),
    /** Eigen JS (editor); iframe sandbox / live same-origin — alleen vertrouwde code. */
    customJs: z.string().max(48_000).optional(),
    /** SVG-first merkset (premium logo-pipeline). */
    logoSet: generatedLogoSetSchema.optional(),
    /** Optioneel: server-gecompileerde utilities (geen Tailwind Play CDN op live/preview). */
    tailwindCompiledCss: z.string().max(SNAPSHOT_TAILWIND_COMPILED_CSS_MAX).optional(),
  })
  .strict();

/**
 * Verwijdert onbekende root-keys vóór `.strict()` parse (oude clients / copy-paste / dubbele velden).
 * Alleen van toepassing als `format === "tailwind_sections"`; anders ongewijzigd doorgeven.
 */
export function stripUnknownTailwindPayloadKeys(input: unknown): unknown {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return input;
  }
  const o = input as Record<string, unknown>;
  if (o.format !== "tailwind_sections") {
    return input;
  }
  const next: Record<string, unknown> = { format: "tailwind_sections" };
  if ("pageType" in o && o.pageType !== undefined) next.pageType = o.pageType;
  if ("config" in o && o.config !== undefined) next.config = o.config;
  if ("sections" in o && o.sections !== undefined) next.sections = o.sections;
  if ("contactSections" in o && o.contactSections !== undefined) next.contactSections = o.contactSections;
  if ("marketingPages" in o && o.marketingPages !== undefined) next.marketingPages = o.marketingPages;
  if ("customCss" in o && o.customCss !== undefined) next.customCss = o.customCss;
  if ("customJs" in o && o.customJs !== undefined) next.customJs = o.customJs;
  if ("logoSet" in o && o.logoSet !== undefined) next.logoSet = o.logoSet;
  if ("tailwindCompiledCss" in o && o.tailwindCompiledCss !== undefined) next.tailwindCompiledCss = o.tailwindCompiledCss;
  return next;
}

/** Payload voor Supabase `site_data_json` (naast legacy JSON-site). Strikte shape; legacy keys worden gestript. */
export const tailwindSectionsPayloadSchema = z.preprocess(
  stripUnknownTailwindPayloadKeys,
  tailwindPayloadStrictObjectSchema,
);

export type TailwindSectionsPayload = z.infer<typeof tailwindPayloadStrictObjectSchema>;

/** Resultaat na Claude-parsing, klaar voor API + opslag. */
export type GeneratedTailwindPage = {
  config: MasterPromptPageConfig;
  sections: TailwindSection[];
  /** Optioneel: vaste contactroute (`/site/.../contact`); landings-`sections` zonder lead-formulier. */
  contactSections?: TailwindSection[];
  /** Optioneel: `/site/.../<key>` met eigen sectie-HTML. */
  marketingPages?: Record<string, TailwindSection[]>;
  logoSet?: GeneratedLogoSet;
  /** Heuristiek op HTML; voor admin/preview — niet in `site_data_json` persisteren. */
  contentClaimDiagnostics?: ContentClaimDiagnosticsReport;
};

/** Zet generator-output om naar strikte `tailwind_sections`-payload voor Supabase (`site_data_json`). */
export function generatedTailwindPageToSectionsPayload(page: GeneratedTailwindPage): TailwindSectionsPayload {
  return tailwindSectionsPayloadSchema.parse({
    format: "tailwind_sections",
    config: page.config,
    sections: page.sections,
    ...(page.contactSections != null && page.contactSections.length > 0
      ? { contactSections: page.contactSections }
      : {}),
    ...(page.marketingPages != null && Object.keys(page.marketingPages).length > 0
      ? { marketingPages: page.marketingPages }
      : {}),
    ...(page.logoSet != null ? { logoSet: page.logoSet } : {}),
  });
}

export type { GeneratedLogoSet };

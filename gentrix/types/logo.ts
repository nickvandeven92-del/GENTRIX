import { z } from "zod";

export const brandIdentityToneSchema = z.enum([
  "luxury",
  "technical",
  "minimal",
  "playful",
  "editorial",
  "bold",
]);

export const brandIdentityLogoStyleSchema = z.enum([
  "wordmark",
  "monogram",
  "emblem",
  "symbol",
  "combination",
]);

export const typographyDirectionSchema = z.enum([
  "geometric",
  "neo-grotesk",
  "serif",
  "wide",
  "condensed",
]);

export const brandColorModeSchema = z.enum(["monochrome", "brand-accent", "full-brand"]);

export const brandIdentitySchema = z.object({
  brandName: z.string().min(1).max(120),
  industry: z.string().min(1).max(200),
  tone: brandIdentityToneSchema,
  positioning: z.string().min(1).max(400),
  audience: z.string().min(1).max(400),
  visualKeywords: z.array(z.string().min(1).max(80)).min(2).max(16),
  logoStyle: brandIdentityLogoStyleSchema,
  typographyDirection: typographyDirectionSchema,
  symbolDirection: z.string().min(1).max(400),
  avoid: z.array(z.string().min(1).max(120)).min(4).max(24),
  colorMode: brandColorModeSchema,
});

export type BrandIdentity = z.infer<typeof brandIdentitySchema>;

export const logoSpecLayoutSchema = z.enum(["horizontal", "stacked", "icon-only"]);

export const logoSpecStyleSchema = z.enum(["wordmark", "monogram", "combination"]);

export const wordmarkCaseSchema = z.enum(["upper", "lower", "title"]);

export const logoSpecWordmarkSchema = z.object({
  text: z.string().min(1).max(80),
  fontStyle: z.string().min(1).max(120),
  letterSpacing: z.string().min(1).max(32),
  weight: z.number().int().min(300).max(900),
  case: wordmarkCaseSchema,
});

export const symbolTypeSchema = z.enum(["monogram", "abstract", "geometric", "none"]);

export const logoSpecSymbolSchema = z.object({
  type: symbolTypeSchema,
  concept: z.string().min(1).max(400),
  geometryHints: z.array(z.string().min(1).max(80)).max(8),
});

export const logoSpecPaletteSchema = z.object({
  primary: z.string().min(4).max(32),
  secondary: z.string().min(4).max(32).optional(),
  monoDark: z.string().min(4).max(32),
  monoLight: z.string().min(4).max(32),
});

export const logoSpecSchema = z.object({
  id: z.string().min(1).max(64),
  layout: logoSpecLayoutSchema,
  style: logoSpecStyleSchema,
  wordmark: logoSpecWordmarkSchema,
  symbol: logoSpecSymbolSchema,
  palette: logoSpecPaletteSchema,
});

export type LogoSpec = z.infer<typeof logoSpecSchema>;

export const logoCandidateScoreSchema = z.object({
  conceptId: z.string().min(1),
  distinctiveness: z.number().min(0).max(10),
  premiumFeel: z.number().min(0).max(10),
  scalability: z.number().min(0).max(10),
  themeFit: z.number().min(0).max(10),
  faviconStrength: z.number().min(0).max(10),
  total: z.number(),
});

export type LogoCandidateScore = z.infer<typeof logoCandidateScoreSchema>;

export const generatedLogoSetSchema = z.object({
  brandName: z.string().min(1).max(120),
  selectedConcept: z.string().min(1).max(64),
  variants: z.object({
    primary: z.string().min(1).max(120_000),
    light: z.string().min(1).max(120_000),
    dark: z.string().min(1).max(120_000),
    mono: z.string().min(1).max(120_000),
    icon: z.string().min(1).max(120_000),
    favicon: z.string().min(1).max(120_000),
  }),
  metadata: z.object({
    logoStyle: z.string().min(1).max(80),
    typographyDirection: z.string().min(1).max(80),
    symbolConcept: z.string().min(1).max(500),
    usageNotes: z.array(z.string().min(1).max(400)).min(1).max(12),
  }),
});

export type GeneratedLogoSet = z.infer<typeof generatedLogoSetSchema>;

export const logoCandidatesResponseSchema = z
  .object({
    candidates: z.array(logoSpecSchema).length(3),
  })
  .superRefine((data, ctx) => {
    const styles = new Set(data.candidates.map((c) => c.style));
    for (const need of ["wordmark", "monogram", "combination"] as const) {
      if (!styles.has(need)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Verwacht precies één candidate met style "${need}".`,
        });
      }
    }
  });

export type LogoCandidatesResponse = z.infer<typeof logoCandidatesResponseSchema>;

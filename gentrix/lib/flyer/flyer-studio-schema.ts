import { z } from "zod";

export const FLYER_PDF_TEMPLATE_IDS = ["minimal", "modern", "gentrix"] as const;
export type FlyerPdfTemplateId = (typeof FLYER_PDF_TEMPLATE_IDS)[number];

const templateEnum = z.enum(FLYER_PDF_TEMPLATE_IDS);

const copyFieldsStrict = {
  pdfTemplate: templateEnum,
  badge: z.string().max(72),
  headline: z.string().max(140),
  headlineHighlight: z.string().max(100),
  body: z.string().max(900),
};

export const flyerPresetSchema = z
  .object({
    id: z.string().min(8).max(64),
    name: z.string().min(1).max(80),
    ...copyFieldsStrict,
  })
  .strict();

export type FlyerPreset = z.infer<typeof flyerPresetSchema>;

export const flyerStudioPersistedSchema = z
  .object({
    pdfTemplate: templateEnum.default("gentrix"),
    badge: z.string().max(72).default(""),
    headline: z.string().max(140).default(""),
    headlineHighlight: z.string().max(100).default(""),
    body: z.string().max(900).default(""),
    presets: z.array(flyerPresetSchema).max(8).default([]),
  })
  .strict();

export type FlyerStudioPersisted = z.infer<typeof flyerStudioPersistedSchema>;

export function parseFlyerStudioPersisted(raw: unknown): FlyerStudioPersisted {
  if (raw == null || typeof raw !== "object") {
    return flyerStudioPersistedSchema.parse({});
  }
  const parsed = flyerStudioPersistedSchema.safeParse(raw);
  if (parsed.success) return parsed.data;
  return flyerStudioPersistedSchema.parse({});
}

import { z } from "zod";

export const kvkSearchQuerySchema = z.object({
  q: z
    .string()
    .min(2, "Zoekterm minimaal 2 tekens.")
    .max(200, "Zoekterm maximaal 200 tekens."),
  plaats: z.string().max(100).optional(),
  type: z
    .string()
    .optional()
    .transform((s) => {
      if (!s?.trim()) return undefined;
      return s.split(",").map((x) => x.trim()).filter(Boolean);
    }),
  pagina: z.coerce.number().int().min(1).max(1000).optional().default(1),
  resultatenPerPagina: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export const kvkProfileQuerySchema = z.object({
  kvk: z
    .string()
    .min(8)
    .max(12)
    .transform((s) => s.replace(/\s/g, ""))
    .refine((s) => /^[0-9]{8}$/.test(s), "KVK-nummer moet 8 cijfers zijn."),
});

export const leadEnrichBodySchema = z.object({
  kvkNummer: z
    .string()
    .transform((s) => s.replace(/\s/g, ""))
    .refine((s) => /^[0-9]{8}$/.test(s), "kvkNummer: 8 cijfers vereist."),
  manualWebsiteUrl: z.string().max(500).optional().nullable(),
});

import { z } from "zod";

export const clientImageSchema = z.object({
  url: z.string().url(),
  label: z.string().max(120).optional(),
});

export type ClientImage = z.infer<typeof clientImageSchema>;

export const generateSiteRequestBodySchema = z.object({
  businessName: z.string().min(1, "Bedrijfsnaam is verplicht.").max(200),
  description: z.string().min(1, "Omschrijving is verplicht.").max(4000),
  /** Optioneel: koppel een generatie-run aan een bestaande klant (site_generation_runs). */
  subfolder_slug: z.string().min(2).max(64).optional(),
  /** Optioneel: klantfoto's die in de gegenereerde site verwerkt moeten worden. */
  clientImages: z.array(clientImageSchema).max(8).optional(),
  /** Observability / kwaliteit (fase 5): optioneel meesturen vanuit studio. */
  generation_preset_ids: z.array(z.string().min(1).max(120)).max(24).optional(),
  layout_archetypes: z.array(z.string().min(1).max(120)).max(24).optional(),
  /** Optioneel: publieke http(s)-URL; server haalt HTML op als stijl-/structuurhint (geen pixel-perfect kopie). */
  reference_style_url: z.preprocess((v) => {
    if (v == null) return undefined;
    if (typeof v === "string") {
      const t = v.trim();
      return t === "" ? undefined : t;
    }
    return v;
  }, z.string().url("Vul een geldige http(s)-URL in.").max(512).optional()),
});

export type GenerateSiteRequestBody = z.infer<typeof generateSiteRequestBodySchema>;

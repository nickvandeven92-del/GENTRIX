import { z } from "zod";

/**
 * Één herkenbare compositie-lijn per site — Denklijn kiest; generator + review moeten die niet
 * “veilig” terugvlakken naar generieke SaaS zonder reden.
 */
export const siteSignatureArchetypeSchema = z.enum([
  "editorial_typography",
  "asymmetric_split_hero",
  "horizontal_editorial_band",
  "bento_uneven_grid",
  "minimal_luxury_sparse",
  "warm_paper_rhythm",
  "conversion_forward",
  "immersive_media_hero",
]);

export type SiteSignatureArchetype = z.infer<typeof siteSignatureArchetypeSchema>;

export const SITE_SIGNATURE_ARCHETYPE_LABELS: Record<SiteSignatureArchetype, string> = {
  editorial_typography: "Editorial typografie — koppen en witruimte leidend, weinig UI-chrome.",
  asymmetric_split_hero: "Asymmetrische split-hero — ongelijke kolommen / crop, duidelijke hiërarchie.",
  horizontal_editorial_band: "Horizontale editoriale band — brede strook met citaat/cijfer/statement i.p.v. tegelmuur.",
  bento_uneven_grid: "Bento / ongelijk grid — cellen met verschillende span, geen 3×2 identieke kaarten.",
  minimal_luxury_sparse: "Minimal luxe — spaarzaam, rustig, veel adem; geen drukke marketing-stack.",
  warm_paper_rhythm: "Warm papier-ritme — zand/crème/stone banden, warme sectiewissel.",
  conversion_forward: "Conversion-forward — duidelijke hiërarchie, sterke primaire CTA’s, scanbare flow.",
  immersive_media_hero: "Immersive media — hero domineert door beeld of full-bleed (binnen briefing/stock-regels).",
};

export const siteSignatureSchema = z.object({
  archetype: siteSignatureArchetypeSchema,
  /** NL: concreet wat deze site visueel onderscheidt van een standaard marketinglandingspagina. */
  commitment_nl: z.string().min(28).max(420),
  /** 1–4 korte anti-template regels (NL), bv. "geen 3×2 USP-raster". */
  anti_templates_nl: z.array(z.string().min(12).max(160)).min(1).max(4),
});

export type SiteSignature = z.infer<typeof siteSignatureSchema>;

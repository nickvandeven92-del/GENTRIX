import { z } from "zod";

/** Eén navigatielink (desktop + mobiel drawer). */
export const studioNavLinkSchema = z.object({
  label: z.string().min(1).max(80),
  href: z.string().min(1).max(600),
});

export type StudioNavLink = z.infer<typeof studioNavLinkSchema>;

/**
 * Declaratieve primaire site-nav (Option B): de renderer bouwt quote-veilige HTML;
 * de AI-header in de hero-sectie wordt bij compose verwijderd zodat er geen dubbele chrome is.
 */
export const studioNavChromeConfigSchema = z.object({
  /** `bar` = volle breedte balk; `pill` = zwevende pill onder top. */
  variant: z.enum(["bar", "pill"]),
  brandLabel: z.string().min(1).max(120),
  brandHref: z.string().min(1).max(600).default("__STUDIO_SITE_BASE__"),
  items: z.array(studioNavLinkSchema).min(1).max(16),
  cta: studioNavLinkSchema.optional(),
});

export type StudioNavChromeConfig = z.infer<typeof studioNavChromeConfigSchema>;

import { z } from "zod";
import {
  studioNavVisualAllowedOverridesSchema,
  studioNavVisualPresetIdSchema,
} from "@/lib/site/studio-nav-visual-presets";

/** NL / model-synoniemen → canonieke layout (ongeldig → weglaten). */
export function coerceStudioNavBarLayout(raw: unknown): "standard" | "centeredLinks" | undefined {
  if (raw === undefined || raw === null || raw === "") return undefined;
  const s = String(raw)
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "");
  if (["standard", "default", "split", "left", "classic", "brandleft"].includes(s)) return "standard";
  if (
    [
      "centeredlinks",
      "centered",
      "center",
      "middle",
      "links-centered",
      "linkscentered",
      "navcenter",
      "balanced",
      "symmetric",
    ].includes(s)
  ) {
    return "centeredLinks";
  }
  return undefined;
}

const studioNavBarLayoutSchema = z.preprocess(
  (v) => coerceStudioNavBarLayout(v),
  z.enum(["standard", "centeredLinks"]).optional(),
);

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
  /**
   * Curated visuele preset; overschrijft legacy `surface`-mapping tenzij alleen overrides gebruikt worden.
   * Zonder preset: server leidt af uit `variant` + `surface` + optioneel designcontract (zie `resolveNavVisualPreset`).
   */
  navVisualPreset: studioNavVisualPresetIdSchema.optional(),
  /** Alleen `height` \| `ctaStyle` \| `activeIndicator` (geen surface/shadow/border via JSON). */
  navVisualOverrides: studioNavVisualAllowedOverridesSchema.optional(),
  /**
   * Desktop-opmaak van merk + links + CTA. Zet op `centeredLinks` wanneer de opdracht vraagt om
   * gecentreerde menulinks (merk links, linkgroep visueel in het midden, CTA rechts). Standaard: `standard`.
   */
  navBarLayout: studioNavBarLayoutSchema.optional(),
  /**
   * `frosted` (standaard): lichte, high-end balk (wit/transparant) met donkere type — past bij lichte hero’s.
   * `tinted`: shell volgt primary-kleur (donker bij donkere primary); zeldzamer, o.a. donkere merk-identiteit.
   * **Legacy** i.f.m. `navVisualPreset`: zonder preset wordt dit naar een preset-basis gemapt.
   */
  surface: z.enum(["frosted", "tinted"]).optional(),
  brandLabel: z.string().min(1).max(120),
  brandHref: z.string().min(1).max(600).default("__STUDIO_SITE_BASE__"),
  items: z.array(studioNavLinkSchema).min(1).max(16),
  cta: studioNavLinkSchema.optional(),
});

export type StudioNavChromeConfig = z.infer<typeof studioNavChromeConfigSchema>;

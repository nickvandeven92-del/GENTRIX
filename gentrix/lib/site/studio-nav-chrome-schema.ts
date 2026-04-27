import { z } from "zod";
import {
  studioNavVisualAllowedOverridesSchema,
  studioNavVisualPresetInputSchema,
} from "@/lib/site/studio-nav-visual-presets";

/** NL / model-synoniemen → canonieke layout (ongeldig → weglaten). */
export function coerceStudioNavBarLayout(
  raw: unknown,
): "standard" | "centeredLinks" | "linksRightInHero" | undefined {
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
  if (
    [
      "linksrightinhero",
      "heroright",
      "overlayright",
      "inhero",
      "herooverlay",
      "navinhero",
      "overlayhero",
      "rechtsinhero",
      "navbovenhero",
    ].includes(s)
  ) {
    return "linksRightInHero";
  }
  return undefined;
}

const studioNavBarLayoutSchema = z.preprocess(
  (v) => coerceStudioNavBarLayout(v),
  z.enum(["standard", "centeredLinks", "linksRightInHero"]).optional(),
);

/**
 * Optionele kleuren **alleen voor de vaste nav-shell** (CTA, accentlijnen, donkere balk-tint, sheet-rand).
 * Pagina-`config.theme` blijft leidend voor body/secties; laat weg om volledig mee te lopen met het pagina-thema.
 */
export const studioNavChromeThemeSchema = z
  .object({
    primary: z.string().min(4).max(32).optional(),
    accent: z.string().min(4).max(32).optional(),
  })
  .strict();

export type StudioNavChromeTheme = z.infer<typeof studioNavChromeThemeSchema>;

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
export const studioNavChromeConfigSchema = z
  .object({
  /** `bar` = volle breedte balk; `pill` = zwevende pill onder top. */
  variant: z.enum(["bar", "pill"]),
  /**
   * Curated visuele preset; overschrijft legacy `surface`-mapping tenzij alleen overrides gebruikt worden.
   * Zonder preset: server leidt af uit `variant` + `surface` + optioneel designcontract (zie `resolveNavVisualPreset`).
   * Synoniemen o.a. `floating` / `zwevend` → `floatingPill`.
   */
  navVisualPreset: studioNavVisualPresetInputSchema.optional(),
  /** Alleen `height` \| `ctaStyle` \| `activeIndicator` (geen surface/shadow/border via JSON). */
  navVisualOverrides: studioNavVisualAllowedOverridesSchema.optional(),
  /**
   * Desktop-opmaak van merk + links + CTA. Zet op `centeredLinks` wanneer de opdracht vraagt om
   * gecentreerde menulinks (merk links, linkgroep visueel in het midden, CTA rechts). Standaard: `standard`.
   *
   * `linksRightInHero`: voor **lichte/glas bar-presets** (`minimalLight`, `softBrand`, `compactBar`, `glassLight`) en
   * **`floatingPill`** (zwevende pill): **zwevende** cluster rechtsboven op de hero (`rounded-2xl`, donker glas + lichte type),
   * geen volle-breedte balk; **pill** (alle layouts) heeft geen layout-spacer — nav `fixed` boven de eerste sectie. Desktop: links + CTA in dezelfde rij; mobiel: **hamburger** + sheet met CTA als gewone link in de lijst.
   * Bij donkere/gouden presets wordt dit veld **genegeerd** (normale bar + spacer).
   */
  navBarLayout: studioNavBarLayoutSchema.optional(),
  /** Eigen primary/accent hex voor de nav-shell; overschrijft niet `config.theme` voor de rest van de pagina. */
  navChromeTheme: studioNavChromeThemeSchema.optional(),
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
})
  .transform((row) => {
    if (row.navVisualPreset === "floatingPill" && row.variant === "bar") {
      return { ...row, variant: "pill" as const };
    }
    return row;
  });

export type StudioNavChromeConfig = z.infer<typeof studioNavChromeConfigSchema>;

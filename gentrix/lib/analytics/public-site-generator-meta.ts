import type { TailwindPageConfig } from "@/lib/ai/tailwind-sections-schema";
import { isLegacyTailwindPageConfig } from "@/lib/ai/tailwind-sections-schema";
import type { SiteIrV1 } from "@/lib/site/site-ir-schema";

/** Alleen stringwaarden — past in first-party `properties` + API-sanitization. */
export type PublicSiteGeneratorMeta = Record<string, string>;

/**
 * Optionele generator-/snapshot-hints voor aggregatie (page_view); mag leeg blijven.
 */
export function buildPublicSiteGeneratorMeta(input: {
  generationPackage?: string | null;
  sectionIdsOrdered?: readonly string[] | null;
  siteIr?: SiteIrV1 | null;
  config?: TailwindPageConfig | null;
}): PublicSiteGeneratorMeta {
  const out: PublicSiteGeneratorMeta = {};
  const order = input.siteIr?.sectionIdsOrdered ?? input.sectionIdsOrdered;
  if (order != null && order.length > 0) {
    out.section_order_signature = order.map((s) => String(s).trim()).join("|").slice(0, 500);
  }
  const gp = input.generationPackage?.trim();
  if (gp) {
    out.generated_site_version = gp.slice(0, 120);
  }
  const c = input.config;
  if (c && !isLegacyTailwindPageConfig(c)) {
    const sn = c.studioNav;
    if (sn?.navBarLayout) {
      out.nav_variant = String(sn.navBarLayout).slice(0, 80);
    } else if (sn?.variant) {
      out.nav_variant = String(sn.variant).slice(0, 80);
    }
    if (sn?.navVisualPreset) {
      out.design_preset_id = String(sn.navVisualPreset).slice(0, 120);
    }
    const th = c.theme;
    if (th && typeof th === "object" && "vibe" in th) {
      const v = (th as { vibe?: string }).vibe;
      if (typeof v === "string" && v.trim()) {
        out.site_template_id = v.trim().slice(0, 120);
      }
    }
  }
  return out;
}

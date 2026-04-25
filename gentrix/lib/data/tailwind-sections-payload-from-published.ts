import type { TailwindSectionsPayload } from "@/lib/ai/tailwind-sections-schema";
import type { PublishedSitePayload } from "@/lib/site/project-published-payload";

/**
 * Pure mapping: geen Node/Tailwind-CLI — veilig in client components.
 * Zelfde shape als voor `attachCompiledTailwindCssToPayload` / compile-preview API.
 */
export function tailwindSectionsPayloadFromPublishedTailwind(
  p: Extract<PublishedSitePayload, { kind: "tailwind" }>,
): TailwindSectionsPayload {
  return {
    format: "tailwind_sections",
    sections: p.sections,
    ...(p.config != null ? { config: p.config } : {}),
    ...(p.customCss != null && p.customCss !== "" ? { customCss: p.customCss } : {}),
    ...(p.customJs != null && p.customJs !== "" ? { customJs: p.customJs } : {}),
    ...(p.logoSet != null ? { logoSet: p.logoSet } : {}),
    ...(p.rasterBrandSet != null ? { rasterBrandSet: p.rasterBrandSet } : {}),
    ...(p.contactSections != null && p.contactSections.length > 0 ? { contactSections: p.contactSections } : {}),
    ...(p.marketingPages != null && Object.keys(p.marketingPages).length > 0
      ? { marketingPages: p.marketingPages }
      : {}),
  };
}

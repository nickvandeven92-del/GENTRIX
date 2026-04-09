import type { TailwindSection } from "@/lib/ai/tailwind-sections-schema";
import { STUDIO_SHOP_PATH_PLACEHOLDER } from "@/lib/site/studio-section-visibility";

/**
 * Publieke site: als webshop-module uit staat, geen shop-sectie en geen werkende webshop-placeholders.
 */
export function filterTailwindSectionsForWebshop(
  sections: TailwindSection[],
  webshopEnabled: boolean,
): TailwindSection[] {
  if (webshopEnabled) return sections;
  return sections
    .filter((s) => s.id !== "shop")
    .map((s) => ({
      ...s,
      html: s.html.split(STUDIO_SHOP_PATH_PLACEHOLDER).join("#"),
    }));
}

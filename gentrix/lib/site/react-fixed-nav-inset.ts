import type { ReactSiteSection } from "@/lib/site/react-site-schema";

/**
 * `nav_overlay` is `position: fixed` — inhoud van volgende secties verdwijnt onder de pill
 * zonder extra boven-padding / scroll-margin.
 */
export function classForFixedNavOverlap(
  sectionType: ReactSiteSection["type"],
  hasFixedNav: boolean,
): string {
  if (!hasFixedNav) return "";
  if (sectionType === "nav_overlay" || sectionType === "hero_cinematic") return "";
  return "pt-24 scroll-mt-24 sm:pt-28 sm:scroll-mt-28";
}

export function siteHasFixedNavOverlay(sections: readonly { type: string }[]): boolean {
  return sections[0]?.type === "nav_overlay";
}

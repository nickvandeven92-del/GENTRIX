import type { ReactSiteSection } from "@/lib/site/react-site-schema";

/** Publieke site: geen secties met `studioVisibility: "portal"`. */
export function filterReactSectionsForPublicSite(sections: ReactSiteSection[]): ReactSiteSection[] {
  return sections.filter((s) => {
    /** Hoofdnav (`nav_overlay`) moet op de marketingpagina blijven — model/JSON zet die soms ten onrechte op `portal`. */
    if (s.type === "nav_overlay") return true;
    return s.studioVisibility !== "portal";
  });
}

/** Zelfde als Tailwind `id: "shop"`-filter: verberg shop-blok op /site wanneer webshop uit staat. */
export function filterReactSectionsForWebshop(
  sections: ReactSiteSection[],
  webshopEnabled: boolean,
): ReactSiteSection[] {
  if (webshopEnabled) return sections;
  return sections.filter((s) => s.id !== "shop");
}

/** Alleen portaal-secties (achter login). */
export function filterReactSectionsForPortalOnly(sections: ReactSiteSection[]): ReactSiteSection[] {
  return sections.filter((s) => s.studioVisibility === "portal");
}

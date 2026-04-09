import type { SiteConfig } from "@/lib/ai/build-site-config";
import { limitCustomSections } from "@/lib/ai/custom-section-budget";
import { mergeHomepageSections, type MergedSection } from "@/lib/ai/merge-homepage-sections";
import { isHomepageSectionId, pruneHomepageSections, type HomepageSectionId } from "@/lib/ai/prune-homepage-sections";
import { resolvePageCompactness } from "@/lib/ai/resolve-page-compactness";
import { resolveRenderConstraints, type RenderConstraints } from "@/lib/ai/resolve-render-constraints";
import { resolveSectionContentBudget } from "@/lib/ai/resolve-section-content-budget";
import type { CompactnessProfile } from "@/types/pageCompactness";
import type { SectionContentBudget } from "@/types/sectionContentBudget";

export type HomepageCompactnessPlan = {
  /** Canonieke homepage-secties na prune (zelfde volgorde-logica als input). */
  sections: HomepageSectionId[];
  mergedSections: MergedSection[];
  /** Custom id’s na cap (volgorde uit bron behouden). */
  customSectionsLimited: string[];
  /** Voor `siteConfig.sections`: canoniek + gecapte custom. */
  fullSectionList: string[];
  compactness: CompactnessProfile;
  contentBudget: SectionContentBudget;
  renderConstraints: RenderConstraints;
};

/**
 * Één centrale planning: compactness, prune, merge, content-budget, render-constraints + custom cap.
 * Productiecode die meerdere van deze dimensies nodig heeft, moet **dit** gebruiken — niet los
 * `resolvePageCompactness` + `resolveSectionContentBudget` + prune/merge combineren (voorkomt drift).
 * `applyHomepageCompactnessToSiteConfig` delegeert hiernaartoe.
 */
export function buildHomepageCompactnessPlan(siteConfig: SiteConfig): HomepageCompactnessPlan {
  const compactness = resolvePageCompactness(siteConfig);
  const contentBudget = resolveSectionContentBudget(compactness);

  const rawSections = Array.isArray(siteConfig.sections) ? siteConfig.sections : [];
  const canonicalOrdered = rawSections.filter(isHomepageSectionId);
  const customOrdered = rawSections.filter((s) => !isHomepageSectionId(s));

  const sections =
    canonicalOrdered.length > 0 ? pruneHomepageSections(canonicalOrdered, compactness) : [];
  const mergedSections = mergeHomepageSections(sections, compactness);
  const renderConstraints = resolveRenderConstraints(compactness);
  const customSectionsLimited = limitCustomSections(customOrdered, compactness);
  const fullSectionList = [...sections, ...customSectionsLimited];

  return {
    sections,
    mergedSections,
    customSectionsLimited,
    fullSectionList,
    compactness,
    contentBudget,
    renderConstraints,
  };
}

/**
 * Past `fullSectionList` + `page_length_target` uit het compactness-plan toe.
 * Geef `existingPlan` door als je `buildHomepageCompactnessPlan` al hebt aangeroepen (één berekening).
 */
export function applyHomepageCompactnessToSiteConfig(
  siteConfig: SiteConfig,
  existingPlan?: HomepageCompactnessPlan,
): SiteConfig {
  const plan = existingPlan ?? buildHomepageCompactnessPlan(siteConfig);
  return {
    ...siteConfig,
    sections: plan.fullSectionList,
    page_length_target: plan.compactness.pageLengthTarget,
  };
}

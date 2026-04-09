import type { SiteConfig } from "@/lib/ai/build-site-config";
import {
  deriveLeanSectionsFromHomepagePlan,
  type HomepagePlan,
} from "@/lib/ai/build-homepage-plan";
import type { SiteIntent } from "@/lib/ai/site-experience-model";

/**
 * Canonieke sectie-id's die `buildStudioPromptLayoutMaps` direct herkent: hero, features, services,
 * trust, testimonials, pricing, faq, portfolio, about, story, cta, contact, footer.
 * Andere id's vallen terug op de features-pool in de layout-mapper.
 */

function mapConversionToPrimaryGoal(intent: SiteIntent): SiteConfig["primary_goal"] {
  switch (intent.conversionModel) {
    case "direct_purchase":
      return "sales";
    case "content_discovery":
    case "search_discovery":
      return "branding";
    case "membership_signup":
      return "signup";
    case "lead_capture":
    case "hybrid":
    default:
      return "lead_generation";
  }
}

function mapDensityToLayoutDensity(intent: SiteIntent): SiteConfig["layout_density"] {
  if (intent.densityProfile === "airy") return "spacious";
  if (intent.densityProfile === "dense_commerce") return "compact";
  return "balanced";
}

function mapVisualStyle(intent: SiteIntent): string {
  if (intent.experienceModel === "editorial_content_hub" || intent.experienceModel === "brand_storytelling") {
    return "editorial_rhythm_depth";
  }
  if (intent.experienceModel === "ecommerce_home" || intent.experienceModel === "search_first_catalog") {
    return "commerce_grid_depth";
  }
  return "high_contrast_depth";
}

export function applySiteIntentToSiteConfigFields(
  intent: SiteIntent,
  homepagePlan: HomepagePlan,
): Pick<SiteConfig, "sections" | "layout_density" | "visual_style" | "primary_goal" | "site_intent"> {
  return {
    site_intent: intent,
    sections: deriveLeanSectionsFromHomepagePlan(homepagePlan, intent),
    layout_density: mapDensityToLayoutDensity(intent),
    visual_style: mapVisualStyle(intent),
    primary_goal: mapConversionToPrimaryGoal(intent),
  };
}

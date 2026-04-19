import type { TailwindSection } from "@/lib/ai/tailwind-sections-schema";
import {
  logSiteIrComposePlanMismatches,
  orderTailwindSectionsByIdPlan,
} from "@/lib/site/compose-site-plan";
import { coerceHeaderWhatsappLinksToBookingPlaceholder } from "@/lib/site/coerce-appointment-header-hrefs";
import { ensureStudioModuleMarkersOnAnchors } from "@/lib/site/ensure-studio-module-markers-on-anchors";
import { filterTailwindSectionsForPublicSiteModuleFlags } from "@/lib/site/filter-tailwind-public-modules";
import {
  inactivePublicSiteModuleIds,
  type PublicSiteModuleFlags,
} from "@/lib/site/public-site-modules-registry";
import {
  stripInactivePublicModuleMarkupFromHtml,
  stripPublicSiteComposeDataAttributesFromHtml,
} from "@/lib/site/strip-public-module-markup";
import type { SiteIrV1 } from "@/lib/site/site-ir-schema";

export type { PublicSiteModuleFlags } from "@/lib/site/public-site-modules-registry";

/**
 * Optioneel: volgorde uit **`siteIr.sectionIdsOrdered`** (voorkeur) of legacy `sectionIdsOrdered` op het plan.
 */
export type ComposePublicMarketingPlan = {
  sectionIdsOrdered?: readonly string[] | null;
  siteIr?: SiteIrV1 | null;
};

function sectionIdsOrderFromComposePlan(plan?: ComposePublicMarketingPlan | null): readonly string[] | undefined {
  const fromIr = plan?.siteIr?.sectionIdsOrdered;
  if (fromIr != null && fromIr.length > 0) return fromIr;
  return plan?.sectionIdsOrdered ?? undefined;
}

/**
 * Enige samengestelde stap voor publieke Tailwind-marketing: optioneel ordenen volgens snapshot,
 * tagging, zone/module-strip, canonieke secties + placeholders via het module-register,
 * daarna compose-attributen opruimen.
 */
export function composePublicMarketingTailwindSections(
  sections: TailwindSection[],
  flags: PublicSiteModuleFlags,
  plan?: ComposePublicMarketingPlan | null,
): TailwindSection[] {
  const ordered = orderTailwindSectionsByIdPlan(sections, sectionIdsOrderFromComposePlan(plan));
  logSiteIrComposePlanMismatches(plan?.siteIr, ordered, flags);

  const inactive = inactivePublicSiteModuleIds(flags);

  const preTagged =
    flags.appointmentsEnabled === true
      ? ordered.map((s) => ({
          ...s,
          html: coerceHeaderWhatsappLinksToBookingPlaceholder(s.html),
        }))
      : ordered;

  const tagged = preTagged.map((s) => ({
    ...s,
    html: ensureStudioModuleMarkersOnAnchors(s.html),
  }));

  const strippedMarkup = tagged.map((s) => ({
    ...s,
    html:
      inactive.size === 0 ? s.html : stripInactivePublicModuleMarkupFromHtml(s.html, inactive),
  }));

  const afterInactive = filterTailwindSectionsForPublicSiteModuleFlags(strippedMarkup, flags);

  return afterInactive.map((s) => ({
    ...s,
    html: stripPublicSiteComposeDataAttributesFromHtml(s.html),
  }));
}

"use client";

import dynamic from "next/dynamic";
import type { ConceptFlyerExperienceProps } from "@/components/site/concept-flyer-experience";

const ConceptFlyerExperienceClient = dynamic(
  () =>
    import("@/components/site/concept-flyer-experience").then((m) => ({
      default: m.ConceptFlyerExperience,
    })),
  { ssr: false, loading: () => null },
);

/**
 * Flyer-chrome in een aparte client-chunk: de site (`PublishedSiteView`) kan eerst parseren en painten,
 * gelijker aan live. Zonder `ssr` voor deze shell blijft de zware flyer-UI uit de kritieke server/stream.
 */
export function ConceptFlyerExperienceLazy(props: ConceptFlyerExperienceProps) {
  return <ConceptFlyerExperienceClient {...props} />;
}

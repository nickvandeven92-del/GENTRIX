import { getBasisprofiel, getVestigingenList } from "@/lib/kvk/client";
import { mapBasisprofielToProfile } from "@/lib/kvk/mappers";
import { analyzeWebsite } from "@/lib/leads/analyze-website";
import { detectWebsiteForLead } from "@/lib/leads/detect-website";
import { generateLeadOpportunity } from "@/lib/leads/generate-opportunity";
import type { EnrichedLeadPayload } from "@/lib/leads/kvk-enrichment-types";

export type EnrichLeadInput = {
  kvkNummer: string;
  manualWebsiteUrl?: string | null;
};

/**
 * Volledige server-side enrichment: Basisprofiel → website-detectie → kwaliteit → sales-label.
 */
export async function runLeadEnrichment(input: EnrichLeadInput): Promise<EnrichedLeadPayload> {
  const [basis, vestigingen] = await Promise.all([
    getBasisprofiel(input.kvkNummer),
    getVestigingenList(input.kvkNummer),
  ]);

  const profile = mapBasisprofielToProfile(basis, vestigingen);

  const detection = await detectWebsiteForLead({
    profile,
    manualWebsiteUrl: input.manualWebsiteUrl,
  });

  let quality = null;
  const urlToAnalyze = detection.finalUrl ?? detection.detectedUrl;
  const canAnalyze =
    Boolean(urlToAnalyze) &&
    detection.outcome !== "not_found" &&
    detection.outcome !== "uncertain" &&
    detection.reachability !== "broken";

  if (canAnalyze && urlToAnalyze) {
    try {
      quality = await analyzeWebsite(urlToAnalyze);
    } catch (e) {
      console.warn("[enrich-pipeline] analyzeWebsite failed", e);
    }
  }

  const opportunity = generateLeadOpportunity(profile, detection, quality);

  return {
    profile,
    detection,
    quality,
    opportunity,
  };
}

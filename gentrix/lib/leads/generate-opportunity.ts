import type { KvkMappedProfile, LeadOpportunity, WebsiteDetectionResult, WebsiteQualityAnalysis } from "@/lib/leads/kvk-enrichment-types";

function baseOpportunityFromStatus(status: LeadOpportunity["websiteStatus"]): {
  score: number;
  callAngle: string;
  reasons: string[];
} {
  switch (status) {
    case "geen_website":
      return {
        score: 88,
        callAngle:
          "Geen duidelijke website gevonden; grote kans op directe waardepropositie met een eerste professionele site.",
        reasons: ["NO_SITE", "GREENFIELD"],
      };
    case "website_kapot":
      return {
        score: 82,
        callAngle:
          "Website lijkt niet gezond bereikbaar; insteek op betrouwbaarheid, zoekbaarheid en omzet die nu weglekken.",
        reasons: ["SITE_UNREACHABLE", "RISK_TRUST"],
      };
    case "website_zwak":
      return {
        score: 76,
        callAngle:
          "Website aanwezig maar mist basisvertrouwen en conversiesignalen — verbetering levert snel meetbaar rendement.",
        reasons: ["WEAK_QUALITY", "CONVERSION_GAP"],
      };
    case "website_redelijk":
      return {
        score: 52,
        callAngle:
          "Redelijke basis online; positioneer doorontwikkeling, SEO/content of campagnelandingen als volgende stap.",
        reasons: ["MODERATE_QUALITY", "OPTIMIZE_NEXT"],
      };
    case "website_sterk":
      return {
        score: 34,
        callAngle:
          "Minder koude kans; focus op groei, redesign, automatisering of performance in plaats van alleen ‘een website’.",
        reasons: ["STRONG_BASELINE", "UPMARKET_ANGLE"],
      };
  }
}

/**
 * Combineert KVK-profiel, bereikbaarheid en kwaliteitsscore tot één sales-label.
 */
export function generateLeadOpportunity(
  profile: KvkMappedProfile,
  websiteDetection: WebsiteDetectionResult,
  qualityAnalysis: WebsiteQualityAnalysis | null,
): LeadOpportunity {
  const reasons: string[] = [];

  if (websiteDetection.outcome === "not_found" || !websiteDetection.detectedUrl) {
    const b = baseOpportunityFromStatus("geen_website");
    if (profile.websites.length) reasons.push("KVK_VERMELDT_URL_MAAR_ONBRUIKBAAR");
    return {
      websiteStatus: "geen_website",
      opportunityScore: b.score,
      callAngle: b.callAngle,
      reasonCodes: [...b.reasons, ...reasons],
    };
  }

  if (
    websiteDetection.outcome === "uncertain" ||
    websiteDetection.reachability === "unknown"
  ) {
    const b = baseOpportunityFromStatus("website_kapot");
    return {
      websiteStatus: "website_kapot",
      opportunityScore: Math.max(60, b.score - 10),
      callAngle:
        "Kon website niet betrouwbaar verifiëren — bied een technische health-check en duidelijke uptime/conversie-aanpak.",
      reasonCodes: [...b.reasons, "UNCERTAIN_PROBE"],
    };
  }

  if (websiteDetection.reachability === "broken" || websiteDetection.outcome === "found_broken") {
    const b = baseOpportunityFromStatus("website_kapot");
    return {
      websiteStatus: "website_kapot",
      opportunityScore: b.score,
      callAngle: b.callAngle,
      reasonCodes: [...b.reasons, `HTTP_${websiteDetection.httpStatus ?? "?"}`],
    };
  }

  const q = qualityAnalysis;
  if (!q || q.verdict === "broken") {
    const b = baseOpportunityFromStatus("website_kapot");
    return {
      websiteStatus: "website_kapot",
      opportunityScore: b.score - 5,
      callAngle: b.callAngle,
      reasonCodes: [...b.reasons, "QUALITY_BROKEN_OR_EMPTY"],
    };
  }

  let websiteStatus: LeadOpportunity["websiteStatus"];
  if (q.verdict === "strong") websiteStatus = "website_sterk";
  else if (q.verdict === "average") websiteStatus = "website_redelijk";
  else websiteStatus = "website_zwak";

  const b = baseOpportunityFromStatus(websiteStatus);
  const scoreAdjust =
    websiteStatus === "website_sterk"
      ? q.score - 50
      : websiteStatus === "website_redelijk"
        ? q.score - 55
        : q.score - 40;

  const opportunityScore = Math.max(15, Math.min(95, b.score + Math.round(scoreAdjust / 10)));

  if (websiteDetection.detectionSource === "derived") {
    reasons.push("URL_DERIVED_NOT_KVK");
  }
  if (websiteDetection.outcome === "found_redirected") {
    reasons.push("REDIRECT_CHAIN");
  }
  reasons.push(...q.labels.slice(0, 6));

  return {
    websiteStatus,
    opportunityScore,
    callAngle: b.callAngle,
    reasonCodes: [...b.reasons, ...reasons],
  };
}

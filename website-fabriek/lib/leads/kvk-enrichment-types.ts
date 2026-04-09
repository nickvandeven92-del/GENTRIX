/** Publieke / API-output types voor KVK-zoeken en enrichment. */

export type KvkSearchResultItem = {
  kvkNummer: string;
  naam: string;
  handelsnaam: string | null;
  plaats: string | null;
  straat: string | null;
  type: string | null;
  links: { rel: string | null; href: string | null }[];
  rawScore?: number;
};

export type KvkProfileAddress = {
  type: string | null;
  plaats: string | null;
  straatnaam: string | null;
  huisnummer: number | null;
  postcode: string | null;
  volledigAdres: string | null;
  land: string | null;
};

export type KvkProfileSbi = {
  code: string;
  omschrijving: string | null;
  hoofdactiviteit: string | null;
};

export type KvkProfileVestigingSummary = {
  vestigingsnummer: string;
  eersteHandelsnaam: string | null;
  indHoofdvestiging: string | null;
  volledigAdres: string | null;
};

export type KvkMappedProfile = {
  kvkNummer: string;
  naam: string;
  statutaireNaam: string | null;
  rechtsvorm: string | null;
  plaats: string | null;
  hoofdvestiging: {
    vestigingsnummer: string | null;
    eersteHandelsnaam: string | null;
    statutaireNaam: string | null;
    indHoofdvestiging: string | null;
    adressen: KvkProfileAddress[];
    websites: string[];
    sbiActiviteiten: KvkProfileSbi[];
  } | null;
  adressen: KvkProfileAddress[];
  websites: string[];
  sbiActiviteiten: KvkProfileSbi[];
  vestigingen: KvkProfileVestigingSummary[];
};

export type LeadWebsiteDetectionSource = "kvk" | "derived" | "manual" | "none";

export type LeadWebsiteReachability = "live" | "redirect" | "broken" | "unknown";

/** Samenvattende status voor sales (naast reachability). */
export type LeadWebsiteOutcome =
  | "found_live"
  | "found_redirected"
  | "found_broken"
  | "not_found"
  | "uncertain";

export type WebsiteDetectionResult = {
  detectedUrl: string | null;
  detectionSource: LeadWebsiteDetectionSource;
  reachability: LeadWebsiteReachability;
  outcome: LeadWebsiteOutcome;
  httpStatus: number | null;
  finalUrl: string | null;
  ssl: boolean | null;
};

export type WebsiteQualityVerdict = "strong" | "average" | "weak" | "broken";

export type WebsiteQualityFindings = {
  hasTitle: boolean;
  hasMetaDescription: boolean;
  hasViewport: boolean;
  hasCTA: boolean;
  hasContactSignals: boolean;
  hasSocialLinks: boolean;
  usesHttps: boolean;
  looksParkedOrBroken: boolean;
};

export type WebsiteQualityAnalysis = {
  score: number;
  labels: string[];
  findings: WebsiteQualityFindings;
  verdict: WebsiteQualityVerdict;
};

export type SalesWebsiteStatus =
  | "geen_website"
  | "website_kapot"
  | "website_zwak"
  | "website_redelijk"
  | "website_sterk";

export type LeadOpportunity = {
  websiteStatus: SalesWebsiteStatus;
  opportunityScore: number;
  callAngle: string;
  reasonCodes: string[];
};

export type EnrichedLeadPayload = {
  profile: KvkMappedProfile;
  detection: WebsiteDetectionResult;
  quality: WebsiteQualityAnalysis | null;
  opportunity: LeadOpportunity;
};

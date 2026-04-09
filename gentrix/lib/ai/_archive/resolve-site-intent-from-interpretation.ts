import { applyIndustryIntentBiasIfAmbiguous } from "@/lib/ai/apply-industry-bias-if-ambiguous";
import { deriveDesignRegimeFromExperienceModel } from "@/lib/ai/above-fold-archetypes";
import type { PromptInterpretation } from "@/lib/ai/prompt-interpretation-types";
import { promptHintsBarberOrGrooming } from "@/lib/ai/resolve-visual-from-interpretation";
import {
  SITE_EXPERIENCE_MODEL_VALUES,
  defaultSiteIntent,
  type SiteExperienceModel,
  type SiteIntent,
} from "@/lib/ai/site-experience-model";
import type { HeuristicSignalProfile } from "@/lib/ai/score-prompt-signals";

const ECOMMERCE_RE =
  /\b(webshop|e-?commerce|ecommerce|online\s*winkel|winkel\s*online|producten\s*kopen|afrekenen|bestellen|checkout|winkelwagen|mandje|verzendkosten|voorraad|productcatalogus|koop\s*nu)\b/;
const CATALOG_RE =
  /\b(catalogus|catalog\b|prijsvergelijk|groot\s*assortiment|marktplaats|b2b\s*inkoop|groothandel|distributeur)\b/;
const EDITORIAL_RE =
  /\b(blog|nieuws|magazine|artikelen|kennishub|content\s*hub|podcast|recepten)\b/;
const HEALTH_RE =
  /\b(gezondheid|medisch|kliniek|therapie|pati[eë]nt|huisarts|apotheek|ziekenhuis|welzijn|zorgverlener)\b/;
const COMMUNITY_RE =
  /\b(community|forum|lidmaatschap|leden|vereniging|word\s*lid)\b/;
const SAAS_RE =
  /\b(saas|software\s*als\s*dienst|softwareplatform|abonnement|dashboard|\bapi\b|cloudtool|proefperiode)\b/;
/** Creatieve productie / beeld — anders valt “multimedia studio” te vaak op service_leadgen / saas. */
const CREATIVE_MULTIMEDIA_RE =
  /\b(multimedia|videoproductie|video\s*productie|motion\s*graphics|post-?productie|broadcast|contentstudio|creatief\s*bureau|productiestudio|drone\s*beelden|animatiestudio|filmstudio)\b/;
const PORTFOLIO_SHOWCASE_RE =
  /\b(portfolio|showcase|galerij|fotostudio|fotografie\b|lookbook|beeldcollage|inspiratie\s*grid)\b/;
/** Pretparken, zwemparadijzen en belevenisbestemmingen — niet als SaaS- of software-landing classificeren. */
const LEISURE_DESTINATION_RE =
  /\b(waterpretpark|waterpark|aquapark|zwemparadijs|zwempark|attractiepark|pretpark|familiepark|belevenisbad|beleveniszwembad|speelparadijs|wildwater|wild\s*water|lazy\s*river|glijbaan|glijbanen|aquatube|zwembad\s*met\s*attract|dagje\s*uit|dagattractie|leisure\s*pool|water\s*attraction|theme\s*water\s*park)\b/i;

function emptyModelScores(): Record<SiteExperienceModel, number> {
  return Object.fromEntries(SITE_EXPERIENCE_MODEL_VALUES.map((k) => [k, 0])) as Record<
    SiteExperienceModel,
    number
  >;
}

function addScore(m: Record<SiteExperienceModel, number>, k: SiteExperienceModel, v: number): void {
  m[k] = (m[k] ?? 0) + v;
}

/**
 * Zet abstracte interpretatie (+ ruwe prompt-signalen) om naar `SiteIntent`.
 */
export function resolveSiteIntentFromInterpretation(
  i: PromptInterpretation,
  normalizedPrompt: string,
  profile: HeuristicSignalProfile,
): SiteIntent {
  const t = normalizedPrompt;
  const s = emptyModelScores();

  if (ECOMMERCE_RE.test(t)) addScore(s, "ecommerce_home", 8);
  if (CATALOG_RE.test(t)) addScore(s, "search_first_catalog", 7);
  if (EDITORIAL_RE.test(t)) addScore(s, "editorial_content_hub", 7);
  if (HEALTH_RE.test(t)) addScore(s, "health_authority_content", 8);
  if (COMMUNITY_RE.test(t)) addScore(s, "community_media", 7);
  if (SAAS_RE.test(t)) addScore(s, "saas_landing", 6);
  if (CREATIVE_MULTIMEDIA_RE.test(t)) addScore(s, "brand_storytelling", 8);
  if (/\b(dynamische|veel)\b/.test(t) && /\bbeeld/.test(t)) addScore(s, "brand_storytelling", 6);
  if (PORTFOLIO_SHOWCASE_RE.test(t)) addScore(s, "editorial_content_hub", 8);
  if (LEISURE_DESTINATION_RE.test(t)) {
    addScore(s, "premium_product", 9);
    addScore(s, "brand_storytelling", 4);
    if (/\b(ticket|tickets|entree|toegang|boek|reserver|prijs|prijzen|seizoen)\b/i.test(t)) {
      addScore(s, "premium_product", 2);
    }
  }

  /**
   * Barbier/kapper + luxe/donker: korte prompts vielen te vaak op service_leadgen + compact → grijs/wit naast zwart.
   * Merkverhaal + airy geeft betere sectieritme en samenhang (minimale input).
   */
  if (promptHintsBarberOrGrooming(t)) {
    addScore(s, "brand_storytelling", 6);
    if (/\b(luxe|luxury|premium|donker|dark|goud|gold|high-?end|elegant)\b/.test(t)) {
      addScore(s, "brand_storytelling", 4);
    }
  }

  if (i.businessModel === "product" && i.primaryGoal === "sales") addScore(s, "ecommerce_home", 5);
  if (i.businessModel === "content") addScore(s, "editorial_content_hub", 5);
  if (i.businessModel === "service" && i.primaryGoal === "lead_generation") {
    addScore(s, "service_leadgen", 5);
  }
  if (i.businessModel === "hybrid") addScore(s, "hybrid_content_commerce", 6);
  if (i.businessModel === "portfolio" && i.primaryGoal === "branding") {
    addScore(s, "brand_storytelling", 5);
  }
  if (i.businessModel === "product" && i.primaryGoal === "signup") addScore(s, "saas_landing", 5);
  if (i.visualTone === "luxury" && i.businessModel === "product" && i.primaryGoal !== "sales") {
    addScore(s, "premium_product", 4);
  }

  if (profile.primaryGoalScores.sales >= 5) addScore(s, "ecommerce_home", 2);
  if (profile.businessModelScores.content >= 4) addScore(s, "editorial_content_hub", 2);

  applyIndustryIntentBiasIfAmbiguous(s, profile);

  let best: SiteExperienceModel = "saas_landing";
  let bestV = 0;
  for (const k of Object.keys(s) as SiteExperienceModel[]) {
    const v = s[k] ?? 0;
    if (v > bestV) {
      bestV = v;
      best = k;
    }
  }

  if (bestV < 2) {
    if (i.businessModel === "service") best = "service_leadgen";
    else if (i.businessModel === "content") best = "editorial_content_hub";
    else if (i.businessModel === "product") best = i.primaryGoal === "sales" ? "ecommerce_home" : "saas_landing";
    else best = "saas_landing";
  }

  return fillIntentDetails(best, i, t);
}

function fillIntentDetails(model: SiteExperienceModel, i: PromptInterpretation, t: string): SiteIntent {
  const base = defaultSiteIntent();
  const patterns: Record<SiteExperienceModel, SiteIntent["recommendedHomepagePattern"]> = {
    ecommerce_home: [
      "utiliteitsbalk (levering, service)",
      "hero met zoek of categorie-chips",
      "categorie-highlights",
      "uitgelichte producten",
      "vertrouwen en USP-strip",
      "paginavoet",
    ],
    search_first_catalog: [
      "navigatie",
      "prominente zoek-hero",
      "horizontale categorieën",
      "raster met resultaten",
      "keurmerken en vertrouwen",
      "paginavoet",
    ],
    editorial_content_hub: [
      "navigatie",
      "zoeken of thema’s bovenaan",
      "hoofdartikel / coverstory",
      "thema-cluster of tags",
      "artikelrail",
      "paginavoet",
    ],
    saas_landing: [
      "navigatie",
      "hero met kernbelofte",
      "vertrouwen (logo’s, cijfers, quotes)",
      "aanbod of uitkomsten — geen standaard icoon-featuregrid",
      "prijzen of pakketten",
      "paginavoet",
    ],
    service_leadgen: [
      "hero met duidelijke belofte",
      "diensten of specialismen",
      "bewijs (reviews, certificaten)",
      "sterke actieknop",
      "veelgestelde vragen",
      "paginavoet",
    ],
    premium_product: [
      "hero met sfeer",
      "merkverhaal",
      "product centraal",
      "subtiele social proof",
      "paginavoet",
    ],
    health_authority_content: [
      "navigatie",
      "hero met vertrouwen en rust",
      "pijlercontent (thema’s)",
      "expertise en bronnen",
      "veelgestelde vragen",
      "paginavoet",
    ],
    hybrid_content_commerce: [
      "hero",
      "verhaal- of stijl-teaser",
      "categorieën of shop-spotlight",
      "artikelen of inspiratie",
      "paginavoet",
    ],
    brand_storytelling: [
      "hero met dominant beeld of stille loop (geen lege template-hero)",
      "kort verhaal of aanpak — editorial, weinig tekst",
      "breed werk / stills (geen icoon-featuregrid)",
      "zachte contact-CTA",
      "paginavoet",
    ],
    community_media: [
      "hero met momentum",
      "highlights of voordelen",
      "leden of social proof",
      "contentrail",
      "duidelijke join- of aanmeld-CTA",
      "paginavoet",
    ],
  };

  let density: SiteIntent["densityProfile"] = "balanced";
  if (i.scanBehavior === "fast" && model !== "editorial_content_hub") density = "dense_commerce";
  if (i.scanBehavior === "exploratory" || i.contentDepth === "rich") density = "airy";
  if (model === "ecommerce_home" || model === "search_first_catalog") density = "dense_commerce";
  if (model === "premium_product" || model === "brand_storytelling") density = "airy";

  let trustStyle: SiteIntent["trustStyle"] = base.trustStyle;
  if (i.trustNeed === "high" || i.proofNeed === "high") {
    trustStyle =
      model === "ecommerce_home" || model === "search_first_catalog" ? "retail" : "social_proof_heavy";
  }
  if (i.trustNeed === "high" && model === "health_authority_content") trustStyle = "authority";
  if (i.trustNeed === "low" && i.visualTone === "minimal") trustStyle = "subtle";

  let conversionModel: SiteIntent["conversionModel"] = "lead_capture";
  if (model === "ecommerce_home") conversionModel = "direct_purchase";
  if (model === "search_first_catalog") conversionModel = "search_discovery";
  if (model === "editorial_content_hub" || model === "health_authority_content") {
    conversionModel = "content_discovery";
  }
  if (model === "community_media") conversionModel = "membership_signup";
  if (i.primaryGoal === "signup" && model === "saas_landing") conversionModel = "lead_capture";
  if (i.primaryGoal === "branding" && model === "saas_landing") conversionModel = "hybrid";

  let searchImportance: SiteIntent["searchImportance"] = "none";
  if (model === "search_first_catalog") searchImportance = "primary";
  if (model === "editorial_content_hub") searchImportance = "primary";
  if (model === "ecommerce_home" && /\b(zoek|zoeken|filter|assortiment)\b/.test(t)) {
    searchImportance = "primary";
  } else if (model === "ecommerce_home") searchImportance = "supporting";

  let navigationDepth: SiteIntent["navigationDepth"] = "standard";
  if (model === "ecommerce_home" || model === "search_first_catalog") navigationDepth = "category_rich";
  if (model === "premium_product" || model === "brand_storytelling") navigationDepth = "minimal";

  let contentStrategy: SiteIntent["contentStrategy"] = "medium";
  if (i.contentDepth === "lean") contentStrategy = "low";
  if (i.contentDepth === "rich") contentStrategy = "high";
  if (model === "editorial_content_hub") contentStrategy = "high";

  const businessLabels: Record<SiteExperienceModel, string> = {
    ecommerce_home: "Webwinkel / e-commerce startpagina",
    search_first_catalog: "Zoek- en catalogusgedreven site (veel keuze)",
    editorial_content_hub: "Redactionele site / kennis- en inhoudshub",
    saas_landing: "Conversiegerichte landingspagina (waarde → vertrouwen → aanbod → prijs)",
    service_leadgen: "Lokale of vakmatige dienstverlening (leadgeneratie)",
    premium_product: "Premium merk of product (weinig ruis, focus op kwaliteit)",
    health_authority_content: "Gezondheids- of medische autoriteitssite",
    hybrid_content_commerce: "Combinatie van inhoud en verkoop",
    brand_storytelling: "Emotie- en merkverhaal-gedreven site",
    community_media: "Community, vereniging of lidmaatschap",
  };

  return {
    experienceModel: model,
    designRegime: deriveDesignRegimeFromExperienceModel(model),
    navigationDepth,
    densityProfile: density,
    conversionModel,
    searchImportance,
    trustStyle,
    contentStrategy,
    businessModel: businessLabels[model],
    recommendedHomepagePattern: patterns[model],
  };
}

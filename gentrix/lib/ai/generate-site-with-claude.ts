import { randomUUID } from "crypto";
import Anthropic from "@anthropic-ai/sdk";
import { generateDesignRationaleWithClaude } from "@/lib/ai/generate-design-rationale-with-claude";
import {
  buildDesignContractPromptInjection,
  buildUnsplashThemeContextWithContract,
  type DesignGenerationContract,
} from "@/lib/ai/design-generation-contract";
import { ANTHROPIC_KEY_MISSING_USER_HINT, getAnthropicApiKey } from "@/lib/ai/anthropic-env";
import type { ContentBlockParam } from "@anthropic-ai/sdk/resources/messages";
import type { MessageDeltaUsage } from "@anthropic-ai/sdk/resources/messages/messages";
import { getKnowledgeContextForClaude } from "@/lib/data/ai-knowledge";
import { buildContentAuthorityPolicyBlock } from "@/lib/ai/content-authority-policy";
import { buildContentClaimDiagnosticsReport } from "@/lib/ai/content-claim-diagnostics";
import {
  MASTER_SITE_SYSTEM_PROMPT,
  MASTER_SITE_SYSTEM_PROMPT_MINIMAL,
} from "@/lib/ai/master-site-system-prompt";
import { parseModelJsonObject } from "@/lib/ai/extract-json";
import { resolveMarketingPageSlugsForGeneration } from "@/lib/ai/marketing-page-slugs";
import {
  buildClaudeTailwindMarketingSiteOutputSchema,
  claudeTailwindMarketingSiteOutputSchema,
  claudeTailwindPageOutputSchema,
  MASTER_PROMPT_CONFIG_STYLE_MAX,
  mapClaudeMarketingSiteOutputToSections,
  mapClaudeOutputToSections,
  type GeneratedTailwindPage,
  type MasterPromptPageConfig,
  type TailwindSection,
} from "@/lib/ai/tailwind-sections-schema";
import { getGenerationPackagePromptBlock } from "@/lib/ai/generation-packages";
import { logClaudeMessageUsage } from "@/lib/ai/log-claude-message-usage";
import { getAlpineInteractivityPromptBlock } from "@/lib/ai/interactive-alpine-prompt";
import {
  ensureClaudeMarketingSiteJsonHasContactSections,
  normalizeClaudeSectionArraysInParsedJson,
  normalizeHtmlWhitespaceForUpgradePrompt,
  postProcessClaudeTailwindMarketingSite,
  postProcessClaudeTailwindPage,
  stableIdsForUpgradeSections,
} from "@/lib/ai/generate-site-postprocess";
import { tryExtractCompletedSections } from "@/lib/ai/stream-json-section-extractor";
import { parseStoredSiteData } from "@/lib/site/parse-stored-site-data";
import {
  collectMarketingNavScanHtml,
  validateMarketingPageContent,
  validateMarketingPageLinks,
  validateMarketingPagePlanNavCoverage,
} from "@/lib/ai/validate-marketing-pages";
import { validateMarketingSiteHardRules } from "@/lib/ai/validate-marketing-site-output";
import { validateStrictLandingPageContract } from "@/lib/ai/validate-strict-landing-page";
import { validateGeneratedPageHtml, type HomepagePlan } from "@/lib/ai/validate-generated-page";
import {
  applySelfReviewToGeneratedPage,
  isSiteSelfReviewEnabled,
} from "@/lib/ai/self-review-site-generation";
import { replaceUnsplashImagesInSections } from "@/lib/ai/unsplash-image-replace";
import { fetchReferenceSiteForPrompt } from "@/lib/ai/fetch-reference-site-for-prompt";
import { streamClaudeMessageText } from "@/lib/ai/claude-stream-text";
import { maybeEnhanceHero } from "@/lib/ai/enhance-hero-section";
import type { ReactSiteDocument } from "@/lib/site/react-site-schema";
import { finalizeBookingShopAfterAiGeneration } from "@/lib/site/append-booking-section-to-payload";
import { INDUSTRY_KEYWORDS, INDUSTRY_PROFILES } from "@/lib/ai/site-generation-industry-data";
import {
  type IndustryProfile,
  industryProfilePrefersCompactLandingFaq,
} from "@/lib/ai/site-generation-industry-data";

/**
 * Placeholder in de site-generatie-userprompt: het Denklijn-contract wordt hier ingevoegd
 * zodat bindende instructies vóór het (vaak zeer lange) REFERENTIESITE-excerpt staan.
 */
const SITE_GENERATION_DESIGN_CONTRACT_SLOT = "__GENTRIX_DESIGN_CONTRACT_SLOT__";

export type { GeneratedTailwindPage, MasterPromptPageConfig, TailwindSection };
export type { HomepagePlan };
export type { IndustryProfile } from "@/lib/ai/site-generation-industry-data";

/**
 * Vereenvoudigde pipeline-feedback voor de generation_meta NDJSON event.
 */
/** Waar de gekozen stijl vandaan komt — handig voor debugging. */
export type StyleDetectionSource = "explicit_stijl_line" | "keyword_match" | "none";

export type GenerationPipelineFeedback = {
  model: string;
  interpreted: {
    businessName: string;
    description: string;
    sections: string[];
    /** Weergavenaam (label) */
    detectedIndustry?: string;
    /** Stabiele id, bv. \`barber\`, \`industrial_raw\` */
    detectedIndustryId?: string;
    detectedStyle?: string;
    detectedStyleId?: string;
    /** \`explicit_stijl_line\` = "Stijl …" in briefing; \`keyword_match\` = trefwoorden; \`none\` = creatieve vrijheid */
    styleDetectionSource?: StyleDetectionSource;
    /** Optioneel: referentie-URL die de server heeft opgehaald voor de prompt. */
    referenceStyle?: {
      requestedUrl: string;
      status: "ingested" | "failed";
      finalUrl?: string;
      excerptChars?: number;
      error?: string;
    };
    /** `true` bij SITE_GENERATION_MINIMAL_PROMPT of `minimalPrompt` in options. */
    minimalPrompt?: boolean;
    /** `landingPageOnly` + geen upgrade: strikte 5-sectie-landingspagina (studio-contract). */
    landingPageOnly?: boolean;
    strictLandingPageContract?: boolean;
    /** Of strikte one-pager \`faq\` in de sectielijst heeft (FAQ-keywords in naam+briefing). */
    compactLandingIncludesFaq?: boolean;
    /** Multipage: exacte `marketingPages`-keys voor deze run (server + optionele override). */
    marketingPageSlugs?: string[];
  };
};

const DEFAULT_GENERATE_MODEL = "claude-sonnet-4-6";
const DEFAULT_SUPPORT_MODEL = "claude-sonnet-4-6";
/** Streaming site-build: ruim genoeg voor marketing multi-page + zware secties (binnen model/stream-limiet). */
const DEFAULT_MAX_OUTPUT_TOKENS = 30_720;


/**
 * Tekst voor branche- en sectie-detectie: **bedrijfsnaam + briefing** samen.
 * Zo matcht bv. alleen "Herenkapster De Snijder" als naam al op kappers-profielen.
 */
export function combinedIndustryProbeText(businessName: string, description: string): string {
  const n = businessName.trim();
  const d = description.trim();
  if (n && d) return `${n}\n${d}`;
  return n || d;
}

/**
 * Detecteer de branche op basis van de briefing-beschrijving.
 * Retourneert het best matchende IndustryProfile, of null als geen match.
 */
export function detectIndustry(description: string): IndustryProfile | null {
  let bestMatch: { profile: IndustryProfile; score: number } | null = null;
  for (const { pattern, profileId } of INDUSTRY_KEYWORDS) {
    const matches = description.match(new RegExp(pattern, "gi"));
    if (matches) {
      const score = matches.length;
      const profile = INDUSTRY_PROFILES.find((p) => p.id === profileId);
      if (profile && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { profile, score };
      }
    }
  }
  return bestMatch?.profile ?? null;
}

// ---------------------------------------------------------------------------
// Sectie-analyse: keyword-detectie + branche-profiel = definitieve sectielijst
// ---------------------------------------------------------------------------

type BriefingSectionMatch = { id: string; weight: number };

const EXTRA_SECTION_KEYWORDS: Record<string, { keywords: RegExp; weight: number }> = {
  /** Alleen duidelijke webshop-/retail-product signalen — géén losse "product", "producten", "artikelen", "assortiment", "collectie", "verkoop" of los "bestellen" (die matchen te vaak op diensten, blogs en afspraken). Branche-profielen voegen `shop` al toe waar het hoort. */
  shop: {
    keywords:
      /\b(webshop|webwinkel|winkel|e-?commerce|winkelwagen|winkelmand|(?:online|in\s+de\s+webshop)\s+bestellen|haarproducten|parfums|verzorgingsproducten)\b/i,
    weight: 10,
  },
  testimonials: {
    keywords:
      /\b(testimonials?|reviews?|beoordelingen|klantbeoordeling|klanten\s+zeggen|ervaringen|referenties|aanbevelingen|wat\s+klanten)\b/i,
    weight: 7,
  },
  pricing: {
    keywords:
      /\b(prijzen|tarieven|prijslijst|pakketten|abonnement|tarief|vanaf\s*€|transparante\s+prijzen|kosten|offerte)\b/i,
    weight: 6,
  },
  faq: {
    keywords: /\b(faq|veelgestelde\s+vragen|veel\s+gestelde|vragen\s+en\s+antwoorden|help\s*center|helpcentrum)\b/i,
    weight: 5,
  },
  gallery: {
    keywords:
      /\b(galerij|gallery|foto['']?s|instagram|werkplaats|impressie|portfolio|showroom|sfeerbeelden|beelden)\b/i,
    weight: 6,
  },
  team: {
    keywords:
      /\b(team|medewerkers|barbers|kappers|stylisten|personeel|ons\s+team|wie\s+zijn\s+wij|collega['']?s|specialisten)\b/i,
    weight: 4,
  },
  brands: {
    keywords:
      /\b(merken|brands|leveranciers|partners|reuzel|proraso|layrite|suavecito|american\s+crew|keune|wella|l['']?or[eé]al|topmerken)\b/i,
    weight: 5,
  },
  about: {
    keywords:
      /\b(over\s+ons|about|wie\s+zijn|ons\s+verhaal|onze\s+geschiedenis|sinds|opgericht)\b/i,
    weight: 3,
  },
};

const SECTION_ORDER_PREFERENCE: readonly string[] = [
  "hero",
  "features",
  "about",
  "shop",
  "gallery",
  "brands",
  "team",
  "testimonials",
  "pricing",
  "faq",
  "cta",
  "contact",
  "footer",
];

/**
 * Scan de briefing op extra sectie-keywords bovenop het branche-profiel.
 */
export function analyzeBriefingForSections(description: string): string[] {
  const extra: BriefingSectionMatch[] = [];
  for (const [id, { keywords, weight }] of Object.entries(EXTRA_SECTION_KEYWORDS)) {
    if (keywords.test(description)) {
      extra.push({ id, weight });
    }
  }
  return extra.sort((a, b) => b.weight - a.weight).map((m) => m.id);
}

/**
 * Of de strikte one-pager een `faq`-sectie krijgt — **deterministisch**:
 * 1) FAQ-trefwoorden in naam+briefing (zelfde regex als `EXTRA_SECTION_KEYWORDS.faq`), of
 * 2) gedetecteerd brancheprofiel waar `sections` al `faq` bevat (studio-standaard voor die sector).
 */
export function shouldIncludeCompactLandingFaq(industryProbeText: string): boolean {
  if (EXTRA_SECTION_KEYWORDS.faq.keywords.test(industryProbeText)) return true;
  return industryProfilePrefersCompactLandingFaq(detectIndustry(industryProbeText));
}

/**
 * Vaste volgorde voor **landingPageOnly** (nieuwe site, geen upgrade):
 * hero → bewijs → werkwijze/diensten → [faq als briefing FAQ vraagt] → footer.
 * **4** secties zonder FAQ-signalen; **5** met (max. 5 secties totaal).
 */
export function buildCompactLandingSectionIds(description: string): readonly string[] {
  const prefersLogos =
    EXTRA_SECTION_KEYWORDS.brands.keywords.test(description) ||
    /\b(logo|logos|merken|partners?|leveranciers?)\b/i.test(description);
  const proofId = prefersLogos ? "brands" : "stats";
  const middleId = /\b(werkwijze|stappenplan|stappen|in\s+\d+\s+stappen|hoe\s+wij\s+werken|proces|aanpak)\b/i.test(
    description,
  )
    ? "steps"
    : "features";
  const core: string[] = ["hero", proofId, middleId];
  if (shouldIncludeCompactLandingFaq(description)) {
    core.push("faq");
  }
  core.push("footer");
  return core as readonly string[];
}

/**
 * Bouw de definitieve sectielijst op basis van:
 * 1. Branche-profiel (als gedetecteerd) → geeft de basis
 * 2. Keyword-detectie → voegt extra secties toe
 * 3. Expliciete IDs (als meegegeven) → override
 */
export function buildSectionIdsFromBriefing(description: string, explicitIds?: string[]): string[] {
  if (explicitIds?.length) {
    const extra = analyzeBriefingForSections(description);
    const merged = new Set(explicitIds.filter((id) => id !== "booking" && id !== "shop"));
    for (const id of extra) merged.add(id);
    merged.delete("booking");
    merged.delete("shop");
    merged.delete("contact");
    const industryExplicit = detectIndustry(description);
    if (industryExplicit?.sections.includes("shop") || EXTRA_SECTION_KEYWORDS.shop.keywords.test(description)) {
      merged.delete("gallery");
    }
    return SECTION_ORDER_PREFERENCE.filter((id) => merged.has(id) && id !== "contact");
  }

  const industry = detectIndustry(description);
  const baseSections = industry ? [...industry.sections] : [...DEFAULT_SECTIONS];
  const extra = analyzeBriefingForSections(description);
  const merged = new Set(baseSections);
  for (const id of extra) merged.add(id);
  merged.delete("booking");
  merged.delete("shop");
  merged.delete("contact");
  /** Retail met webshop: geen aparte marketing-`gallery` — productbeeldtaal hoort in de shop-module. */
  if (industry?.sections.includes("shop") || EXTRA_SECTION_KEYWORDS.shop.keywords.test(description)) {
    merged.delete("gallery");
  }
  return SECTION_ORDER_PREFERENCE.filter((id) => merged.has(id) && id !== "contact");
}

// ---------------------------------------------------------------------------
// Stijl-detectie: herken visuele stijlrichting los van de branche
// ---------------------------------------------------------------------------

export type StyleProfile = {
  id: string;
  label: string;
  /** Design language: typography, composition, spacing, mood — richtlijn; expliciete briefing/stijlregel wint. */
  designLanguage: string;
  /** Color advice — only applied when no explicit colors are specified in the briefing. */
  colorPalette: string;
};

const STYLE_PROFILES: StyleProfile[] = [
  {
    id: "classic_vintage",
    label: "Klassiek / Vintage",
    designLanguage: `**DESIGNTAAL: KLASSIEK / VINTAGE** (richtlijn — briefing wint bij conflict)
- **Typografie:** overwegend \`font-serif\` op koppen (slab-serif mag); body mag sans. Koppen mogen \`italic\` zijn. \`tracking-wide\` of \`uppercase\` voor labels boven koppen. Body-tekst mag sans-serif.
- **Compositie:** warmte en ambacht uitstralen. Veel textuur in de layout — \`border\` met warme tinten, zachte \`shadow-lg\`, \`divide-y\` op lijsten. Niets mag "digital-first" of "SaaS" voelen.
- **Sfeer:** nostalgie, vakmanschap, erfgoed. De site voelt als een ambachtelijke menukaart of tijdschrift uit de jaren '50-'70.
- **Decoratie:** ornamentele lijn-dividers, ster-symbolen (★) als scheiders, vintage branche-iconen. SVG-decoratie in dunne lijnstijl.
- **Spacing:** genereuze padding (\`py-20 md:py-28\`), content niet te breed (\`max-w-4xl\` voor tekst).
- **Hero:** typografisch met groot \`text-6xl md:text-7xl font-serif italic\` op **warm licht** (crème/stone) **of** op donker, OF cinematic foto met warme tonen — overlay alleen als de briefing of beeld dat vraagt (geen verplicht donker vlak).
- **Secties:** wissel donkere en warme lichte banden; liever warme off-white/stone i.p.v. koud klinisch wit als het past bij de briefing.`,
    colorPalette: `**KLEURADVIES (als briefing geen kleuren noemt):**
Aardekleuren als basis: warm bruin (\`bg-[#2c1810]\`, \`bg-amber-950\`) voor donkere secties, crème (\`bg-[#f5f0e8]\`, \`bg-stone-100\`) voor lichte secties, goud/amber als accent.`,
  },
  {
    id: "modern_sleek",
    label: "Modern / Strak",
    designLanguage: `**DESIGNTAAL: MODERN / STRAK** (richtlijn — briefing wint bij conflict)
- **Typografie:** \`font-sans\`, strakke koppen (\`tracking-tight\`), voorkeur \`font-light\` of \`font-bold\` — \`font-medium\` alleen als de briefing dat vraagt.
- **Compositie:** minimalistisch. Veel witruimte. Scherpe lijnen. Grid-gebaseerd. Symmetrie of bewuste asymmetrie — nooit "per ongeluk".
- **Sfeer:** strak, professioneel, confident. Minder is meer. Geen rommel, geen decoratie die niet functioneel is.
- **Decoratie:** GEEN of minimaal — hoogstens één subtiele geometrische lijn. Geen branche-symbolen tenzij heel abstract. Geen ornamentele dividers.
- **Spacing:** strakke spacing, consistent grid. \`gap-8\` niet \`gap-12\`. Compacter voelt moderner.
- **Hero:** één strakke foto met hoog contrast, of typografisch met oversized sans — gebruik \`font-light\` of \`font-medium\`, **niet** \`font-black\` + lange subtekst. **Uitzondering — barbershop / salon / spa / hotel in de briefing:** gebruik in de hero **serif** + weinig woorden (high-end editorial), geen "fastfood"-layout met twee volle knoppen en een paragraaf.
- **Secties:** scherp contrast tussen secties; wissel rustige neutrale vlakken (\`bg-white\`, \`bg-stone-50\`, \`bg-zinc-100\`) — **geen** vaste donkere band als signatuur tenzij de briefing donker vraagt.`,
    colorPalette: `**KLEURADVIES (als briefing geen kleuren noemt):**
Zwart/wit basis met één krachtig accent (emerald, electric blue, of felrood). Minimaal kleurgebruik — de kracht zit in contrast.`,
  },
  {
    id: "luxury_exclusive",
    label: "Luxe / Exclusief",
    designLanguage: `**DESIGNTAAL: LUXE / EXCLUSIEF** (richtlijn — briefing wint bij conflict)
- **Typografie:** elegant \`font-serif\` op koppen, body in clean sans; ruimte voor grote koppen (\`text-5xl\`+) en uppercase labels waar het past — niet verplicht overal hetzelfde schaal-template.
- **Compositie:** VEEL negatieve ruimte. Alles ademt kwaliteit en exclusiviteit. Elke sectie heeft ruime padding (\`py-24 md:py-32\`). Content is smal (\`max-w-3xl mx-auto\` voor tekst). Niets voelt "vol" of "druk".
- **Sfeer:** high-end, aspirationeel, verfijnd — rust en materiaalgevoel belangrijker dan drukte.
- **Decoratie:** MINIMAAL en verfijnd — dunne lijnen (\`border-[0.5px]\`), subtiele dividers, geen drukke patronen. Geen emoji's. Geen speelse elementen.
- **Cards/lijsten:** geen standaard rounded kaarten met schaduw. Gebruik \`border-[0.5px]\` met \`hover:bg-[kleur]/5\` transities. Of helemaal geen cards — een elegante \`divide-y\` lijst is luxueuzer.
- **Knoppen:** minimalistisch — \`border\` met \`uppercase tracking-widest text-xs\` tekst. Geen grote ronde gekleurde knoppen. Subtiel, niet schreeuwerig.
- **Hero:** minstens **twee** evenwaardige families — kies wat de briefing het beste draagt (inclusief referentiebeeld/site als die licht is); **luxe ≠ donker**:
  - **Optie A (licht / editorial):** veel witruimte, \`bg-stone-50\` / \`bg-[#faf8f5]\` / off-white, donkere serif-kop (\`text-stone-900\`), dunne hairlines, eventueel **lichte** split met sfeerfoto — **minimale** copy in de hero.
  - **Optie B (foto-gedreven):** cinematic full-bleed met **lichte tot middel** overlay óf donkere overlay **alleen** als het beeld dat nodig heeft voor contrast; **korte** oversized serif-kop. Grote beeldhoogte (\`min-h-[72vh] md:min-h-[80vh]\` of vergelijkbaar).
  - **Optie C (typografisch donker):** mag, maar niet de default — alleen als de briefing of referentie expliciet donker/minimal noir vraagt; combineer met gradient, textuur of split-beeld zodat het geen kaal zwart vlak wordt.
  - **Vermijd:** standaard iedere luxe-site op near-black te zetten "omdat het premium oogt".
  - **Vermijd:** kale effen hero zonder enige laag (foto, gradient of subtiele textuur) tenzij de briefing expliciet minimalistisch wil.
  - **Vermijd:** lange alinea + twee grote knoppen in de hero — meestal werkt rustiger beter.
- **Secties:** ritme licht/donker is **vrijwillig**; veel high-end sites zijn overwegend **licht** met één donker accentblok. Lichte secties: \`bg-white\`, \`bg-neutral-50\`, \`bg-stone-50\`.
- **Prijzen/diensten:** lijst met dividers of een bewust ander patroon — niet standaard overal dezelfde productkaarten.`,
    colorPalette: `**KLEURADVIES (als briefing geen kleuren noemt):**
**Standaard:** begin bij een **licht, rustig** palet — warm wit / steen / zand (\`bg-stone-50\`, \`bg-[#faf8f5]\`, \`bg-neutral-100\`) met diepe tekst (\`text-stone-900\`) en **één** rijk accent (champagne-goud, brons, navy, wijnrood). Dat voelt minstens zo luxe als zwart+goud.
**Alternatief (alleen als briefing of referentie duidelijk noir/donker wil):** donkere basis (\`bg-zinc-950\`, \`bg-[#0a0a0a]\`) met goud of champagne als accent.
**Vermijd:** automatisch near-black kiezen bij woorden als "luxe" of "exclusief". Geen felle primaire kleuren tenzij de briefing dat vraagt.`,
  },
  {
    id: "warm_cozy",
    label: "Warm / Gezellig",
    designLanguage: `**DESIGNTAAL: WARM / GEZELLIG** (richtlijn — briefing wint bij conflict)
- **Typografie:** rounded sans-serif of friendly serif. Niet te strak, niet te formeel. \`font-medium\` is warmer dan \`font-bold\`. Koppen mogen \`text-4xl\` zijn — niet te groot, niet intimiderend.
- **Compositie:** uitnodigend, persoonlijk. Afgeronde hoeken (\`rounded-2xl\`, \`rounded-3xl\`), zachte schaduwen (\`shadow-md\`, \`shadow-lg\`). Alles voelt "zacht" en benaderbaar.
- **Sfeer:** huiselijk, persoonlijk, als een warm welkom. De site voelt als een uitnodiging, niet als een verkooppraatje.
- **Decoratie:** organische vormen, warmte-iconen (hart, zon, bloem). Zachte illustratieve accenten. Mag vriendelijker dan andere stijlen.
- **Spacing:** ruim maar niet afstandelijk. \`py-16 md:py-24\`. Content mag iets breder — \`max-w-5xl\`.
- **Hero:** foto met warme belichting en uitnodigende sfeer. Persoonlijk, niet corporate. Menselijke elementen.
- **Secties:** warme lichte achtergronden, optioneel een donkerdere sectie maar nooit koud-zwart. Zachte overgangen.`,
    colorPalette: `**KLEURADVIES (als briefing geen kleuren noemt):**
Warme tinten: terracotta, warm oranje, zachtgeel. Achtergronden in \`bg-orange-50\`, \`bg-amber-50\`, \`bg-[#faf5ef]\`. Donkere secties in \`bg-stone-800\` of \`bg-amber-950\`.`,
  },
  {
    id: "industrial_raw",
    label: "Industrieel / Ruw",
    designLanguage: `**DESIGNTAAL: INDUSTRIEEL / RAUWE** (richtlijn — briefing wint bij conflict)
- **Typografie:** condensed of narrow sans (\`font-semibold\` / \`font-bold\`), \`uppercase tracking-[0.12em]\` op labels. Koppen mogen krachtig maar **niet** "fastfood-billboard": vermijd \`font-black\` + fel signaalrood op wit — dat is horeca-flyer, geen industrial loft.
- **Compositie:** harde lijnen, \`rounded-none\` of \`rounded-sm\`. \`border\` / metalen randen i.p.v. zachte \`shadow-xl\`. Grid-based, strakke kolommen. Subtiele **textuur** in beeld of achtergrond (beton, staal, baksteen, geschuurd metaal) — niet alleen vlak zwart/wit/rood.
- **Sfeer:** werkplaats, loft, staal en beton. Rauw en eerlijk. Geen gepolijste luxe-spa — wel **ruw vakmanschap**.
- **Decoratie:** technische symbolen (tandwielen, bouten, moersleutel-silhouet) in monochroom met lage opacity. Geen speelse emoji of ronde "vriendelijke" iconen.
- **Spacing:** compact maar niet claustrofobisch; donkere banden mogen \`py-20\` hebben.
- **Hero:** full-bleed **sfeerbeeld** dat industrieel aanvoelt (exposed brick, leder/staal, dramatisch licht, workshop) + korte kop; of typografisch op **donker beton/zwart** met subtiele gradient/noise — **geen** witte hero met twee knalrode knoppen.
- **Sector ≠ zware industrie:** bij **sportvisserij / visartikelen / tackle / boten** betekent “stoer industrieel” **rauw metaal, molens, braided line, nat dek/hout, kleine vissersboot/kotter, haven met vissersschepen** — **niet** bulkterminals, havenkranen, hoogovens, bergtoppen of alpiene landschappen (dat mist de branche).
- **Barbershop + industrieel:** combineer rauwe loft-sfeer met vakmanschap: donkere tonen, koper/roest/barnijs als accent, Unsplash op **barber workshop / leather chair / steel mirror** — niet alleen generiek rood/zwart contrast.`,
    colorPalette: `**KLEURADVIES (als briefing geen kleuren noemt):**
Beton- en staaltinten: \`bg-zinc-900\`, \`bg-neutral-900\`, \`bg-slate-950\`, \`text-zinc-300\`. Accent: **roest, koper, barnijs, gedesatureerd oranje of amber** — of koel **staalblauw**. **Vermijd** puur \`red-500\` + \`bg-white\` als hoofdpalet (pizza-tent); rood hoogstens zeer donker (\`red-950\`) of als dunne lijn, niet als grote vlakken.`,
  },
  {
    id: "playful_creative",
    label: "Speels / Creatief",
    designLanguage: `**DESIGNTAAL: SPEELS / CREATIEF** (richtlijn — briefing wint bij conflict)
- **Typografie:** rounded sans-serif. Variatie in groottes — koppen mogen \`text-7xl font-extrabold\`. Mag asymmetrisch. Kleur-accenten in koppen (één woord in accent-kleur).
- **Compositie:** energie, beweging, onverwachte layouts. Mag afwijken van strakke grids. Overlappende elementen, scheve hoeken (\`-rotate-2\`), speelse plaatsing.
- **Sfeer:** plezier, originaliteit, creativiteit. De site mag glimlachen — maar niet kinderachtig.
- **Decoratie:** speelse SVG-vormen, kleurrijke iconen, optioneel subtiele emoji's. Gradient-accenten op tekst of achtergronden.
- **Spacing:** variërend — soms strak, soms ruim. Het ritme mag verspringen.
- **Hero:** levendig, vol energie. Grote foto met felle kleuren, of bold typografie met gradient-tekst (\`bg-gradient-to-r ... bg-clip-text text-transparent\`).
- **Secties:** afwisseling van kleurrijke en neutrale secties. Gradients toegestaan en aangemoedigd.`,
    colorPalette: `**KLEURADVIES (als briefing geen kleuren noemt):**
Levendige kleuren: paars, koraal, turquoise, lime. Durf te combineren. Gradient-accenten zijn een pluspunt.`,
  },
  {
    id: "glass_frosted",
    label: "Glassmorphism",
    designLanguage: `**DESIGNTAAL: GLASSMORPHISM** (richtlijn — briefing wint bij conflict)
- **Oppervlakken:** semi-transparante lagen met \`backdrop-blur-md\` / \`backdrop-blur-xl\`, dunne rand \`border border-white/10\`–\`border-white/20\` (of \`border-slate-200/30\` op licht), lichte glans (\`bg-white/5\`–\`bg-white/15\` op donker).
- **Achtergrond:** gradient, zachte blob-vormen of **sfeerfoto** achter het glas — anders mist het effect. Vermijd effen vlak zonder diepte.
- **Typografie:** meestal strakke sans; koppen mogen licht gloeien (\`drop-shadow\`) — niet overdrijven.
- **Cards/nav:** pill of afgeronde rechthoeken; **geen** zware skeuomorfe schaduwen — het contrast is glas vs. achtergrond.
- **Contrast:** tekst op glas altijd leesbaar (donkere overlay onder tekst of sterkere blur).`,
    colorPalette: `**KLEURADVIES (als briefing geen kleuren noemt):**
**Licht:** pastel of off-white basis (\`bg-slate-50\`, \`bg-violet-50/30\`) met zachte multi-stop gradients op de achtergrond; frosted panels in wit/transparant; één helder accent voor knoppen.
**Diep:** zachte multi-stop gradients (\`from-violet-600/20 via-fuchsia-500/15 to-cyan-500/20\`) of donkerblauw/paars diepte achter het glas — kies **één** dominant (licht vs. diep), niet beide half.`,
  },
  {
    id: "neumorphism",
    label: "Neumorphism",
    designLanguage: `**DESIGNTAAL: NEUMORPHISM (soft UI)** (richtlijn — briefing wint bij conflict)
- **Basis:** één **monochrome** achtergrondkleur (bijv. \`bg-[#e0e5ec]\` of \`bg-slate-200\`); kaarten en knoppen iets dezelfde familie.
- **Diepte:** dubbele schaduw — lichte highlight + donkere schaduw (\`shadow-[8px_8px_16px_#a3b1c6,-8px_-8px_16px_#ffffff]\` of vergelijkbaar); **inset** voor gedrukte knoppen.
- **Vormen:** zacht afgerond (\`rounded-2xl\` / \`rounded-3xl\`); geen harde zwarte randen (dat is brutalism).
- **Typografie:** rustig sans; weinig felle kleuren — accent spaarzaam.
- **Let op:** te veel neumorfisme voelt traag; gebruik voor **CTA’s, cards, toggles** — niet elke sectie.`,
    colorPalette: `**KLEURADVIES (als briefing geen kleuren noemt):**
Neutrale grijs-blauwe basis (\`#e0e5ec\`, \`slate-200/300\`); tekst \`slate-600\`–\`slate-800\`; één zachte accent (blauw of teal) voor primaire actie.`,
  },
  {
    id: "minimal_flat",
    label: "Minimal / Flat design",
    designLanguage: `**DESIGNTAAL: MINIMAL / FLAT** (richtlijn — briefing wint bij conflict)
- **Vlakken:** platte kleurvlakken, **geen** diepte-schaduwen tenzij zeer subtiel; geen glans of 3D-illusie (dat is skeuomorphism).
- **Iconen/UI:** 2D, lijn-iconen (\`data-lucide\`) of simpele geometrie; geen verloop op knoppen tenzij briefing vraagt om gradient-stijl.
- **Typografie:** strak, veel witruimte, duidelijke hiërarchie; \`font-medium\` / \`font-semibold\` i.p.v. overbodige weights.
- **Grid:** strakke uitlijning, consequente \`gap\`; geen decoratieve ruis.
- **Hero:** typografisch of één sterk plat kleurblok + beperkte copy — past bij SaaS en designstudio’s.`,
    colorPalette: `**KLEURADVIES (als briefing geen kleuren noemt):**
Beperkt palet: wit/off-white basis + 1–2 primaire tinten (bijv. zwart + één signaalkleur); geen mesh-gradients tenzij briefing anders vraagt.`,
  },
  {
    id: "gradient_vibrant",
    label: "Gradient / Vibrant design",
    designLanguage: `**DESIGNTAAL: GRADIENT / VIBRANT** (richtlijn — briefing wint bij conflict)
- **Achtergronden:** \`bg-gradient-to-br\`, \`via-\`, \`from-\`/\`to-\`; mag **mesh-achtig** met meerdere stops of zachte radiale blobs (\`bg-[radial-gradient(...)]\` via style als nodig).
- **Tekst op gradient:** \`bg-clip-text text-transparent\` op koppen of contrasterende lichte tekst met dunne outline/shadow voor leesbaarheid.
- **Energie:** verzadigde kleuren, mag **contrasterend** (oranje/roze/paars/cyaan combinaties); niet per se “corporate blue”.
- **Secties:** wissel gradient-intensiteit — soms rustig neutraal blok ertussen zodat het niet triggert.
- **Niet verplicht:** elke sectie fel; één sterke gradient-hero + rustige content mag ook.`,
    colorPalette: `**KLEURADVIES (als briefing geen kleuren noemt):**
Durven: magenta–oranje–geel, paars–cyaan, of electric blue–violet; houd bodytekst leesbaar met effen contrasterende vlakken.`,
  },
  {
    id: "brutalism",
    label: "Brutalism / Neo-brutalism",
    designLanguage: `**DESIGNTAAL: BRUTALISM / NEO-BRUTALISM** (richtlijn — briefing wint bij conflict)
- **Randen:** dikke \`border-2\` / \`border-4\` \`border-black\` (of \`border-white\` op donker); scherpe hoeken \`rounded-none\` of mini \`rounded-sm\`.
- **Typografie:** system-ui of **mono** voor labels; koppen groot en direct (\`font-black\`, \`uppercase\`, \`tracking-tight\`); mag bewust “ruw”.
- **Kleur:** hoog contrast (zwart/wit/geel of zwart/wit/rood); **geen** zachte pastel tenzij neo-brutalist twist.
- **Vorm:** zichtbare grid, harde blokken, soms **schaduweffect** als sticker (\`shadow-[4px_4px_0_0_#000]\` op knoppen).
- **Vermijd:** glass blur en zachte neumorphic schaduwen — past zelden bij pure brutalism.`,
    colorPalette: `**KLEURADVIES (als briefing geen kleuren noemt):**
Zwart, wit, één felle accent (geel, rood, fel groen); optioneel fel blauw; geen subtiele luxe-goud tenzij bewuste twist.`,
  },
  {
    id: "cyberpunk_futuristic",
    label: "Cyberpunk / Futuristic",
    designLanguage: `**DESIGNTAAL: CYBERPUNK / FUTURISTIC** (richtlijn — briefing wint bij conflict)
- **Basis:** diep donker (\`bg-zinc-950\`, \`bg-[#0a0a0f]\`, near-black blue/purple).
- **Accenten:** neon **cyan, magenta, lime, electric purple** — \`drop-shadow\` / \`shadow-[0_0_24px_rgba(...)]\` spaarzaam op koppen of knippen.
- **Raster/lijnen:** subtiele \`bg-[linear-gradient(...)]\` grid met lage opacity; geen onleesbare drukte. **Geen** bewegende laser standaard — alleen als de briefing dat **expliciet** vraagt (zie §3).
- **Typografie:** futuristic sans (\`tracking-wide\`, \`uppercase\` labels); mag mono voor data-achtige regels.
- **UI:** scherpe of licht afgeronde knoppen met glow; glass **mag** als secundair accent op donker.`,
    colorPalette: `**KLEURADVIES (als briefing geen kleuren noemt):**
Zwart/donkerblauw basis; neon-accenten (cyan \`#22d3ee\`, magenta \`#e879f9\`, lime \`#a3e635\`); beperk tot 2–3 neonkleuren.`,
  },
  {
    id: "editorial_luxury",
    label: "Editorial / Luxury",
    designLanguage: `**DESIGNTAAL: EDITORIAL / LUXURY** (richtlijn — briefing wint bij conflict)
- **Compositie:** magazine-achtig — **asymmetrische grid**, grote kop (\`text-5xl\`–\`text-8xl\` serif), ruimte voor “spread”-gevoel; pull quotes, dunne hairline-dividers.
- **Typografie:** krachtige **serif** op koppen, strakke sans voor body; caps labels met \`tracking-[0.2em]\` waar het past.
- **Beeld:** full-bleed of editorial crop (\`object-cover\`); zwart-wit of gedesatureerd + één rijke accent.
- **Luxe:** veel negatieve ruimte, geen drukke kaart-rasters; prijzen/diensten als elegante lijst of één spotlight.
- **Verschil met algemeen “luxe” preset:** hier ligt nadruk op **editorial ritme en typografie**, niet alleen donker+goud.`,
    colorPalette: `**KLEURADVIES (als briefing geen kleuren noemt):**
Ivoor/warm wit + crème of diep navy + crème; accent: goud/brons **of** diep wijnrood — één rijke signatuurkleur. Hoog-contrast zwart/wit is **een** optie, geen verplichting — luxe-editorial is vaak **licht** met sterke typografie.`,
  },
  {
    id: "skeuomorphism",
    label: "Skeuomorphism",
    designLanguage: `**DESIGNTAAL: SKEUOMORPHISM** (richtlijn — briefing wint bij conflict)
- **Diepte:** licht lijkt van boven — \`bg-gradient-to-b\` op knoppen/vlakken, subtiele inner shadow (\`shadow-inner\`), afgeronde “object”-vormen.
- **Materialen:** hints van **leer, papier, hout** via warme tinten en textuur (Unsplash-achtergrond of zeer subtiele noise — geen overdreven 2010-iOS).
- **Knoppen:** mogen **relief** hebben (\`border-b-4\` donkerder rand); toggles/schuifjes als fysieke controls waar het past.
- **Typografie:** serif of warme sans; uitstraling “ tastbaar ”.
- **Balans:** moderne spacing (\`py-16\`+) zodat het niet oubollig wordt; combineer met **flat** secties als adempauze.`,
    colorPalette: `**KLEURADVIES (als briefing geen kleuren noemt):**
Warm bruin, leerbruin, crème, messing/goud accent; vermijd puur klinisch wit+zwart.`,
  },
];

const STYLE_KEYWORDS: { pattern: RegExp; profileId: string }[] = [
  { pattern: /\b(klassiek|vintage|retro|nostalgisch|oud|traditioneel|ambachtelijk|old\s*school|erfgoed|historisch)\b/i, profileId: "classic_vintage" },
  { pattern: /\b(modern|strak|minimalistisch|minimal|clean|contemporary|eigentijds)\b/i, profileId: "modern_sleek" },
  /** Geen \`premium\` hier: staat te vaak in branche-copy ("premium barbershop") en overschrijft dan bewuste stijlkeuzes zoals industrieel. */
  { pattern: /\b(luxe|luxueus|exclusief|high[\s-]?end|chic|upscale|elite|prestige)\b/i, profileId: "luxury_exclusive" },
  { pattern: /\b(warm|gezellig|huiselijk|knus|intiem|persoonlijk|gastvrij|uitnodigend)\b/i, profileId: "warm_cozy" },
  { pattern: /\b(industrieel|industriële|industrial|rauw|rauwe|stoer|robuust|urban|loft|werkplaats[\s-]?stijl|raw|beton|staal|machinewinkel)\b/i, profileId: "industrial_raw" },
  /** `dynamisch` hier weglaten: korte briefings gebruiken “dynamische website” voor motion, niet voor speels kleurenschema. */
  { pattern: /\b(speels|creatief|kleurrijk|fun|levendig|vrolijk|energiek)\b/i, profileId: "playful_creative" },
  {
    pattern:
      /\b(glassmorphism|glass\s*morph|glasmorfisme|glasmorphin|glasmorph|mat\s*glas|frosted\s*glass|backdrop\s*blur)\b/i,
    profileId: "glass_frosted",
  },
  { pattern: /\b(neumorphism|neumorfisme|neomorphism|soft\s*ui)\b/i, profileId: "neumorphism" },
  { pattern: /\b(flat\s*design|flat\s*ui|plat\s*ontwerp|material\s*flat|2d\s*icons?)\b/i, profileId: "minimal_flat" },
  { pattern: /\b(mesh\s*gradient|gradient|gradients|vibrant|verzadigd|kleurverloop)\b/i, profileId: "gradient_vibrant" },
  { pattern: /\b(neo[\s-]?brutal|brutalism|brutalist|raw\s*web|anti\s*design)\b/i, profileId: "brutalism" },
  {
    pattern:
      /\b(cyberpunk|cyber\s*punk|synthwave|retrowave|holographic|lasers?|neon\s*(?:grid|accent|licht)|sci[\s-]?fi\s*ui)\b/i,
    profileId: "cyberpunk_futuristic",
  },
  /** `e?` zodat "futuristische" matcht (NL verbuiging), niet alleen het lemma "futuristisch". */
  {
    pattern: /\b(futuristische?|futuristic|state\s*of\s*the\s*art|high[\s-]?tech)\b/i,
    profileId: "cyberpunk_futuristic",
  },
  { pattern: /\b(editorial|tijdschrift|magazine|lookbook|cover\s*story|fashion\s*spread)\b/i, profileId: "editorial_luxury" },
  { pattern: /\b(skeuomorphism|skeuomorfisme|skeuomorphic|leather\s*texture|houtlook|3d\s*button)\b/i, profileId: "skeuomorphism" },
];

/**
 * Expliciete stijlregel in de briefing (bijv. "Stijl industrieel", "style: industrial") wint altijd
 * boven trefwoord-telling — lost conflicten op met generieke woorden zoals "premium" in de branchetekst.
 */
function parseExplicitStyleDirective(description: string): StyleProfile | null {
  const m = description.match(/\b(?:stijl|style)\s*(?:[:\-]\s*|\s+)([^.!?\n]+)/i);
  if (!m) return null;
  const chunk = m[1].trim().toLowerCase();
  if (chunk.length === 0) return null;

  const rules: { keys: string[]; profileId: string }[] = [
    {
      keys: ["glassmorphism", "glasmorfisme", "glass morph", "glasmorphin", "glasmorph", "mat glas", "frosted glass"],
      profileId: "glass_frosted",
    },
    { keys: ["neumorphism", "neumorfisme", "neomorphism", "soft ui"], profileId: "neumorphism" },
    { keys: ["neo-brutal", "neo brutal", "brutalism", "brutalist"], profileId: "brutalism" },
    { keys: ["cyberpunk", "synthwave", "retrowave"], profileId: "cyberpunk_futuristic" },
    { keys: ["skeuomorphism", "skeuomorfisme", "skeuomorphic"], profileId: "skeuomorphism" },
    { keys: ["flat design", "flat ui", "plat ontwerp"], profileId: "minimal_flat" },
    { keys: ["mesh gradient", "gradient vibrant"], profileId: "gradient_vibrant" },
    { keys: ["editorial", "lookbook", "magazine"], profileId: "editorial_luxury" },
    { keys: ["industrieel", "industriële", "industrial", "loft", "rauw", "rauwe", "stoer", "robuust", "beton", "staal", "factory", "raw"], profileId: "industrial_raw" },
    { keys: ["klassiek", "vintage", "retro", "nostalgisch", "ambachtelijk", "erfgoed", "old school", "historisch"], profileId: "classic_vintage" },
    { keys: ["modern", "strak", "minimalistisch", "minimal", "clean", "eigentijds", "contemporary"], profileId: "modern_sleek" },
    { keys: ["luxe", "luxueus", "exclusief", "premium", "high-end", "high end", "chic", "upscale", "elite", "prestige"], profileId: "luxury_exclusive" },
    { keys: ["warm", "gezellig", "huiselijk", "knus", "intiem"], profileId: "warm_cozy" },
    { keys: ["speels", "creatief", "kleurrijk", "levendig", "energiek", "vrolijk"], profileId: "playful_creative" },
    { keys: ["futuristisch", "futuristic", "high tech", "high-tech", "state of the art"], profileId: "cyberpunk_futuristic" },
    { keys: ["gradient", "gradients", "vibrant", "verzadigd"], profileId: "gradient_vibrant" },
  ];
  for (const { keys, profileId } of rules) {
    if (keys.some((k) => chunk.includes(k))) {
      return STYLE_PROFILES.find((p) => p.id === profileId) ?? null;
    }
  }
  return null;
}

/** Telt alle \`STYLE_KEYWORDS\`-treffers per profiel (meerdere patronen mogen dezelfde \`profileId\` hebben). */
function aggregateStyleKeywordScores(description: string): Map<string, { profile: StyleProfile; score: number; lastIndex: number }> {
  const map = new Map<string, { profile: StyleProfile; score: number; lastIndex: number }>();
  for (const { pattern, profileId } of STYLE_KEYWORDS) {
    const profile = STYLE_PROFILES.find((p) => p.id === profileId);
    if (!profile) continue;
    const re = new RegExp(pattern.source, pattern.ignoreCase ? "gi" : "g");
    let match: RegExpExecArray | null;
    re.lastIndex = 0;
    while ((match = re.exec(description)) !== null) {
      const prev = map.get(profileId);
      if (!prev) {
        map.set(profileId, { profile, score: 1, lastIndex: match.index });
      } else {
        prev.score += 1;
        if (match.index > prev.lastIndex) prev.lastIndex = match.index;
      }
    }
  }
  return map;
}

function detectStyleFromKeywordsOnly(description: string): StyleProfile | null {
  const map = aggregateStyleKeywordScores(description);
  let best: { profile: StyleProfile; score: number; lastIndex: number } | null = null;
  for (const v of map.values()) {
    if (!best || v.score > best.score || (v.score === best.score && v.lastIndex > best.lastIndex)) {
      best = v;
    }
  }
  return best?.profile ?? null;
}

/** Secundaire stijlen voor blend-hint (zelfde briefing raakt meerdere presets aan). */
function getSecondaryStyleProfilesForBlend(description: string, primaryId: string | null, maxExtra = 2): StyleProfile[] {
  const map = aggregateStyleKeywordScores(description);
  const ranked = [...map.values()]
    .filter((v) => v.profile.id !== primaryId)
    .filter((v) => v.score >= 1)
    .sort((a, b) => b.score - a.score || b.lastIndex - a.lastIndex);
  return ranked.slice(0, maxExtra).map((v) => v.profile);
}

/**
 * Zelfde als \`detectStyle\`, plus **bron** (expliciete "Stijl …"-regel vs. trefwoord-match).
 * Gebruik in pipeline-feedback en self-review zodat de 2e pass weet welke designtaal bedoeld was.
 */
export function resolveStyleDetection(description: string): {
  profile: StyleProfile | null;
  source: StyleDetectionSource;
} {
  const explicit = parseExplicitStyleDirective(description);
  if (explicit) {
    return { profile: explicit, source: "explicit_stijl_line" };
  }
  const fromKw = detectStyleFromKeywordsOnly(description);
  if (fromKw) {
    return { profile: fromKw, source: "keyword_match" };
  }
  return { profile: null, source: "none" };
}

/**
 * Detecteer de visuele stijlrichting op basis van de briefing.
 * Dit staat los van de branche — een barbershop kan zowel vintage als modern zijn.
 */
export function detectStyle(description: string): StyleProfile | null {
  return resolveStyleDetection(description).profile;
}

/**
 * Legt uit hoe de **keyword-router** branche kiest, en verbiedt expliciet voorzichtig-generiek gedrag
 * (los van CONTENT AUTHORITY: feiten blijven strak).
 */
function buildSectorRouterAndCreativeMandateMarkdown(industry: IndustryProfile | null): string {
  if (industry) {
    return `=== BRANCHE-ROUTER (trefwoorden → preset) ===
De pipeline matcht automatisch op keywords: **${industry.label}** (\`${industry.id}\`). Dat is **startinspiratie** — geen korset. Bedoelt de briefing een **andere** niche of toon, dan **wint de briefing**.
- **Niet "veilig" generiek:** specialistisch en onderscheidend **ja**; saai grijs-blauw + willekeurig drie identieke icoonkaarten **nee** — tenzij dat expliciet bij deze klant past.`;
  }
  return `=== SECTOR (geen keyword-match op vaste branche-preset) ===
De interne branche-router vond **geen** profiel op **bedrijfsnaam + briefing** — normaal voor niches die (nog) geen eigen \`profileId\` in de lijst hebben.
- **Jij = branche-onderzoek:** lees naam + briefing als **evidence-first** sectorbepaling (aanbod, jargon, doelgroep, regio) en kies **zelf** een logische set sectie-\`id\`'s (uit o.a. \`hero\`, \`features\`, \`about\`, \`gallery\`, \`team\`, \`pricing\`, \`testimonials\`, \`faq\`, \`cta\`, \`footer\`) die bij **die** sector passen — zoals een agency vóór het ontwerp onderzoekt. Geen generieke SaaS-stack als de briefing iets anders is.
- **Verboden:** "veilig" terugvallen op anonieme SaaS-defaults. **Gewenst:** gedurfde maar coherente layout, kleur en typografie die de **inhoud** ondersteunen.`;
}

/**
 * Bouw de branche- en stijl-specifieke prompt-hints die meegestuurd worden naar Claude.
 * Branche = structuur (welke secties, welk content-type).
 * Stijl = visuele taal (kleuren, fonts, sfeer).
 * Deze twee zijn onafhankelijk en worden apart meegestuurd.
 */
function buildIndustryPromptHint(businessName: string, description: string): string {
  const industry = detectIndustry(combinedIndustryProbeText(businessName, description));
  const style = detectStyle(description);
  const parts: string[] = [];

  parts.push(buildSectorRouterAndCreativeMandateMarkdown(industry));

  if (industry) {
    parts.push(`=== BRANCHE-INSPIRATIE (gedetecteerd: ${industry.label}) ===

Structuur- en contenthint voor deze branche (geen vast sjabloon). Visuele stijl: zie hieronder of de briefing.

${industry.promptHint}

**Suggesties:** hero ≈ ${industry.heroStrategy === "photo" ? "foto-gedreven" : industry.heroStrategy === "typographic" ? "typografisch" : "productfocus"}; diensten ≈ ${industry.servicesFormat === "price-list" ? "prijslijst" : industry.servicesFormat === "card-grid" ? "kaarten/grid" : industry.servicesFormat === "split" ? "split" : "spotlight"} — alleen als het de briefing versterkt.`);
  }

  const explicitColors = detectExplicitColors(description);
  const hasExplicitColors = explicitColors.length > 0;

  if (style) {
    parts.push(`=== DESIGNTAAL (hint: ${style.label}) ===

Onderstaande tekst is een **richtlijn**. Als de briefing of branche iets anders vraagt, volg je de briefing.

${style.designLanguage}`);

    if (hasExplicitColors) {
      parts.push(`=== KLEUR + STIJL ===
Briefing noemt **${explicitColors.join(", ")}** met stijl **${style.label}**. Gebruik die kleuren als basis (donkere/lichte tinten), laat typografie en ritme bij de stijl passen, en voeg geen extra kleurfamilies toe tenzij de briefing dat vraagt.`);
    } else {
      parts.push(`=== KLEURPALET (geen expliciete kleuren in briefing) ===\n\n${style.colorPalette}`);
    }

    const secondaries = getSecondaryStyleProfilesForBlend(description, style.id);
    if (secondaries.length > 0) {
      parts.push(`=== MEERDERE STIJL-SIGNALEN (geen verplichte mix) ===
**Primair (pipeline):** ${style.label}. **Ook in de tekst:** ${secondaries.map((s) => s.label).join(" · ")}.

**Regels — coherentie boven “leuk mixen”:**
1. **Eén hoofd-esthetiek.** Bouw de site alsof er **één** duidelijke visuele identiteit is.
2. **Secundair alleen als het echt past** bij primair **én** bij de briefing. Gebruik het dan **spaarzaam** (één sectie, één componenttype, of kleine accenten — geen halve pagina in stijl A en halve in stijl B).
3. **Als twee signalen botsen**, kies **alleen primair** en laat het andere **weg** — tenzij de briefing **expliciet** contrast/juxtapositie vraagt. Voorbeelden van **riskante combinaties** (niet samen als gelijkwaardig hoofdbeeld): Brutalism ↔ Neumorphism; Skeuomorphism ↔ Brutalism; Neumorphism ↔ Glassmorphism als beide dominant; Flat/minimal als **totale** vlakstijl ↔ zware skeuomorfe UI.
4. **Combinaties die vaak wél logisch zijn** (één dominant): Cyberpunk/futuristisch + **lichte** glass-accenten op donker; Minimal/flat + **enkele** frosted panels; Editorial + luxe-typografie; Gradient/vibrant + modern strakke grid.

Als je twijfelt: **kies primair en negeer secundair** — liever strak één stijl dan een onsamenhangende mash-up.`);
    }
  } else {
    parts.push(`=== VISUELE STIJL (geen keyword-match — kies zelf) ===

Geen "modern/luxe/vintage" gedetecteerd in de tekst. Kies de sterkste richting voor deze branche${industry ? ` (${industry.label})` : ""} en naam.

- Vermijd generieke SaaS-starters: standaard indigo-slate + drie identieke feature-cards zonder reden.
- Liever één duidelijk palet en typografie met karakter dan veilige defaults.`);
  }

  const uniquenessNote = `\n\n**Doel:** een site die **duidelijk bij deze klant** hoort — ${style && industry ? `Combinatie "${style.label}" met ${industry.label.toLowerCase()} mag fundamenteel anders zijn dan dezelfde branche met een andere stijl.` : `Compositie en detail maken het verschil, niet alleen kleur.`}`;

  return `\n\n${parts.join("\n\n")}${uniquenessNote}\n`;
}

// ---------------------------------------------------------------------------
// Kleur-detectie: haal expliciete kleurwensen uit de briefing
// ---------------------------------------------------------------------------

const COLOR_KEYWORDS: Record<string, string[]> = {
  groen: ["groen", "green", "emerald", "smaragd"],
  wit: ["wit", "white", "witte"],
  zwart: ["zwart", "black", "donker", "dark"],
  rood: ["rood", "red", "bordeaux", "robijn"],
  blauw: ["blauw", "blue", "navy", "marine"],
  goud: ["goud", "gold", "gouden"],
  beige: ["beige", "crème", "creme", "zand", "sand"],
  bruin: ["bruin", "brown", "espresso", "chocolade"],
  oranje: ["oranje", "orange"],
  paars: ["paars", "purple", "violet"],
  roze: ["roze", "pink"],
  teal: ["teal", "petrol", "turquoise"],
  grijs: ["grijs", "grey", "gray"],
};

/**
 * Detecteer of de briefing expliciete kleurwensen bevat.
 * Retourneert de gevonden kleurnamen (NL), of een lege array als er geen zijn.
 */
export function detectExplicitColors(description: string): string[] {
  const lower = description.toLowerCase();
  const found: string[] = [];
  for (const [colorName, variants] of Object.entries(COLOR_KEYWORDS)) {
    if (variants.some((v) => lower.includes(v))) {
      found.push(colorName);
    }
  }
  return found;
}

function fnv1aHash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function formatRecentClientsLine(names: string[]): string {
  if (names.length === 0) {
    return "(Geen recente klantnamen in DB — varieer desondanks waar het past.)";
  }
  return names.map((n) => `"${n.replace(/"/g, "'")}"`).join(", ");
}

const ACCENT_FAMILY_MANDATES = [
  "Accent-familie **teal/petrol** (vertrouwd, fris): bijv. `#0f7669`, `#0d9488`, `#115e59` — **niet** oranje tenzij de branche expliciet warm/food vraagt.",
  "Accent-familie **violet/indigo** (premium tech): bijv. `#5b21b6`, `#6d28d9`, `#4f46e5` — contrasteer met lichte of zandkleurige basis.",
  "Accent-familie **robijn/roze** (energie, zorg, lifestyle): bijv. `#9f1239`, `#be123c`, `#db2777` — alleen op knoppen en highlights.",
  "Accent-familie **elektrisch blauw** (SaaS, finance): bijv. `#1d4ed8`, `#2563eb`, `#1e40af` op warme of grijze achtergrond.",
  "Accent-familie **mosterd/oker** (warm, niet standaard orange): bijv. `#a16207`, `#ca8a04` gecombineerd met **navy** als primary — vermijd `#f97316` als default.",
  "Accent-familie **smaragd/bos** (groei, duurzaamheid, gezondheid): bijv. `#047857`, `#059669`, `#065f46`.",
  "Accent-familie **slate + koper** (luxury modern): CTA in `#b45309` / `#c2410c` (koper) of diep `#0c4a6e` i.p.v. fel oranje.",
] as const;

/** Roteert per run om “dezelfde marketing-layout” te doorbreken (hash in buildVarianceBlock). */
const LAYOUT_ARCHETYPE_MANDATES = [
  "**Layout-lijn (A):** geen bullet-daaltrein met **identieke** kaarten onder elkaar — gebruik **asymmetrie**, \`md:col-span-2\` breakout, of één brede **editoriale band** met groot citaat/cijfer i.p.v. 3×2 mini-columns.",
  "**Layout-lijn (B):** vermijd dat de **hele** pagina “hero + 3‑koloms USP‑grid” is — kies **horizontale scroll-strip**, **bento** (\`grid-cols-4\` met ongelijke cellen), of een **typografie-only** trust-blok **zonder** pictogram-raster.",
  "**Layout-lijn (C):** wissel sectieritme: **split met veel negatieve ruimte**, **staggered cards** (alternerend \`md:translate-y-*\`), of **twee kolommen met één megakaart** — niet overal dezelfde \`grid md:grid-cols-3 gap-6\`.",
  "**Layout-lijn (D):** hero-compositie **wisselen**: deze run óf **oversized type + zijstreep**, óf **full-bleed met asymmetrische overlay**, óf **50/50 split met asymmetrische crop** — kort vermelden in \`config.style\`.",
  "**Layout-lijn (E):** diensten/USPs als **één horizontale band/tijdlijn** of **max. 2 kolommen brede kaarten** — geen zes gelijke tegeltjes tenzij de briefing expliciet “pijlers” noemt.",
] as const;

function buildVarianceBlock(
  businessName: string,
  description: string,
  recentClientNames: string[],
  varianceNonce?: string,
): string {
  const h = fnv1aHash(
    `${businessName}\n${description.slice(0, 120)}\n${recentClientNames.join(",")}\n${varianceNonce ?? ""}`,
  );
  const accentIdx = (h >> 3) % ACCENT_FAMILY_MANDATES.length;
  const layoutIdx = (h >> 7) % LAYOUT_ARCHETYPE_MANDATES.length;
  const explicitColors = detectExplicitColors(description);
  const hasExplicitColors = explicitColors.length > 0;
  const accentLine = hasExplicitColors
    ? `- **Kleur:** de briefing noemt **${explicitColors.join(", ")}** — gebruik die als basis voor \`theme\` en UI; geen willekeurig extra palet tenzij de briefing dat vraagt.`
    : `- **Accentsuggestie (${accentIdx + 1}/${ACCENT_FAMILY_MANDATES.length}):** ${ACCENT_FAMILY_MANDATES[accentIdx]}`;
  const layoutLine = `- ${LAYOUT_ARCHETYPE_MANDATES[layoutIdx]} (${layoutIdx + 1}/${LAYOUT_ARCHETYPE_MANDATES.length})`;

  return `=== 0A. COMPOSITIE (deze run) ===
Kies **één** duidelijke lijn door de pagina (bijv. editorial type, asymmetrische splits, of een duidelijk licht/donker ritme) en houd die **consequent** vast. Herhaal niet in elke sectie hetzelfde 3-koloms kaarten-grid tenzij de briefing of branche dat echt vraagt.

${layoutLine}

${accentLine}

**Prioriteit:** sterke briefing > deze zinnetjes.
**Niet "veilig":** de accent-suggestie is bedoeld om **herkenbare** merkkleur te forceren — **niet** om visueel timide te zijn.`;
}

function buildUpgradePreserveLayoutBlock(): string {
  return `=== 0A. UPGRADE — BEHOUD LAY-OUT (verplicht; gaat boven standaard-variatie) ===

Deze opdracht is een **uitbreiding** op een bestaande site, **geen** volledige herontwerp-ronde.

- **Negeer** voor deze run het normale "forceer een andere layout / andere nav / andere kleuren"-mandaat (§1 Uniekheids-protocol geldt hier **niet** voor wat al bestaat).
- **Behoud** \`config\` (theme, font, style) **identiek** aan de bestaande site als die hieronder in JSON staat; zo niet beschikbaar, trek \`config\` **strikt** uit de briefing en wees **consistent** met de beschreven huidige look.
- **Behoud** de **html** van elke bestaande marketingsectie **letterlijk** (zelfde Tailwind-classes en structuur), tenzij je **minimaal** een \`href="#…"\` of \`id\` moet toevoegen voor **nieuwe** secties uit de briefing / §0B.
- Voeg **alleen** de **extra** secties/blokken toe die de briefing of §0B vereist (nieuwe \`id\`'s, uniek), op een logische plek in het \`sections\`-array. **Geen** dubbele \`id\`'s.
- **Geen** wholesale redesign: geen andere kleurpalet-keuze, geen andere hero-structuur, geen herschikking "omdat het mooier is" — alleen gerichte uitbreiding.`;
}

function buildUniquenessProtocolSection(recent: string): string {
  return `=== 1. VARIATIE ===
Recente klanten (vermijd bewust copy-paste van hetzelfde stramien): ${recent}

- Zet in \`config.style\` **één korte zin** (eigen woorden, **max. ${MASTER_PROMPT_CONFIG_STYLE_MAX} tekens**) welk compositieprincipe je kiest; laat layout en typografie dat ondersteunen.
- Varieer sectie-opbouw (lijst / split / grid / typografie-led) — niet drie keer hetzelfde kaartpatroon achter elkaar zonder reden.
- Sterke briefing en branche gaan boven gemakzuchtige defaults.
- **Anti-template:** "veilig" en anoniem ogen is een **mislukking** voor deze studio — voorzichtigheid mag **niet** leiden tot generieke SaaS-esthetiek als de briefing iets specifiekers toelaat.`;
}

function buildUpgradeMergeSection(): string {
  return `=== 1. UPGRADE — SAMENVOEGEN MET BESTAANDE SITE ===

- Output = **één** geldig JSON-object met \`config\` + \`sections\` zoals in §5.
- **config:** kopieer van de bestaande site (zie JSON hieronder of briefing) **zonder** esthetische wijziging.
- **sections:** de bron-JSON bevat per rij \`id\` (stabiele slug), \`sectionName\` (label) en \`html\`. Behoud **exact** dezelfde \`id\`'s en **dezelfde** \`html\` voor die rijen, in **dezelfde volgorde**; voeg daartussen of aan het eind (logisch) **nieuwe** secties toe volgens briefing / §0B.
- Nieuwe secties: unieke \`id\` (bijv. \`portal\`, \`client_dashboard\`); **geen** sectie \`id: "booking"\` of \`id: "shop"\` — die voegt de beheerder later toe via de studio (niet automatisch na AI). Inhoud en Tailwind-stijl moeten **visueel aansluiten** op de bestaande secties.
- Als er **geen** bestaande JSON in de prompt staat: bouw de marketingpagina compact volgens de briefing, maar **zonder** "alles opnieuw verzinnen" — focus op **toevoegen** van gevraagde secties; varieer niet gratuit t.o.v. de beschreven huidige site.`;
}

// ---------------------------------------------------------------------------
// Branche-specifieke prompt-blokken voor gedetecteerde secties
// ---------------------------------------------------------------------------

function buildBrancheSectionPromptBlocks(sectionIds: Set<string>): string {
  const blocks: string[] = [];

  if (sectionIds.has("gallery")) {
    blocks.push(`**=== GALERIJ (id: "gallery") ===**
Alleen zinvol voor **portfolio / interieur / voor-na** (briefing vraagt expliciet om beeldoverzicht). **Niet** voor webshop-/productcatalogus: dat hoort in de shop-module.
- Max. **4–6** beelden, strak grid of editorial — geen “18-tegels om lengte te maken”.
- Unsplash passend bij branche; eigen stijl i.p.v. standaard hover-scale op elke foto.`);
  }

  if (sectionIds.has("brands")) {
    blocks.push(`**=== MERKEN (id: "brands") ===**
Doel: vertrouwen / partners. Eén rustige band met logo's of typografische merknamen — geen verplichte grayscale-template als iets anders beter past.`);
  }

  if (sectionIds.has("team")) {
    blocks.push(`**=== TEAM (id: "team") ===**
Doel: gezichten en rollen. Layout vrij (kaarten, rij, editorial). Zonder namen in de briefing: geen verzonnen persoonsnamen — generieke copy mag.`);
  }

  if (sectionIds.has("about")) {
    blocks.push(`**=== OVER (id: "about") ===**
Doel: vertrouwen in **weinig woorden** + beeld. **Max. 2 korte alinea’s** of één kolom + bullets — geen essay; detail hoort op een \`over-ons\`-subpagina als die bestaat.`);
  }

  if (sectionIds.has("features")) {
    blocks.push(`**=== USP / FEATURES (id: "features") ===**
Per kaart: **titel + één regel** (±10–14 woorden). **Geen** tweede alinea, geen “marketingvulling” om de grid te vullen.`);
  }

  if (sectionIds.has("stats")) {
    blocks.push(`**=== BEWIJS / CIJFERS (id: "stats") ===**
Korte KPI-rij of bullets die **direct** uit de briefing volgen — **geen** verzonnen percentages of volumes (CONTENT AUTHORITY). Als er geen harde cijfers zijn: kwalitatieve indicatoren (“snelle responstijd”, “vaste contactpersoon”) zonder nep-stats.`);
  }

  if (sectionIds.has("steps")) {
    blocks.push(`**=== WERKWIJZE (id: "steps") ===**
3–5 duidelijke stappen (van eerste contact tot oplevering/afronding). Houd het scanbaar; geen tweede feature-kaartenmuur — dat hoort bij \`features\` als je die i.p.v. stappen kiest.`);
  }

  return blocks.length > 0
    ? `\n\n=== BRANCHE-SECTIES (kort — jij ontwerpt de uitwerking) ===\n\n${blocks.join("\n\n")}\n`
    : "";
}

export type ClientImage = { url: string; label?: string };

export type GenerateSitePromptOptions = {
  preserveLayoutUpgrade?: boolean;
  existingSiteTailwindJson?: string | null;
  varianceNonce?: string;
  sectionIdsHint?: string[];
  /**
   * `true` = geen `marketingPages` + `contactSections` in één JSON (alleen landings-`sections`).
   * Kortere model-run — vergelijkbaar met “één pagina eerst” i.p.v. volledige marketing-multi-route.
   * Ook: env `SITE_GENERATION_LANDING_ONLY=1` wanneer hier `undefined`.
   */
  landingPageOnly?: boolean;
  /** Korte prompt (geen branche/stijl/variatie). Ook: env `SITE_GENERATION_MINIMAL_PROMPT=1`. */
  minimalPrompt?: boolean;
  clientImages?: ClientImage[];
  /** Alleen server-side: uit formulier/API; wordt in \`prepareGenerateSiteClaudeCall\` omgezet naar \`referenceSiteSnapshot\`. */
  referenceStyleUrl?: string;
  /** Snapshot na fetch — wordt in de user-prompt ingevoegd. */
  referenceSiteSnapshot?: { url: string; excerpt: string };
  /**
   * Multipage: forceer exact deze `marketingPages`-keys (1–8, slug-formaat, niet gereserveerd).
   * Anders: server kiest set o.a. via retail-detectie of service-default.
   */
  marketingPageSlugs?: string[];
};

const UPGRADE_PROMPT_JSON_MAX = 150_000;

export function extractSectionIdsFromTailwindUpgradeJson(json: string): string[] | null {
  try {
    const o = JSON.parse(json) as { sections?: unknown };
    if (!Array.isArray(o.sections)) return null;
    const ids: string[] = [];
    for (const row of o.sections) {
      if (row && typeof row === "object" && "id" in row) {
        const id = (row as { id: unknown }).id;
        if (typeof id === "string" && id.trim() !== "") ids.push(id);
      }
    }
    return ids.length > 0 ? ids : null;
  } catch {
    return null;
  }
}

export function mergeUpgradeSectionOrder(existing: string[] | null, planned: readonly string[]): string[] {
  if (!existing?.length) return [...planned];
  const out = [...existing];
  for (const id of planned) {
    if (!out.includes(id)) out.push(id);
  }
  return out;
}

export type SerializeSiteForUpgradeResult =
  | { ok: true; json: string }
  | { ok: false; reason: "not_tailwind" | "too_large" };

export function serializeExistingSiteForUpgradePrompt(siteData: unknown): SerializeSiteForUpgradeResult {
  const p = parseStoredSiteData(siteData);
  if (!p || p.kind !== "tailwind") {
    return { ok: false, reason: "not_tailwind" };
  }

  const ids = stableIdsForUpgradeSections(p.sections.map((s) => s.sectionName));

  const build = (rows: { id: string; sectionName?: string; html: string }[]) =>
    JSON.stringify({ config: p.config ?? null, sections: rows });

  let json = build(
    p.sections.map((s, i) => ({
      id: ids[i]!,
      sectionName: s.sectionName,
      html: s.html,
    })),
  );
  if (json.length <= UPGRADE_PROMPT_JSON_MAX) {
    return { ok: true, json };
  }

  json = build(
    p.sections.map((s, i) => ({
      id: ids[i]!,
      sectionName: s.sectionName,
      html: normalizeHtmlWhitespaceForUpgradePrompt(s.html),
    })),
  );
  if (json.length <= UPGRADE_PROMPT_JSON_MAX) {
    return { ok: true, json };
  }

  json = build(
    p.sections.map((s, i) => ({
      id: ids[i]!,
      html: normalizeHtmlWhitespaceForUpgradePrompt(s.html),
    })),
  );
  if (json.length <= UPGRADE_PROMPT_JSON_MAX) {
    return { ok: true, json };
  }

  return { ok: false, reason: "too_large" };
}

/** Fallback als er geen branche-match is: geen vaste “SaaS-landing” (testimonials/pricing/faq) — die komen via keywords of industry-profiel. */
const DEFAULT_SECTIONS = ["hero", "features", "about", "footer"] as const;

/** Minimale HomepagePlan voor self-review / validate. */
function buildMinimalHomepagePlan(sectionIds?: string[]): HomepagePlan {
  const ids = sectionIds ?? [...DEFAULT_SECTIONS];
  return {
    experienceModel: "service_leadgen",
    densityProfile: "balanced",
    compositionPlan: {
      layoutArchetype: "default",
      visualTension: "medium",
      motionPersonality: "subtle",
      macroComposition: "linear",
    },
    navigationModel: { searchPriority: "low" },
    sectionSequence: ids.map((id) => ({
      id,
      type: "marketing",
      density: "balanced",
      priority: "normal",
    })),
  };
}

type SiteGenerationOperationalTailInput = {
  preserve: boolean;
  /** Nieuwe marketing-sites: landings-JSON + aparte \`contactSections\` (geen one-pager). */
  marketingMultiPage?: boolean;
  /** Verplichte `marketingPages`-keys (alleen bij multipage). */
  marketingPageSlugs?: readonly string[];
  requiredIdsLine: string;
  section4Nav: string;
  section5IdsNote: string;
};

function buildMarketingSlugContentHintsLines(slugs: readonly string[]): string {
  const lines: string[] = [];
  for (const raw of slugs) {
    const s = raw.trim().toLowerCase();
    if (s === "wat-wij-doen") {
      lines.push("- **`wat-wij-doen`:** uitgebreid aanbod/diensten — **niet** de homepage-features herhalen.");
    } else if (s === "werkwijze") {
      lines.push("- **`werkwijze`:** proces in stappen — **niet** dezelfde beknopte uitleg als op de landing.");
    } else if (s === "over-ons") {
      lines.push("- **`over-ons`:** verhaal, team of waarden — **niet** opnieuw de homepage-hero.");
    } else if (s === "faq") {
      lines.push("- **`faq`:** meer detail dan een eventuele korte FAQ op de homepage.");
    } else if (s === "collectie") {
      lines.push("- **`collectie`:** assortiment of productlijnen — gericht op kiezen/kopen.");
    } else if (s === "service-retour") {
      lines.push("- **`service-retour`:** levering, service, retour — geen productgrid-kopie.");
    }
  }
  if (lines.length === 0) {
    return "- Elke slug: inhoud moet **duidelijk** bij die pagina horen — geen letterlijke kopie van andere pagina's of de homepage-longread.";
  }
  return lines.join("\n");
}

/** Gedeelde copy-richting: sales/conversie binnen CONTENT AUTHORITY (geen fictie). */
function buildSiteGenerationSalesCopyGuidanceLine(): string {
  return `- **Copy (conversie / sales):** **Minder is meer** — billboard- en posterlogica: krachtige woorden, geen brochure-lengte. Elke zin moet iets **nieuws** zeggen; **geen** vulling (“ontdek ons…”, “bij ons staat kwaliteit centraal…”) zonder concrete briefing-hook. **Spaarzame** CTA’s met werkende \`href\` (één primair + hoogstens één secundair). **Geen** verzonnen prijzen, stats, reviews of “limited time” — zie CONTENT AUTHORITY.`;
}

/** Gedeelde copy-dichtheid: voorkomt dat het model hero + USP-kaarten volschrijft met alinea’s. */
function buildMinimalMarketingCopyContractMarkdown(): string {
  return `=== COPY — MINDER IS MEER (verplicht) ===
- **Hero (\`#hero\`):** **geen** lange lichaamstekst. Maximaal: **één** \`h1\` (of vergelijkbaar display) + optioneel **één** korte kicker/regel erboven (**≤ 6 woorden**) + **hoogstens één** extra regel onder de kop (**≤ 12 woorden**, één zin of fragment). **Verboden in de hero:** twee of meer \`<p>\`-alinea’s; uitleg die beter onder de vouw past; “vertel”-marketing in plaats van **klap**.
- **Hero-stock (\`<img>\` Unsplash):** de \`alt\` van de **hero**-foto wordt in de studio **gemengd met briefing + Denklijn-contract** om de zoekopdracht te bouwen — schrijf \`alt\` daarom in het **Engels** als **5–12 concrete scene-keywords** die de **branche + gewenste sfeer** letterlijk beschrijven (bijv. \`neon city street night red lights amsterdam canal\`, \`barbershop interior leather chairs vintage mirrors\`). **Vermijd** vage generieke \`alt\` zoals \`business people\` of \`happy team\` tenzij de briefing dat echt vraagt.
- **USP / feature-kaarten / stappen:** per item **titel + hoogstens één korte regel** (**≤ 14 woorden**); **geen** tweede alinea of doorlopende zin om de kaart te vullen.
- **Over / lange secties:** zelfs bij \`about\` of marketing-subpagina’s: **kern + witruimte** — geen drie identieke marketing-alinea’s achter elkaar.
- **Toon:** Nederlands mag strak en volwassen zijn; **kort** wint van “professioneel klinkend door veel woorden”.`;
}

/** §3B–§5 voor multi-route marketing: landing + vaste subpagina's + contact. */
function buildMarketingMultiPageOperationalTail(
  input: Pick<
    SiteGenerationOperationalTailInput,
    "requiredIdsLine" | "section4Nav" | "section5IdsNote" | "marketingPageSlugs"
  >,
): string {
  const { requiredIdsLine, section4Nav, section5IdsNote, marketingPageSlugs = [] } = input;
  const slugList = marketingPageSlugs.map((s) => `\`"${s.trim().toLowerCase()}"\``).join(", ");
  const hrefExamples = marketingPageSlugs
    .map((s) => `\`href="__STUDIO_SITE_BASE__/${s.trim().toLowerCase()}"\``)
    .join(", ");
  const marketingJsonExample = marketingPageSlugs
    .map(
      (raw) =>
        `    "${raw.trim().toLowerCase()}": [{ "id": "a", "html": "<section id=\\"a\\" class=\\"...\\">…</section>" }, { "id": "b", "html": "<section id=\\"b\\" class=\\"...\\">…</section>" }]`,
    )
    .join(",\n");
  const slugHints = buildMarketingSlugContentHintsLines(marketingPageSlugs);

  return `=== 3B. OPERATIONELE SITE — TEKSTEN & WERKENDE LINKS (verplicht) ===

- **Copy:** Nederlands, **strak en kort** (geen Lorem ipsum) — zelfde CONTENT AUTHORITY; zie **COPY — MINDER IS MEER** op de landing.
${buildSiteGenerationSalesCopyGuidanceLine()}
- **Meerdere echte pagina’s in één JSON:**
  - \`sections\` = **landingspagina** (compact: hero + evt. korte trust/USP; **geen** volledige longread die al op een marketing-subpagina hoort). **Geen** dubbele “tweede hero” met dezelfde CTA’s als de eerste; **geen** marketing-fotogalerij-raster voor producten die in de webshop horen.
  - \`marketingPages\` = **verplicht** exact deze keys (geen extra’s, geen missers), elk **minstens twee** HTML-secties met **eigen** \`id\`'s binnen die pagina: ${slugList}.
  - \`contactSections\` = **alleen de contact-subpagina** (route Contact): minstens één **werkend** <form> (naam/e-mail/bericht). **Niet** op de homepage (\`sections\`).
- **Per marketing-key (inhoud):**
${slugHints}
  - Geen **letterlijk dezelfde** blokken tussen pagina’s of tussen landing en subpagina — herschrijf bij twijfel.
- **Homepage + elke marketing-subpagina:** **geen** <form> — wel dezelfde nav met \`href="__STUDIO_CONTACT_PATH__"\` naar het formulier op de contactpagina.
- **Verboden op landings-\`sections\` en op elke \`marketingPages[*]\`:** elk \`<form>\` (ook geen newsletter-mini). Alleen \`contactSections\` mag formulieren.
- **Sectie-ankers:** binnen **één pagina** (\`sections\` of één key van \`marketingPages\`) gebruik je \`href="#…"\` alleen naar \`id\`'s die **op diezelfde pagina** bestaan.
- **Cross-pagina (verplicht):** subpagina’s via ${hrefExamples} en \`href="__STUDIO_CONTACT_PATH__"\` voor Contact. **Verboden:** zelf \`/site/…\`, \`/contact\`, of losse paden verzinnen; **verboden** \`#…\` in de nav voor inhoud die op een marketing-subroute staat.
- **Zelfde header op elke pagina:** herhaal **dezelfde** \`<header>\`/nav-structuur (zelfde \`__STUDIO_SITE_BASE__/…\` + \`__STUDIO_CONTACT_PATH__\`) bovenaan **landing**, elke \`marketingPages\`-pagina, en \`contactSections\` — elke marketing-key moet **minstens één keer** in die nav als \`__STUDIO_SITE_BASE__/<slug>\` voorkomen.
- **Verboden:** \`href="#"\`, lege \`href\`, verzonnen \`__STUDIO_SITE_BASE__/…\` slugs buiten deze keys.
- **Studio-placeholders (alleen letterlijk deze strings):** \`__STUDIO_SITE_BASE__\`, \`__STUDIO_PORTAL_PATH__\`, \`__STUDIO_BOOKING_PATH__\`, \`__STUDIO_SHOP_PATH__\`, \`__STUDIO_CONTACT_PATH__\` — volgens module-instructies uit §0B.
- **WhatsApp:** alleen \`https://wa.me/…\` als een nummer in de briefing staat; anders link naar \`__STUDIO_CONTACT_PATH__\`.
- **Extern (https):** alleen \`https://\`; geen \`http://\` zonder TLS.
- **Knoppen:** geen decoratieve \`<button>\` zonder actie: gebruik \`<a class="…">\` met echte \`href\`.
- **Nieuw tabblad:** bij \`target="_blank"\` altijd \`rel="noopener noreferrer"\`.

=== 4. TECHNISCHE HTML-REGELS ===

- Tailwind + toegestane tags. **Alpine.js** (\`x-*\`, \`@\`, \`:\`) volgens het blok "INTERACTIVITEIT (Alpine.js)" hierboven. Geen \`<script>\` of \`<style>\` **in** sectie-fragmenten, geen klassieke inline event-handlers (\`onclick=\`), geen \`javascript:\` links.
- **Afbeeldingen — BELANGRIJK:** De foto moet **inhoudelijk kloppen** bij de tekst ernaast. Een sectie over waterglijbanen toont waterglijbanen, niet een kantoor. Een restaurant toont eten, niet cosmetica.
  - Gebruik \`https://images.unsplash.com/photo-XXXX?auto=format&fit=crop&w=800&q=80\` met een \`photo-\` id dat het juiste onderwerp toont. Relevante beelden helpen; gradient/kleurvlak mag als het past.
  - \`alt\`-tekst beschrijft wat de foto **moet** tonen (bijv. \`alt="Barbershop interieur met klassieke stoelen en warme verlichting"\`), niet een generieke beschrijving.
  - **Hero + Unsplash (studio):** de zoekopdracht voor de **hero** wordt **branche-eerst** samengesteld uit **briefing + Denklijn-contract**, daarna aangevuld met jouw \`alt\` — schrijf hero-\`alt\` dus als **concrete Engelse zoekkeywords** voor de sector (zie **COPY — MINDER IS MEER** → hero-stock).
  - **Volwassen commerce / lingerie / erotische retail (18+ in briefing):** **nooit** stock met **kinderen, klaslokaal, speelplaats, babykamer, houten speelblokken, knuffels, LEGO, kids toys** — dat is een **ernstige fout** (ook bij brede zoektermen). Richt Unsplash-zoektermen en \`alt\` op **nacht-stad, neon, fluweel/zijde textuur, donkere boutique/hotel-sfeer, abstracte gloed** — of **geen foto** (gradient + sterke typografie) i.p.v. verkeerde niche-beelden.
  - **Verboden:** \`example.com\`, \`via.placeholder\`, \`source.unsplash.com\`, verzonnen paden, en foto's die **niet matchen** met de context van het blok.
  - Voor overige secties (niet-hero): als je geen passende foto vindt, is een sfeervolle **gradient of kleurvlak** acceptabel — maar probeer altijd **eerst** een goede foto.
- Fragment per sectie: geen \`<html>\` / \`<body>\` wrapper.
${section4Nav}- **Responsief:** flex/grid met breakpoints; mobiel blijft bruikbaar.

=== 5. OUTPUT-FORMAAT (strikt JSON) ===

Lever **uitsluitend** één JSON-object. Geen markdown, geen code fences, geen tekst ervoor of erna.

Structuur — \`marketingPages\` met **precies** deze keys (elk **≥2** secties):

{
  "config": { "style": "…", "theme": { "primary": "#…", "accent": "#…", "primaryLight": "#…", "primaryMain": "#…", "primaryDark": "#…" }, "font": "…" },
  "sections": [
    { "id": "hero", "html": "<section id=\\"hero\\" class=\\"...\\">…</section>" }
  ],
  "marketingPages": {
${marketingJsonExample}
  },
  "contactSections": [
    { "id": "contact", "html": "<section id=\\"contact\\" class=\\"...\\"><form>…</form></section>" }
  ]
}

Minimaal deze landings-sectie-\`id\`'s (eigen volgorde mag): ${requiredIdsLine}. **Geen** \`contact\`-sectie met formulier buiten \`contactSections\`. Je mag \`name\` per sectie toevoegen (optioneel).${section5IdsNote}

JSON moet geldig zijn.`;
}

function buildHeroViewportRulesMarkdown(preserve: boolean): string {
  if (preserve) return "";
  return `
- **VIEWPORT / HERO-HOOGTE (kritisch — voorkomt “smalle strook + wit gat” onder de fold):**
  - **\`<section id="hero">\` (buitenste tag):** zet **altijd** een expliciete minimale hoogte op die sectie: \`min-h-[72vh] md:min-h-[80vh]\` (foto-/video-hero) of minstens \`min-h-[65vh] md:min-h-[72vh]\` (typografisch). **Zonder** deze \`min-h-*\` krimpt de hero tot één regel hoogte en vult het iframe-onderste deel met leeg wit — dat is een fout.
  - **Volle viewport op de hero** is toegestaan met **dynamische eenheden**: \`min-h-[100dvh]\` of \`min-h-[min(100dvh,100svh)]\` mag **alleen** op \`#hero\`, niet op andere secties. Gebruik liever \`72vh/80vh\` als je twijfelt.
  - **Verbod (niet-hero secties):** gebruik **geen** \`min-h-screen\`, \`h-screen\`, \`min-h-[100vh]\`, \`h-[100vh]\` op \`#features\`, \`#about\`, shop, footer, enz. — dat maakt lege kolommen en rare scroll in previews. Daar: \`py-16 md:py-24\` + inhoud.
  - **Achtergrond-banden** (CTA/galerij met \`background-image\`, geen hero): max. \`min-h-[40vh] md:min-h-[50vh]\`, geen volledige viewport.
  - **Padding:** op \`#hero\` mag \`py-*\` bíj \`min-h-*\`, maar voorkom extreem hoge \`py-32+\` **zonder** \`min-h-*\` (dan blijft de strook alsnog laag ten opzichte van het scherm).
`;
}

function buildExistingSiteJsonBlock(existingJson: string | undefined | null): string {
  const t = existingJson?.trim();
  if (!t) return "";
  return `

=== BESTAANDE SITE (bron voor config + secties; bij upgrade letterlijk behouden) ===

${t}
`;
}

function buildOperationalNavParts(
  preserve: boolean,
  sectionIdsHint: string[] | undefined,
): Pick<SiteGenerationOperationalTailInput, "requiredIdsLine" | "section4Nav" | "section5IdsNote"> {
  const section4Nav = preserve
    ? `- **Nav / upgrade:** behoud navigatie en hero-structuur uit de **bestaande** hero-\`html\`; werk alleen \`href="#…"\` / \`id\` bij waar nieuwe secties dat vereisen. Nav-vorm **niet verplicht wijzigen** — zie minimale UX-fix onder §3B.\n`
    : `- **Navigatie:** zie §3 — **exact één** globale site-nav (één \`<header>\`/\`<nav>\`-blok met alle ankers); **geen** tweede verticale/zijbalk met dezelfde linkset naast de header. \`href="#…"\` matchen sectie-\`id\`'s. **Vorm vrij** zolang de nav bereikbaar blijft.\n`;
  const section5IdsNote = preserve
    ? `\nIn **upgrade-modus:** behoud alle \`id\`'s (en bij voorkeur de \`html\`) van de bron-secties; voeg alleen **nieuwe** secties toe waar de briefing dat vraagt.`
    : "";
  const requiredIdsLine =
    sectionIdsHint && sectionIdsHint.length > 0
      ? sectionIdsHint.map((s) => `\`${s}\``).join(", ")
      : "`hero`, `features`, `about`, `footer` (+ briefing/branche; **geen** `contact`-sectie met formulier op de landing — contact staat in `contactSections`)";
  return { section4Nav, section5IdsNote, requiredIdsLine };
}

function buildClientImagesPromptBlock(clientImages: ClientImage[]): string {
  if (clientImages.length === 0) return "";
  const list = clientImages.map((img, i) => `${i + 1}. ${img.url}${img.label ? ` — ${img.label}` : ""}`).join("\n");
  return `
=== KLANTFOTO'S (VERPLICHT VERWERKEN) ===

De klant heeft **eigen foto's** aangeleverd. Gebruik deze **in plaats van** Unsplash-stockfoto's. Dit zijn echte foto's van het bedrijf — ze maken de website persoonlijk en authentiek.

${list}

**Regels voor klantfoto's:**
- **NIET in de hero gebruiken.** De hero moet altijd een sterke, professionele Unsplash-foto hebben die de branche visueel neerzet. Klantfoto's zijn vaak niet van hero-kwaliteit (resolutie, compositie, belichting). De hero moet op eigen kracht imponeren.
- **Wel prominent in andere secties:** \`about\` (over ons), \`features\` of andere marketing-secties met **split-layout, kaarten of een strak grid** — foto's groot genoeg (geen verstopte thumbnails). Als de sectielijst **wel** \`gallery\` bevat: mag ook daar. **Zonder** \`gallery\`-sectie (normaal bij webshop/retail): verdeel de klantfoto's over \`about\`/\`features\` (en evt. team) zodat **elke** upload alsnog duidelijk zichtbaar is.
- **Alle aangeleverde foto's moeten zichtbaar in de site komen.** Verdeel ze logisch over de secties (excl. hero).
- Gebruik \`<img src="..." alt="..." class="w-full h-auto object-cover ...">\` of als achtergrondbeeld via inline \`style\` attribuut met \`background-image\` + \`bg-cover bg-center\`.
- **Aanvullen mag:** als er meer visuele plekken zijn dan klantfoto's, vul aan met passende Unsplash-foto's of decoratieve gradiënten. Maar klantfoto's hebben **altijd voorrang** op stockfoto's (behalve in de hero).
- Geef elke klantfoto een beschrijvende \`alt\`-tekst gebaseerd op het label of de context.

`;
}

function buildReferenceSitePromptBlock(
  snap: GenerateSitePromptOptions["referenceSiteSnapshot"],
  businessName: string,
): string {
  if (!snap?.excerpt?.trim()) return "";
  return `

=== REFERENTIESITE (door de server opgehaald — stijl- en structuurhint; geen lange teksten letterlijk kopiëren) ===
URL: ${snap.url}

${snap.excerpt}

**Vertaal naar een eigen one-pager voor "${businessName}":**
- Pak kleurenfamilie, typografie (serif/sans, gewicht), ritme en globale opzet die bij bovenstaande snapshot passen.
- Waar je menu/ankers gebruikt: zorg dat \`href="#…"\` logisch aansluit op de sectie-\`id\`'s op deze one-pager.

`;
}

function buildSection3UpgradeTailMarkdown(preserve: boolean): string {
  return preserve
    ? `\n- **Upgrade-modus:** wijzig geen bestaande sectie-\`html\` tenzij minimaal nodig voor nieuwe \`#id\`-links; nieuwe secties sluiten qua Tailwind-stijl aan op de bestaande blokken.\n`
    : "";
}

/**
 * §3 scroll-reveal (`data-animation`) — identiek in volledige en **minimale** user-prompt.
 * Minimale modus miste eerder de “verplicht bij motion”-regel, waardoor keyword-briefings geen reveals kregen.
 */
function buildSiteGenerationDataAnimationInstructionsMarkdown(): string {
  return `**Animatie — twee opties (één per element):**
- **\`data-animation\` (studio-native):** optioneel op koppen, blokken, kaarten; de studio injecteert CSS + een klein script: bij scroll krijgt het element \`.studio-in-view\` en lopen o.a. \`fade-up\` / \`fade-in\` / \`slide-in-left\` / \`slide-in-right\` / \`scale-in\`.
- **AOS (\`data-aos\`):** de studio laadt **AOS v2** (CSS+JS via CDN) en roept \`AOS.init\` aan. Gebruik bv. \`data-aos="fade-up"\`, \`data-aos="fade-left"\`, \`data-aos="zoom-in"\` — zie [AOS-documentatie](https://michalsnik.github.io/aos/). **Niet** \`data-aos\` en \`data-animation\` op **dezelfde** node combineren (dubbele animatie).
- **GSAP 3 (geavanceerd):** de studio laadt **gsap.min.js** + **ScrollTrigger**, **Flip**, **MotionPathPlugin**, **Observer** (jsDelivr) en registreert de plugins — \`window.gsap\` is beschikbaar. **Verboden in \`sections[].html\`:** eigen \`<script>\` / inline JS (sanitatie + XSS-risico; conflicten met streaming/self-review). **Geen** \`<script src="…gsap…">\` in secties — de shell laadt GSAP al. Gebruik GSAP alleen wanneer de briefing **expliciet** premium/timeline/ScrollTrigger-gedrag vraagt dat \`data-animation\` / \`data-aos\` niet kan: leg dan **\`id\` / \`class\` targets** in de HTML en beschrijf in \`config.style\` of copy dat de gebruiker **Eigen JS** in de editor moet vullen (documenteer kort welke selectors); in de JSON zelf **geen** GSAP-code. Voor standaard scroll-entrances: blijf bij \`data-animation\` / \`data-aos\`.
**Verplicht zodra de briefing erom vraagt (Nederlands of Engels):** woorden en zinnen zoals **interactief** / **interactieve site**, **dynamisch** / **dynamische** / **dynamische website**, **animatie** / **animaties**, **motion**, **micro-interactions** / **micro-interacties**, **scroll-animaties**, **animated on scroll** / **animate on scroll** / **scroll-driven** / **scroll-triggered** / **as you scroll**, **AOS** / **Animate on scroll**, **in beweging**, **beweging** (bedoeld als bewegende UI — niet alleen “een bedrijf in beweging” als platte copy), **beweegbare secties** / **secties die animeren bij scroll**, **levend** / **levendige** site of presentatie, **niet te statisch**, **veel visuele dynamiek**: zet dan op **minstens 10** zichtbare blokken (koppen \`h2\`/\`h3\`, feature-kaarten, grotere tekstkolommen — niet op elk klein label) **\`data-animation\` óf \`data-aos\`** (mag mixen over de pagina, niet op hetzelfde element). Voorbeelden: \`data-animation="fade-up"\` of \`data-aos="fade-up"\` / \`data-aos="fade-left"\`. Eerste scherm (hero + evt. nav): mag subtiel; onder de vouw duidelijker.
**Zelfcheck vóór je de JSON sluit:** (1) Motion-signalen in de briefing → **minstens 10** gecombineerde \`data-animation=\` **of** \`data-aos=\` in de samengevoegde landing-\`sections[].html\` (subpagina’s: ook enkele reveals als het past). (2) Zie ook **border-reveal** hieronder: rand/border/kader/scroll-lijn → **minstens 3** \`studio-border-reveal\`. Zo niet → aanvullen **zonder** sectie-\`id\` of volgorde te wijzigen.`;
}

/** §3B — scroll-accentlijnen (Lovable-achtig); studio-CSS +zelfde IO als data-animation. */
function buildSiteGenerationBorderRevealInstructionsMarkdown(): string {
  return `**Accent-lijn / kader “uitgroeien” bij scroll (\`studio-border-reveal\`):** Zelfde idee als professionele sites waar een lijn **~72% → 100%** loopt zodra het blok in beeld komt. Zet een **lege** \`<div>\` met exact \`studio-border-reveal studio-border-reveal--h\` (horizontaal) of \`studio-border-reveal studio-border-reveal--v\` (verticaal) plus Tailwind voor maat (\`w-full max-w-xl mx-auto mt-6 h-1\` bij \`--h\`; \`min-h-[6rem] w-1 shrink-0\` bij \`--v\`). **Geen** \`<script>\` in secties — de studio levert CSS + observer.
- **Kleur:** op diezelfde \`div\` optioneel \`[--studio-br-rgb:212_175_55]\` (goud), \`[--studio-br-rgb:34_197_94]\`, enz., en/of \`[--studio-br-a:0.85]\`.
- **Waar:** onder \`h2\`/\`h3\`, tussen kop en paragraaf, onder prijs-/USP-kaarten — waar een **editoriale / premium** lijn past.
- **Verplicht** als de briefing vraagt om **rand**, **randen**, **border**, **kader**, **omlijning**, **gouden/teken accent-lijn**, **lijntjes die meebewegen / meegroeien met scroll**, of vergelijkbare UI-motion: **minstens 3** reveals op de landing (\`--h\` en/of \`--v\`). Combineer met \`data-animation\`; **niet** op horizontaal scrollende ticker-/logo-banden plakken.
- **Laser (\`studio-laser-*\`):** blijft een **aparte, zeldzame** sfeer-optie (cyber/neon/sci-fi) — **niet** verplicht en **niet** als vervanging van border-reveal voor normale winkel-/retail-/premium-briefings.
- **Volledige omtrek × document-scroll (\`data-studio-scroll-border\`):** alleen als de briefing echt een **kaderrand om een blok** vraagt die **met scroll** verder “dichtloopt”. Wrapper: \`data-studio-scroll-border\` + verplicht \`style="--studio-sb-stroke:…"\` (hex/rgb — **geen** fallback-kleur in de studio). Optioneel \`--studio-sb-width\` (px). **Geen** \`<script>\` in secties — de shell levert JS + SVG.`;
}

function buildStrictLandingPageComposerMarkdown(includeFaq: boolean): string {
  const countLine = includeFaq
    ? "**5** rijen in `sections` (exact deze volgorde)"
    : "**4** rijen in `sections` (exact deze volgorde — **zonder** `faq`)";

  const navAnchors = includeFaq
    ? "`#hero`, `#stats`/`#brands`, `#steps`/`#features`, `#faq`, `#footer`"
    : "`#hero`, `#stats`/`#brands`, `#steps`/`#features`, `#footer`";

  const faqDetect = `**FAQ wel of niet:** de server zet \`faq\` in de sectielijst als **(a)** naam+briefing FAQ-trefwoorden bevat (**faq**, **veelgestelde vragen**, **veel gestelde**, **vragen en antwoorden**, **help center** / **helpcentrum** — zelfde regex als elders), **of (b)** het gedetecteerde **brancheprofiel** impliciet FAQ wil: zijn standaard-\`sections\` bevat \`faq\`, **of** het profiel heeft \`compactLandingDefaultFaq\` (lokale dienst: kapper, garage, horeca, sportschool, …). Voldoet geen van beide → **geen** \`faq\`-sectie en **geen** \`#faq\` in de nav.`;

  const tailList = includeFaq
    ? `4. \`faq\` — **max. 6** vragen (bij voorkeur \`<details><summary>…\` per vraag).
5. \`footer\` — **eind-CTA + footer** in **dezelfde** sectie; dit is de **enige** volle conversie-CTA onder de hero/nav (geen aparte \`cta\`-sectie of tweede CTA-band daartussen).`
    : `4. \`footer\` — **eind-CTA + footer** in **dezelfde** sectie; dit is de **enige** volle conversie-CTA onder de hero/nav (geen aparte \`cta\`-sectie of tweede CTA-band daartussen). In deze run: **geen** \`faq\`-rij (geen FAQ-signalen in naam+briefing).`;

  return `
=== STRIKTE LANDINGS — STUDIO (max. 5 secties, vaste volgorde) ===

${faqDetect}

**Van toepassing op deze opdracht:** lever precies ${countLine} met **exact** deze JSON-\`id\`'s (gebruik de id's die in de opdrachtregel hieronder staan — \`stats\` **of** \`brands\`, en \`steps\` **of** \`features\`, conform die regel):

1. \`hero\` — **alleen** krachtige kop + **max. één** ultrakorte regel (≤12 woorden); **max. 2** CTA-links (\`<a>\` met button-styling); **max. 3** social-proof-items (alleen uit briefing). **Geen** tweede alinea of “vertel”-tekst in de hero.
2. \`stats\` **of** \`brands\` — precies **één** bewijsblok: KPI-rij **of** logo/partnerband, **niet** beide typen.
3. \`steps\` **of** \`features\` — precies **één** blok: werkwijze (stappen) **of** diensten/USP's, **niet** beide. Elk item **titel + max. één korte regel** — geen kaart-vullende alinea’s.
${tailList}

**Verboden:** scrollende tickers (\`studio-marquee\`, \`studio-marquee-track\`, \`<marquee>\`); sectie \`about\` / "Over ons"; team, prijzen, shop, galerij, testimonials als aparte sectie.

**Nav-ankers:** alleen ${navAnchors} — **geen** \`#over-ons\`.

**Herhaling-check (concept):** elke sectie unieke rol; twee blokken met dezelfde boodschap → het zwakkere schrappen.
`;
}

function buildMarqueeForbiddenPromptLine(): string {
  return `- **Marquee/ticker (verboden):** geen \`studio-marquee\`, \`studio-marquee-track\`, \`<marquee>\`, of oneindig horizontaal scrollende logo-/tekstbanden. Toon logo's/trust **stilstaand** (grid, flex-wrap of vaste rij). **Laser (\`studio-laser-*\`):** alleen bij **duidelijke** futuristische/neon/sci-fi briefing; geen laser “om maar iets te laten bewegen”. Video alleen met **werkende** MP4-URL in de briefing.`;
}

/**
 * Vrije (niet-strikte) runs: het model stapelde te vaak tweede hero-CTA's + fotogalerij naast webshop.
 * Strikte one-pager heeft eigen contract; daarom alleen wanneer `strictLanding` false is.
 */
function buildProfessionalLandingDisciplineMarkdown(marketingMultiPage: boolean): string {
  const multiPageLine = marketingMultiPage
    ? "- **Multi-page homepage:** houd \`sections\` bondig (richtlijn **4–6** secties); **geen** volledige “over ons”-longread op de landing als \`over-ons\` / \`werkwijze\` al eigen subpagina's hebben — verwijs met één zin + link.\n"
    : "";
  return `=== PROFESSIONELE BONDIGHEID (anti-dubbel) ===
- **Geen tweede hero:** geen extra full-bleed blok met **dezelfde** hoofdbelofte **en** dezelfde twee primaire knoppen als in de hero (shop/assortiment + contact). Elke sectie heeft een **eigen** rol; dezelfde saleszin opnieuw = fout.
- **CTA-schaarsheid:** naast de nav: **één** primaire knoppenrij in de hero + **hoogstens één** extra conversieband vóór de footer. **Geen** derde band met weer dezelfde twee acties; de footer sluit af met navigatie/contact.
- **Tekstvolume:** geen “lappen tekst” om secties vol te maken — volg **COPY — MINDER IS MEER** (hero en USP-kaarten extreem kort).
- **Webshop / productverkoop:** **geen** sectie \`id: "gallery"\` met multi-foto collage; product- en catalogusbeelden horen in de **webshop-module**. Op de marketingpagina: hoogstens **één** sterk sfeerbeeld in de hero **of** één beeld in een split bij \`about\`/\`features\` — niet beide als beeldzwembad.
${multiPageLine}`;
}

/** Gedeeld tussen volledige en minimale user-prompt (§3B t/m §5). */
function buildSiteGenerationOperationalTail(input: SiteGenerationOperationalTailInput): string {
  if (input.marketingMultiPage && !input.preserve) {
    return buildMarketingMultiPageOperationalTail(input);
  }
  const { preserve, requiredIdsLine, section4Nav, section5IdsNote } = input;
  return `=== 3B. OPERATIONELE SITE — TEKSTEN & WERKENDE LINKS (verplicht) ===

- **Copy:** **Nederlands, strak en menselijk** — **geen** Lorem ipsum. **Niet** betekenen: lange alinea’s overal; zie **COPY — MINDER IS MEER** (hero en kaarten **kort**). **Geen verzonnen** prijzen, kortingen, testimonials, cijfers, awards of garanties (CONTENT AUTHORITY). FAQ/footer: geen fictieve policies of stats. **Spelling:** correct Nederlands.
${buildSiteGenerationSalesCopyGuidanceLine()}
- **Sectie-ankers:** Het **buitenste** element van elke sectie-\`html\` (eerste tag, meestal \`<section>\`) heeft \`id="…"\` dat **exact gelijk** is aan de JSON-\`id\` van die sectie (bijv. \`"id": "faq"\` → \`<section id="faq" class="…">\`). Zo werkt elke interne link.
- **Interne links (\`#…\`):** Verzamel **alle** sectie-\`id\`'s uit jouw \`sections\`-array. Elke \`<a href="#…">\` (en vergelijkbare CTA's) mag **alleen** naar die id's verwijzen — plus optioneel \`#top\` **als** de hero (of eerste blok) \`id="top"\` heeft. **Verboden:** \`href="#"\`, lege \`href\`, verzonnen fragmenten (\`#sectie-die-niet-bestaat\`).
- **One-pager menu & CTA's (strikt):** Voor springen **binnen deze pagina** gebruik je **alleen** \`href="#<sectie-id>"\` (zelfde id als op het buitenste element van die sectie). **Verboden** voor interne secties: dezelfde canonieke URL op elk item (\`href="/site/jouwe-slug"\`, \`https://…/site/jouwe-slug\` **zonder** hash), of losse paden als \`/diensten\` / \`/contact\` — in de live viewer lijken die “werkend” maar landen ze praktisch allemaal op dezelfde plek. Elk menu-item krijgt **een eigen** geldig anker naar **inhoud die je ook echt in een sectie met die \`id\` uitwerkt** (bv. \`#diensten\`, \`#over-ons\`, \`#klanten\`, \`#faq\`, \`#contact\`). Uitzonderingen: echte externe \`https://\` (social, kaarten), \`mailto:\`, \`tel:\`, en studio-placeholders \`__STUDIO_PORTAL_PATH__\`, \`__STUDIO_BOOKING_PATH__\`, \`__STUDIO_SHOP_PATH__\` volgens de portal-/module-instructies.
- **Contact:** Zonder e-mail/telefoon in de briefing: gebruik **werkende** \`mailto:\`/\`tel:\` met **plausible** adressen afgeleid van de bedrijfsnaam (bijv. \`mailto:info@<kortenaam-zonder-spaties>.nl\`, \`tel:+3185…\` als fictief maar **geldig formaat**) **of** link naar \`#contact\` / \`#footer\` waar een duidelijk contactblok staat — geen dode knoppen.
- **WhatsApp:** Alleen \`https://wa.me/…\` als een nummer in de briefing staat; anders CTA naar \`#contact\` met copy "Neem contact op".
- **Extern (https):** Alleen \`https://\` URL's; gebruik **bestaande** patronen (Google Maps-zoeklink, officiële social templates) of vermijd de link en gebruik intern \`#contact\`. Geen \`http://\` zonder TLS.
- **Knoppen:** Geen decoratieve \`<button>\` zonder actie: gebruik \`<a class="…">\` met echte \`href\` voor navigatie.
- **Nieuw tabblad:** Bij \`target="_blank"\` altijd \`rel="noopener noreferrer"\`.
${preserve ? `- **Upgrade-modus:** Bestaande sectie-\`html\` ongewijzigd laten **behalve** een **minimale** UX-fix als de primaire nav bij scroll onbruikbaar wegglijdt: \`sticky\`, \`fixed\` of hoge \`z-\` + voldoende contrast aanvullen **zonder** de hele header-layout te herontwerpen. **Nieuwe** secties: zelfde regels (root-\`id\`, alleen geldige \`href\`). Nieuwe nav-items: verwijzen naar bestaande **of** nieuwe id's; geen \`href="#"\`.\n` : ""}
=== 4. TECHNISCHE HTML-REGELS ===

- Tailwind + toegestane tags. **Alpine.js** (\`x-*\`, \`@\`, \`:\`) volgens het blok "INTERACTIVITEIT (Alpine.js)" hierboven. Geen \`<script>\` of \`<style>\` **in** sectie-fragmenten, geen klassieke inline event-handlers (\`onclick=\`), geen \`javascript:\` links.
- **Afbeeldingen — BELANGRIJK:** De foto moet **inhoudelijk kloppen** bij de tekst ernaast. Een sectie over waterglijbanen toont waterglijbanen, niet een kantoor. Een restaurant toont eten, niet cosmetica.
  - Gebruik \`https://images.unsplash.com/photo-XXXX?auto=format&fit=crop&w=800&q=80\` met een \`photo-\` id dat het juiste onderwerp toont. Relevante beelden helpen; gradient/kleurvlak mag als het past.
  - \`alt\`-tekst beschrijft wat de foto **moet** tonen (bijv. \`alt="Barbershop interieur met klassieke stoelen en warme verlichting"\`), niet een generieke beschrijving.
  - **Hero + Unsplash (studio):** de zoekopdracht voor de **hero** wordt **branche-eerst** samengesteld uit **briefing + Denklijn-contract**, daarna aangevuld met jouw \`alt\` — schrijf hero-\`alt\` dus als **concrete Engelse zoekkeywords** voor de sector (zie **COPY — MINDER IS MEER** → hero-stock).
  - **Volwassen commerce / lingerie / erotische retail (18+ in briefing):** **nooit** stock met **kinderen, klaslokaal, speelplaats, babykamer, houten speelblokken, knuffels, LEGO, kids toys** — dat is een **ernstige fout** (ook bij brede zoektermen). Richt Unsplash-zoektermen en \`alt\` op **nacht-stad, neon, fluweel/zijde textuur, donkere boutique/hotel-sfeer, abstracte gloed** — of **geen foto** (gradient + sterke typografie) i.p.v. verkeerde niche-beelden.
  - **Verboden:** \`example.com\`, \`via.placeholder\`, \`source.unsplash.com\`, verzonnen paden, en foto's die **niet matchen** met de context van het blok.
  - Voor overige secties (niet-hero): als je geen passende foto vindt, is een sfeervolle **gradient of kleurvlak** acceptabel — maar probeer altijd **eerst** een goede foto.
- Fragment per sectie: geen \`<html>\` / \`<body>\` wrapper.
${section4Nav}- **Responsief:** flex/grid met breakpoints; mobiel blijft bruikbaar.

=== 5. OUTPUT-FORMAAT (strikt JSON) ===

Lever **uitsluitend** één JSON-object. Geen markdown, geen code fences, geen tekst ervoor of erna.

Structuur:

{
  "config": {
    "style": "korte naam van je gekozen visuele richting (max. ${MASTER_PROMPT_CONFIG_STYLE_MAX} tekens)",
    "theme": {
      "primary": "#hex (merkbasis)",
      "accent": "#hex (contrasterende CTA)",
      "primaryLight": "#hex",
      "primaryMain": "#hex",
      "primaryDark": "#hex",
      "secondary": "#hex (optioneel — zichtbaar in UI)",
      "background": "#hex (optioneel pagina/sectie-basis)",
      "textColor": "#hex (optioneel bodytekst)",
      "textMuted": "#hex (optioneel subtekst)",
      "vibe": "luxury|rustic|modern|minimal|playful|corporate|creative|warm|industrial|artisan (optioneel — alleen deze waarden)",
      "typographyStyle": "modern|elegant|bold|minimal|playful|industrial|artisan (optioneel — alleen deze waarden)",
      "borderRadius": "none|sm|md|lg|xl|2xl|full (optioneel)",
      "shadowScale": "none|sm|md|lg|xl|2xl (optioneel)",
      "spacingScale": "compact|normal|relaxed|generous (optioneel)"
    },
    "font": "CSS font-stack, bijv. Inter, system-ui, sans-serif"
  },
  "sections": [
    { "id": "hero", "html": "<section id=\\"hero\\" class=\\"... min-h …\\">… geldige Tailwind + evt. data-animation …</section>" },
    { "id": "features", "html": "<section id=\\"features\\" class=\\"py-16 md:py-24 …\\">…</section>" }
  ]
}

Minimaal deze sectie-\`id\`'s (eigen volgorde mag): ${requiredIdsLine}. Je mag \`name\` per sectie toevoegen (optioneel); anders wordt het label afgeleid van \`id\`.${section5IdsNote}

JSON moet geldig zijn.`;
}

/**
 * `SITE_GENERATION_MINIMAL_PROMPT=1|true|yes` — minder sturing (geen branche-/stijl-/variatieblokken).
 * API kan `minimalPrompt: true` zetten (wint niet over env: beide activeren minimal).
 */
export function isSiteGenerationMinimalPromptFromEnv(): boolean {
  const v = process.env.SITE_GENERATION_MINIMAL_PROMPT?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

/** Alleen landings-`sections` genereren (geen vaste vier marketing-subpagina's + contact-JSON). */
export function isSiteGenerationLandingPageOnlyFromEnv(): boolean {
  const v = process.env.SITE_GENERATION_LANDING_ONLY?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

/** `true`/`false` expliciet van client; bij `undefined` → env. */
export function resolveLandingPageOnlyFlag(explicit?: boolean): boolean {
  if (explicit === true) return true;
  if (explicit === false) return false;
  return isSiteGenerationLandingPageOnlyFromEnv();
}

/** Alleen briefing + CONTENT AUTHORITY + studio-contract + technische tail — geen INDUSTRY/DESIGNTAAL/variatie/§1/shop-blokken. */
function buildMinimalWebsiteGenerationUserPrompt(
  businessName: string,
  description: string,
  _recentClientNames: string[],
  options?: GenerateSitePromptOptions,
): string {
  const preserve = Boolean(options?.preserveLayoutUpgrade);
  const landingPageOnly = Boolean(options?.landingPageOnly);
  const packageBlock = getGenerationPackagePromptBlock(undefined, { preserveLayoutUpgrade: preserve });
  const existingBlock = buildExistingSiteJsonBlock(options?.existingSiteTailwindJson);
  const upgrade0A = preserve ? `${buildUpgradePreserveLayoutBlock()}\n\n` : "";
  const section1 = preserve ? `${buildUpgradeMergeSection()}\n\n` : "";
  const section3Tail = buildSection3UpgradeTailMarkdown(preserve);
  const section3HeroHeight = buildHeroViewportRulesMarkdown(preserve);
  const { section4Nav, section5IdsNote, requiredIdsLine } = buildOperationalNavParts(
    preserve,
    options?.sectionIdsHint,
  );
  const marketingMultiPage = !preserve && !landingPageOnly;
  const marketingPageSlugsForTail = marketingMultiPage ? (options?.marketingPageSlugs ?? []) : [];
  const strictLanding = landingPageOnly && !preserve;
  const contentAuthorityBlock = buildContentAuthorityPolicyBlock();
  const clientImages = options?.clientImages?.filter((img) => img.url) ?? [];
  const clientImagesBlock = buildClientImagesPromptBlock(clientImages);
  const referenceSiteBlock = buildReferenceSitePromptBlock(options?.referenceSiteSnapshot, businessName);
  const sectorRouterMin = buildSectorRouterAndCreativeMandateMarkdown(
    detectIndustry(combinedIndustryProbeText(businessName, description)),
  );
  const mpKeysLine =
    marketingMultiPage && marketingPageSlugsForTail.length > 0
      ? marketingPageSlugsForTail.map((s) => `\`${s}\``).join(", ")
      : "";

  const psychColorLeadMin = preserve
    ? `In **upgrade-modus met bron-JSON:** kopieer \`config\` (style, theme, font) **exact** uit de bestaande site. `
    : "";

  return `Je genereert **één** JSON (Tailwind) met ${marketingMultiPage ? "**landingspagina + vaste subpagina's + contact** (`sections` + `marketingPages` + `contactSections`)" : "**één** one-pager (`sections`)"}. Volg de **briefing**; kies zelf compositie en visuele stijl. **Geen** aparte branche-, designtaal- of variatieblokken in deze opdracht — alleen wat hieronder staat.

Bedrijfsnaam: ${businessName}
Context / branche: ${description}
${SITE_GENERATION_DESIGN_CONTRACT_SLOT}
${clientImagesBlock}${referenceSiteBlock}

${sectorRouterMin}

${upgrade0A}${contentAuthorityBlock}

=== 0B. SITE STUDIO — PRODUCTINSTRUCTIES ===

${packageBlock}${existingBlock}
${section1}=== KERN (technisch) ===

1. Output = **één geldig JSON** volgens §5 — geen markdown, code fences of tekst eromheen.
2. **Responsive** layout; landings-sectie-\`id\`'s kloppen met \`href="#…"\` **op de landing**; cross-pagina via \`__STUDIO_SITE_BASE__/…\` en \`__STUDIO_CONTACT_PATH__\` (zie §3B).
3. Altijd \`config\` (volledig \`theme\`) + \`sections\`${marketingMultiPage ? ` + **verplicht** \`marketingPages\` (exact deze keys: ${mpKeysLine || "zie §3B"}) + \`contactSections\` (contact-subpagina: minstens één sectie met <form>; **niet** op de homepage)` : ""}.
4. ${preserve ? "**Upgrade:** respecteer §0A en de bestaande JSON hierboven." : strictLanding ? "**Strikte one-pager:** exact **4 of 5** secties (zie STRIKTE LANDINGS: FAQ alleen bij FAQ-signalen in naam+briefing) in de volgorde van de opdrachtregel — geen extra secties." : "Geen vast sjabloon — de briefing is leidend."}

=== 2. THEMA / KLEUR ===

${psychColorLeadMin}Vul \`config.theme\` passend bij de briefing. Laat het palet in de HTML zichtbaar terugkomen. ${preserve ? "" : "Oranje alleen als het inhoudelijk past."}

=== 3. PAGINA → HTML (Tailwind) ===
${strictLanding ? buildStrictLandingPageComposerMarkdown(shouldIncludeCompactLandingFaq(combinedIndustryProbeText(businessName, description))) : ""}
${buildMinimalMarketingCopyContractMarkdown()}
${!strictLanding ? `\n${buildProfessionalLandingDisciplineMarkdown(marketingMultiPage)}\n` : ""}
- **Nav (one-pager):** **exact één** globale navigatie (\`#hero\` of eerste sectie: één \`<header>\`/\`<nav>\` met merk + **alle** interne links). **Verboden:** dezelfde menu-items **tweemaal** (bv. verticale linkkolom in de hero **én** horizontale topbar) — dat voelt als twee sites in één. Hamburger/overlay telt als **dezelfde** nav, geen tweede kopie. **Vorm vrij** (sticky, pill, fixed, …); nav moet bruikbaar blijven bij scroll. **Mobiel:** \`x-data\` op \`<header>\` (of één parent van knop + sheet + \`x-show\`-iconen) — anders geen werkende toggle.
- **Hero:** **kop + max. één korte regel** (zie COPY — MINDER IS MEER); **één primaire CTA** (en optioneel **één secundaire** met echte \`href\`) — tenzij de briefing expliciet tekst-only wil. **Verboden:** decoratief scroll-label zonder echte link/anker.
- **Secties:** typisch \`py-16 md:py-24\`, \`max-w-7xl mx-auto px-4 sm:px-6\` — wijk af als de briefing of ontwerp dat vraagt.
- **Klantfoto's:** volg het blok hierboven (niet in de hero).

${buildSiteGenerationDataAnimationInstructionsMarkdown()}

${buildSiteGenerationBorderRevealInstructionsMarkdown()}
${buildMarqueeForbiddenPromptLine()}

${section3Tail}${section3HeroHeight}

${getAlpineInteractivityPromptBlock()}

${buildSiteGenerationOperationalTail({
    preserve,
    marketingMultiPage,
    marketingPageSlugs: marketingPageSlugsForTail,
    requiredIdsLine,
    section4Nav,
    section5IdsNote,
  })}`;
}

export function buildWebsiteGenerationUserPrompt(
  businessName: string,
  description: string,
  recentClientNames: string[],
  options?: GenerateSitePromptOptions,
): string {
  const recent = formatRecentClientsLine(recentClientNames);
  if (options?.minimalPrompt) {
    return buildMinimalWebsiteGenerationUserPrompt(businessName, description, recentClientNames, options);
  }
  const preserve = Boolean(options?.preserveLayoutUpgrade);
  const landingPageOnly = Boolean(options?.landingPageOnly);
  const variance = preserve
    ? buildUpgradePreserveLayoutBlock()
    : buildVarianceBlock(businessName, description, recentClientNames, options?.varianceNonce);
  const packageBlock = getGenerationPackagePromptBlock(undefined, { preserveLayoutUpgrade: preserve });
  const existingBlock = buildExistingSiteJsonBlock(options?.existingSiteTailwindJson);
  const section1 = preserve ? buildUpgradeMergeSection() : buildUniquenessProtocolSection(recent);

  const psychColorLead = preserve
    ? `In **upgrade-modus met bron-JSON:** negeer "nieuw palet kiezen" — kopieer \`config\` (style, theme, font) **exact** uit de bestaande site. Zonder bron-JSON: trek \`config\` uit de briefing en wijzig die niet gratuit.\n\n`
    : "";

  const section3Tail = buildSection3UpgradeTailMarkdown(preserve);
  const section3HeroHeight = buildHeroViewportRulesMarkdown(preserve);
  const { section4Nav, section5IdsNote, requiredIdsLine } = buildOperationalNavParts(
    preserve,
    options?.sectionIdsHint,
  );
  const marketingMultiPage = !preserve && !landingPageOnly;
  const marketingPageSlugsForTail = marketingMultiPage ? (options?.marketingPageSlugs ?? []) : [];
  const strictLanding = landingPageOnly && !preserve;
  const contentAuthorityBlock = buildContentAuthorityPolicyBlock();

  const industryProbe = combinedIndustryProbeText(businessName, description);
  const sectionIdsForBlocks = strictLanding
    ? [...buildCompactLandingSectionIds(industryProbe)]
    : (options?.sectionIdsHint ?? buildSectionIdsFromBriefing(industryProbe));
  const detectedSections = new Set(sectionIdsForBlocks);
  const brancheSectionBlocks = buildBrancheSectionPromptBlocks(detectedSections);
  const industryHint = buildIndustryPromptHint(businessName, description);

  const clientImages = options?.clientImages?.filter((img) => img.url) ?? [];
  const clientImagesBlock = buildClientImagesPromptBlock(clientImages);
  const referenceSiteBlock = buildReferenceSitePromptBlock(options?.referenceSiteSnapshot, businessName);
  const mpKeysLine =
    marketingMultiPage && marketingPageSlugsForTail.length > 0
      ? marketingPageSlugsForTail.map((s) => `\`${s}\``).join(", ")
      : "";

  return `Je genereert **één** JSON (Tailwind) met ${marketingMultiPage ? "**landingspagina + subpagina's + contact** (`sections` + `marketingPages` + `contactSections`)" : "**één** one-pager (`sections`)"}. Maak een **professionele, onderscheidende** site die past bij de briefing — **niet** anoniem-veilig; je hebt ruimte voor sterk ontwerp.

Bedrijfsnaam: ${businessName}
Context / branche: ${description}
${SITE_GENERATION_DESIGN_CONTRACT_SLOT}
${clientImagesBlock}${referenceSiteBlock}
=== SFEER (lees de briefing) ===

Let op woorden als vintage, modern, strak, warm, luxe, beige, donker, speels — én expliciete stijlen zoals **glassmorphism**, **neumorphism**, **flat/minimal**, **gradients**, **brutalism**, **cyberpunk/futuristisch**, **editorial**, **skeuomorphism** — vertaal ze naar kleur, typografie en beeld **als de briefing dat impliceert**.

- **Kleur:** als de briefing een palet noemt, volg dat. Anders: kies een coherent palet dat bij branche en toon past (warm, koel, contrastrijk, minimal, …). Woorden als **luxe, premium, exclusief** zijn **geen** mandaat voor een donker site-thema — veel high-end merken zijn overwegend licht of gemixed.
- **Typografie en beeld:** serif vs. sans, schaduwen, foto vs. typografie — laat de briefing leidend zijn; geen verplichte "premium barber"-formule.
- **Branche ≠ één look:** dezelfde branche kan rustiek, luxe, urban of minimal — kies wat het beste aansluit op de **tekst** van de klant.
- **Stijlen mixen:** meerdere trefwoorden in de briefing betekenen **niet** automatisch “alles erin”. Zie het blok **MEERDERE STIJL-SIGNALEN** hieronder: **alleen combineren wat esthetisch samenhangt**; anders **één** dominante stijl (zoals gedetecteerd) en de rest laten vallen.
- **Geen “twee sites in één”:** **één** navbar, **één** visueel taalspoor (typografie + layout-ritme) — geen losse experimenten per sectie die niet bij elkaar horen.

${variance}
${industryHint}
${contentAuthorityBlock}

=== 0B. SITE STUDIO — PRODUCTINSTRUCTIES (gaat boven algemene uitbreiding) ===

${packageBlock}${existingBlock}

=== 0. KERN (technisch + kwaliteit) ===

1. Output = **één geldig JSON** volgens §5 — geen andere vorm.
2. **Balans:** duidelijke hiërarchie en leesbaarheid; \`60-30-10\` is optionele richting, geen wiskunde.
3. **Mobiel + navigatie:** werkende responsive layout en **precies één** globale navigatie boven de vouw (\`<header>\`/\`<nav>\` — zie §3). **Geen dubbele navbar** met dubbele linksets. Sticky balk, pill of fixed: allemaal oké; ${marketingMultiPage ? "subpagina-links via __STUDIO_SITE_BASE__ (zie §3B); " : ""}landings-\`id\`'s consistent met \`href="#…"\` **alleen binnen dezelfde pagina**; link “Contact” naar \`__STUDIO_CONTACT_PATH__\` ${marketingMultiPage ? "(verplicht token)" : ""}.
4. **JSON:** altijd \`config\` (volledig \`theme\`) + \`sections\`${marketingMultiPage ? ` + **verplicht** \`marketingPages\` (exact deze keys: ${mpKeysLine || "zie §3B"}) + \`contactSections\` (alleen contact-subroute met formulier)` : ""}.
5. **Kleur:** als een flashy wens botst met de branche, gebruik die kleur liever **als accent** (§2). ${preserve ? " **Upgrade:** bestaande \`config.theme\` uit bron wint." : ""}

${section1}

=== 2. THEMA / KLEUR ===

${psychColorLead}Vul \`config.theme\` passend bij de branche: \`primary\` + \`primaryLight\` / \`primaryMain\` / \`primaryDark\` + contrasterende \`accent\`. Oranje alleen als het inhoudelijk klopt; de accent-suggestie in §0A is **vrijwillig**. Houd dominante vlakken rustig.

**Kleur in HTML:** laat \`config.theme\` ook in de markup terugkomen (achtergronden, accenten, CTA) — niet alleen in metadata. Als de briefing warm beige/zand vraagt, vermijd een volledig koud-grijs default-palet tenzij dat bewust past.

=== 3. PAGINA COMPOSEREN → HTML (Tailwind) ===
${strictLanding ? buildStrictLandingPageComposerMarkdown(shouldIncludeCompactLandingFaq(industryProbe)) : ""}
${buildMinimalMarketingCopyContractMarkdown()}
${!strictLanding ? `\n${buildProfessionalLandingDisciplineMarkdown(marketingMultiPage)}\n` : ""}

**Vrijheid:** ${strictLanding ? "Binnen de **vijf** vaste secties (zie STRIKTE LANDINGS) is visuele uitwerking vrij — **geen** wijziging van volgorde of \`id\`'s." : "hero, secties en lay-out stem je af op de **briefing**; geen verplicht sjabloon (editorial, kaarten, foto-hero, typografie-led — allemaal toegestaan)."}

**Navigatie (${marketingMultiPage ? `multi-page: landing + marketing-subroutes (${mpKeysLine || "zie §3B"}) + contact` : "one-pager"}):** **één** globale nav met **merk/bedrijfsnaam** en bruikbare links. ${marketingMultiPage ? `Voor elke marketing-key: **uitsluitend** \`__STUDIO_SITE_BASE__/<slug>\` (slugs: ${mpKeysLine || "zie §3B"}); **geen** \`#…\`-nav naar inhoud die op een subroute staat. ` : ""}Op **één** pagina: \`href="#sectie-id"\` alleen naar id's op **die** pagina. **Contact:** \`href="__STUDIO_CONTACT_PATH__"\`. **Geen tweede** volledige menu. Primaire CTA mag in de nav en/of **één** vaste floating knop. **Vorm vrij** (sticky, pill, blur, Alpine scroll). Hamburger = zelfde nav, geen duplicaat. **Verboden:** een permanente rechter/ linker zij-navigatiekolom (\`fixed top-0 right-0 h-full\` of \`fixed ... left-0 ... h-full\`) die op desktop zichtbaar blijft naast de hoofdnav. **Mobiel uitklapmenu:** standaard **gesloten** (Alpine \`open\`/\`menuOpen\`/\`navOpen\` start op \`false\`); geen fullscreen overlay bij eerste load. **\`x-data\` op \`<header>\`** (of één wrapper rond knop + sheet + beide iconen) zodat hamburger/\`x-show\` dezelfde scope delen — anders blijven streepjes en × vaak **tegelijk** zichtbaar. **Niet** leveren zonder zichtbare site-nav boven de vouw.

**Één site, één systeem:** kies **één** duidelijke typografie-hiërarchie (bijv. één sans-familie door de hele pagina, of **één** serif voor koppen **als** \`config.font\` daar logisch bij aansluit). **Vermijd** willekeurig \`font-serif\` op body/footer als de rest brutal/cyberpunk sans is — dan oogt het als browser-Times. Body op donker: **minimaal** \`text-gray-200\`–\`text-gray-300\`, liever \`font-normal\`/\`medium\` dan \`font-light\` + te lage contrast.

**Hero (\`#hero\`):** eerste indruk = **typografie + beeld**, niet een **brochure**: zie **COPY — MINDER IS MEER** — **geen** twee alinea’s onder de kop. **Één primaire CTA** en optioneel **één secundaire** (werkende \`href\`). **Verboden:** decoratief **scroll**-label in de hero. Volg **§VIEWPORT**. Combineer met **foto (Unsplash), split of gradient**; **Achtergrond-\`<video>\`:** alleen met **concrete https-URL** in de briefing; anders foto/gradient + \`data-animation\` / AOS. Houd je aan **BRANCHE-INSPIRATIE**.

**Klantfoto's:** blijven **buiten** de hero (zie blok KLANTFOTO'S hierboven).

**Verdere secties:** typisch \`py-16 md:py-24\` en \`max-w-7xl mx-auto px-4 sm:px-6\` — wijk af als de briefing of jouw ontwerp dat vraagt. Wissel achtergronden voor ritme; **geen** harde eis op aantal donkere banden.

**Diensten / features:** kies lijst, grid, split of iets anders — per item **titel + max. één korte regel** (geen alinea per kaart).

**Decoratie:** optioneel kleine **inline SVG** of \`data-lucide\` — niet verplicht.

${buildSiteGenerationDataAnimationInstructionsMarkdown()}

${buildSiteGenerationBorderRevealInstructionsMarkdown()}

${buildMarqueeForbiddenPromptLine()}

**Laserlijn / scan (optioneel — alleen passende sfeer):** **Standaard: geen** \`studio-laser-*\`. Gebruik liever \`studio-border-reveal\` + \`data-animation\`. Zet een laser **alleen** als de klant **duidelijk** futuristisch/neon/sci-fi vraagt (woorden als **cyberpunk, synthwave, neon-UI, sci-fi, hologram, scan-lijn**, of expliciete \`Stijl: …\`). **Niet** op donker thema of “branche is X” alleen. Techniek (als je het wél inzet): pure studio-CSS; horizontaal \`<div class="studio-laser-h absolute inset-x-0 top-0 z-20" aria-hidden="true"></div>\` binnen \`relative\` parent; varianten \`studio-laser-h--neon\`, \`--magenta\`, \`--slow\` / \`--fast\`; verticaal \`studio-laser-v\` + hoogte; max. **één** sweep-rail per hero (niet overal).

**Hover:** optioneel \`transition\` / lichte schaal of schaduw op knoppen en kaarten.

**Video-hero:** \`<video>\` **alleen** met een **https-URL** die letterlijk in de briefing of bijlagen staat — **geen** verzonnen of “standaard” stock-URL's. Zonder zo'n URL: **geen** fullscreen stock-video; gebruik Unsplash/gradient + motion zoals elders. Bij een echte videobron: \`autoplay muted loop playsinline\`, \`bg-black\` op wrapper, \`preload="auto"\`; **geen** \`poster\` met een **andere** stockfoto dan de video (knippert bij buffer/loop).

**Foto's:** relevante Unsplash waar het helpt; gradient of kleurvlak mag. Match onderwerp met tekst.

${section3Tail}${section3HeroHeight}

${getAlpineInteractivityPromptBlock()}
${brancheSectionBlocks}
${buildSiteGenerationOperationalTail({
    preserve,
    marketingMultiPage,
    marketingPageSlugs: marketingPageSlugsForTail,
    requiredIdsLine,
    section4Nav,
    section5IdsNote,
  })}`;
}

export type GenerateSiteResult =
  | { ok: true; data: GeneratedTailwindPage }
  | { ok: false; error: string; rawText?: string };

export type GenerateSiteStreamHooks = {
  onTextDelta?: (chunk: string) => void;
};

type PreparedGenerateSiteClaudeCall = {
  client: Anthropic;
  /** Model voor de site-generatie zelf (streaming, groot output). */
  generateModel: string;
  /** Model voor support-calls: self-review, design rationale (non-streaming, kleiner). */
  supportModel: string;
  max_tokens: number;
  system?: string;
  userContent: string | ContentBlockParam[];
  homepagePlan: HomepagePlan;
  pipelineFeedback: GenerationPipelineFeedback;
  /** `true` = Claude levert `sections` + `contactSections` (geen one-pager-upgrade). */
  useMarketingMultiPage: boolean;
  /** `landingPageOnly` + geen upgrade: harde 5-sectie-validatie na parse. */
  strictLandingContract: boolean;
  /** Multipage: exacte `marketingPages`-keys (prompt + Zod + validatie). */
  marketingPageSlugs?: readonly string[];
  /** Zelfde excerpt als in de bouw-prompt — voor Denklijn + zelfreview. */
  referenceSiteSnapshot?: { url: string; excerpt: string };
};

type PrepareGenerateSiteResult = PreparedGenerateSiteClaudeCall | { ok: false; error: string };

async function prepareGenerateSiteClaudeCall(
  businessName: string,
  description: string,
  recentClientNames: string[],
  promptOptions?: GenerateSitePromptOptions,
): Promise<PrepareGenerateSiteResult> {
  const apiKey = getAnthropicApiKey();
  if (!apiKey) {
    return {
      ok: false,
      error: `ANTHROPIC_API_KEY ontbreekt in de omgeving. ${ANTHROPIC_KEY_MISSING_USER_HINT}`,
    };
  }

  const generateModel = process.env.ANTHROPIC_GENERATE_MODEL ?? process.env.ANTHROPIC_MODEL ?? DEFAULT_GENERATE_MODEL;
  const supportModel = process.env.ANTHROPIC_MODEL ?? DEFAULT_SUPPORT_MODEL;
  const client = new Anthropic({ apiKey });

  const { systemText: knowledgeSystem, userPrefixBlocks } = await getKnowledgeContextForClaude();

  const preserveLayout = Boolean(promptOptions?.preserveLayoutUpgrade);
  const mergedPromptOptions: GenerateSitePromptOptions = {
    ...promptOptions,
    varianceNonce: promptOptions?.varianceNonce ?? randomUUID(),
    landingPageOnly: resolveLandingPageOnlyFlag(promptOptions?.landingPageOnly),
  };

  const refUrlRequested = mergedPromptOptions.referenceStyleUrl?.trim();
  let referenceSiteSnapshot: { url: string; excerpt: string } | undefined;
  let referenceStyleField: GenerationPipelineFeedback["interpreted"]["referenceStyle"] | undefined;
  if (refUrlRequested) {
    const fr = await fetchReferenceSiteForPrompt(refUrlRequested);
    if (fr.ok) {
      referenceSiteSnapshot = { url: fr.finalUrl, excerpt: fr.excerpt };
      referenceStyleField = {
        requestedUrl: refUrlRequested,
        status: "ingested",
        finalUrl: fr.finalUrl,
        excerptChars: fr.excerpt.length,
      };
    } else {
      referenceStyleField = {
        requestedUrl: refUrlRequested,
        status: "failed",
        error: fr.error,
      };
    }
  }

  const industryProbe = combinedIndustryProbeText(businessName, description);
  const strictLandingContract = Boolean(mergedPromptOptions.landingPageOnly) && !preserveLayout;
  const briefingSectionIds = strictLandingContract
    ? [...buildCompactLandingSectionIds(industryProbe)]
    : buildSectionIdsFromBriefing(industryProbe, mergedPromptOptions.sectionIdsHint);
  const sectionIds = [...briefingSectionIds];
  if (preserveLayout && mergedPromptOptions.existingSiteTailwindJson) {
    const existing = extractSectionIdsFromTailwindUpgradeJson(mergedPromptOptions.existingSiteTailwindJson);
    if (existing) {
      sectionIds.length = 0;
      sectionIds.push(...mergeUpgradeSectionOrder(existing, briefingSectionIds));
    }
  }

  const homepagePlan = buildMinimalHomepagePlan(sectionIds);

  const detectedIndustry = detectIndustry(industryProbe);
  const styleResolved = resolveStyleDetection(description);
  const minimalPrompt =
    Boolean(mergedPromptOptions.minimalPrompt) || isSiteGenerationMinimalPromptFromEnv();
  const useMarketingMultiPage = !preserveLayout && !mergedPromptOptions.landingPageOnly;
  let marketingPageSlugs: readonly string[] | undefined;
  try {
    marketingPageSlugs = useMarketingMultiPage
      ? resolveMarketingPageSlugsForGeneration({
          combinedProbe: industryProbe,
          detectedIndustryId: detectedIndustry?.id,
          override: mergedPromptOptions.marketingPageSlugs,
        })
      : undefined;
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Ongeldige marketingPageSlugs.",
    };
  }
  const pipelineFeedback: GenerationPipelineFeedback = {
    model: generateModel,
    interpreted: {
      businessName: businessName.trim(),
      description: description.trim().slice(0, 500),
      sections: sectionIds,
      detectedIndustry: detectedIndustry?.label,
      detectedIndustryId: detectedIndustry?.id,
      detectedStyle: styleResolved.profile?.label,
      detectedStyleId: styleResolved.profile?.id,
      styleDetectionSource: styleResolved.source,
      ...(referenceStyleField ? { referenceStyle: referenceStyleField } : {}),
      minimalPrompt,
      landingPageOnly: mergedPromptOptions.landingPageOnly,
      strictLandingPageContract: strictLandingContract,
      compactLandingIncludesFaq: strictLandingContract ? shouldIncludeCompactLandingFaq(industryProbe) : undefined,
      ...(marketingPageSlugs ? { marketingPageSlugs: [...marketingPageSlugs] } : {}),
    },
  };

  const { referenceStyleUrl, ...promptOptsForBuild } = mergedPromptOptions;
  void referenceStyleUrl;
  const corePrompt = buildWebsiteGenerationUserPrompt(
    businessName,
    description,
    recentClientNames,
    {
      ...promptOptsForBuild,
      sectionIdsHint: sectionIds,
      ...(referenceSiteSnapshot ? { referenceSiteSnapshot } : {}),
      minimalPrompt,
      ...(marketingPageSlugs ? { marketingPageSlugs: [...marketingPageSlugs] } : {}),
    },
  );
  const mainUserPrompt = corePrompt;

  const max_tokens = DEFAULT_MAX_OUTPUT_TOKENS;

  const userContent: string | ContentBlockParam[] =
    userPrefixBlocks.length > 0
      ? [...userPrefixBlocks, { type: "text", text: `\n\n=== OPDRACHT (site-generatie) ===\n\n${mainUserPrompt}` }]
      : mainUserPrompt;

  const systemParts = [
    minimalPrompt ? MASTER_SITE_SYSTEM_PROMPT_MINIMAL : MASTER_SITE_SYSTEM_PROMPT,
  ];
  if (knowledgeSystem?.trim()) {
    systemParts.push(knowledgeSystem.trim());
  }
  const system = systemParts.join("\n\n---\n\n");

  return {
    client,
    generateModel,
    supportModel,
    max_tokens,
    system,
    userContent,
    homepagePlan,
    pipelineFeedback,
    useMarketingMultiPage,
    strictLandingContract,
    ...(marketingPageSlugs ? { marketingPageSlugs } : {}),
    ...(referenceSiteSnapshot ? { referenceSiteSnapshot } : {}),
  };
}

export function withContentClaimDiagnostics(data: GeneratedTailwindPage): GeneratedTailwindPage {
  const html = [
    ...data.sections.map((s) => s.html),
    ...(data.contactSections ?? []).map((s) => s.html),
    ...(data.marketingPages != null
      ? Object.values(data.marketingPages).flatMap((secs) => secs.map((s) => s.html))
      : []),
  ].join("\n");
  return {
    ...data,
    contentClaimDiagnostics: buildContentClaimDiagnosticsReport(html),
  };
}

function finalizeGenerateSiteFromClaudeText(
  textBody: string,
  stop_reason: string | null,
  options: {
    useMarketingMultiPage: boolean;
    strictLandingContract?: boolean;
    marketingPageSlugs?: readonly string[];
  },
): GenerateSiteResult {
  if (!textBody.trim()) {
    return { ok: false, error: "Geen tekst-antwoord van Claude ontvangen." };
  }

  const parsedResult = parseModelJsonObject(textBody);
  if (!parsedResult.ok) {
    const truncated =
      stop_reason === "max_tokens"
        ? " Het antwoord werd afgekapt (model outputlimiet). Probeer een kortere briefing of minder secties in één run."
        : "";
    return {
      ok: false,
      error: `Antwoord is geen geldige JSON.${truncated}`,
      rawText: textBody,
    };
  }

  if (options.useMarketingMultiPage) {
    const slugs = options.marketingPageSlugs;
    if (!slugs?.length) {
      return {
        ok: false,
        error: "Interne fout: multipage zonder marketingPageSlugs (prepareGenerateSiteClaudeCall).",
        rawText: textBody,
      };
    }
    let marketingSchema;
    try {
      marketingSchema = buildClaudeTailwindMarketingSiteOutputSchema(slugs);
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : "Ongeldig marketingPageSlugs-schema.",
        rawText: textBody,
      };
    }
    const normalized = normalizeClaudeSectionArraysInParsedJson(parsedResult.value);
    const validated = marketingSchema.safeParse(
      ensureClaudeMarketingSiteJsonHasContactSections(normalized, slugs),
    );
    if (!validated.success) {
      return {
        ok: false,
        error: `JSON voldoet niet aan het schema: ${validated.error.message}`,
        rawText: textBody,
      };
    }
    const navHtml = collectMarketingNavScanHtml({
      sections: validated.data.sections,
      marketingPages: validated.data.marketingPages,
      contactSections: validated.data.contactSections,
    });
    const linkCheck = validateMarketingPageLinks(navHtml, validated.data.marketingPages);
    if (!linkCheck.valid) {
      const miss = linkCheck.missingKeys.join(", ");
      return {
        ok: false,
        error: `Nav bevat __STUDIO_SITE_BASE__/-links naar ontbrekende marketingPages: ${miss}.`,
        rawText: textBody,
      };
    }
    const coverCheck = validateMarketingPagePlanNavCoverage(validated.data.marketingPages, navHtml);
    if (!coverCheck.valid) {
      const miss = coverCheck.missingInNav.join(", ");
      return {
        ok: false,
        error: `Nav mist minstens één link per marketingpagina. Ontbrekend in nav: ${miss}.`,
        rawText: textBody,
      };
    }
    const contentCheck = validateMarketingPageContent(validated.data.marketingPages);
    if (!contentCheck.valid) {
      return {
        ok: false,
        error: `Marketingpagina-inhoud: ${contentCheck.errors.join(" ")}`,
        rawText: textBody,
      };
    }
    const processed = postProcessClaudeTailwindMarketingSite(validated.data);
    const mapped = mapClaudeMarketingSiteOutputToSections(processed);
    const ruleErrors = validateMarketingSiteHardRules(
      mapped.sections,
      mapped.contactSections,
      mapped.marketingPages,
    );
    if (ruleErrors.length > 0) {
      return {
        ok: false,
        error: `Site-regels: ${ruleErrors.join(" ")}`,
        rawText: textBody,
      };
    }
    return { ok: true, data: mapped };
  }

  const validated = claudeTailwindPageOutputSchema.safeParse(
    normalizeClaudeSectionArraysInParsedJson(parsedResult.value),
  );
  if (!validated.success) {
    return {
      ok: false,
      error: `JSON voldoet niet aan het schema: ${validated.error.message}`,
      rawText: textBody,
    };
  }

  const processed = postProcessClaudeTailwindPage(validated.data);
  const mapped = mapClaudeOutputToSections(processed);
  if (options.strictLandingContract) {
    const strictErrors = validateStrictLandingPageContract(mapped.sections);
    if (strictErrors.length > 0) {
      return {
        ok: false,
        error: `Strikte landingspagina: ${strictErrors.join(" ")}`,
        rawText: textBody,
      };
    }
  }
  return { ok: true, data: mapped };
}

export async function generateSiteWithClaude(
  businessName: string,
  description: string,
  recentClientNames: string[] = [],
  promptOptions?: GenerateSitePromptOptions,
  streamHooks?: GenerateSiteStreamHooks,
): Promise<GenerateSiteResult> {
  const prepared = await prepareGenerateSiteClaudeCall(businessName, description, recentClientNames, promptOptions);

  if ("ok" in prepared && prepared.ok === false) {
    return { ok: false, error: prepared.error };
  }

  const p = prepared as PreparedGenerateSiteClaudeCall;

  const rationale = await generateDesignRationaleWithClaude(p.client, p.supportModel, {
    businessName,
    description,
    feedback: p.pipelineFeedback,
    referenceSiteSnapshot: p.referenceSiteSnapshot,
  });
  let designContract: DesignGenerationContract | null = null;
  const userContentForGeneration =
    rationale.ok && rationale.contract != null
      ? appendDesignContractToUserContent(
          p.userContent,
          buildDesignContractPromptInjection(rationale.contract, p.referenceSiteSnapshot ?? null),
        )
      : p.userContent;
  if (rationale.ok && rationale.contract != null) {
    designContract = rationale.contract;
  }

  let textBody = "";
  let usage: MessageDeltaUsage | null = null;
  let stop_reason: string | null = null;

  try {
    for await (const ev of streamClaudeMessageText(p.client, {
      model: p.generateModel,
      max_tokens: p.max_tokens,
      system: p.system,
      userContent: userContentForGeneration,
    })) {
      if (ev.type === "delta") {
        textBody += ev.text;
        streamHooks?.onTextDelta?.(ev.text);
      } else {
        usage = ev.usage;
        stop_reason = ev.stop_reason;
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Claude-streaming mislukt.";
    return { ok: false, error: msg };
  }

  if (usage) {
    await logClaudeMessageUsage("generate_site", p.generateModel, {
      input_tokens: usage.input_tokens ?? 0,
      output_tokens: usage.output_tokens,
      cache_creation_input_tokens: usage.cache_creation_input_tokens,
      cache_read_input_tokens: usage.cache_read_input_tokens,
    });
  }

  const result = finalizeGenerateSiteFromClaudeText(textBody, stop_reason, {
    useMarketingMultiPage: p.useMarketingMultiPage,
    strictLandingContract: p.strictLandingContract,
    marketingPageSlugs: p.marketingPageSlugs,
  });
  if (!result.ok) {
    return result;
  }

  let data = withContentClaimDiagnostics(result.data);

  const reviewed = await applySelfReviewToGeneratedPage({
    client: p.client,
    model: p.supportModel,
    businessName,
    description,
    draft: data,
    homepagePlan: p.homepagePlan,
    preserveLayoutUpgrade: Boolean(promptOptions?.preserveLayoutUpgrade),
    pipelineInterpreted: p.pipelineFeedback.interpreted,
    designContract,
    referenceSiteSnapshot: p.referenceSiteSnapshot,
  });
  data = reviewed.data;

  const unsplashTheme = buildUnsplashThemeContextWithContract(description, designContract, businessName);
  data = {
    ...data,
    sections: await replaceUnsplashImagesInSections(
      data.sections,
      process.env.UNSPLASH_ACCESS_KEY,
      unsplashTheme,
      { designContract, pageIntent: "home" },
    ),
    ...(data.contactSections != null && data.contactSections.length > 0
      ? {
          contactSections: await replaceUnsplashImagesInSections(
            data.contactSections,
            process.env.UNSPLASH_ACCESS_KEY,
            unsplashTheme,
            { designContract, pageIntent: "contact" },
          ),
        }
      : {}),
    ...(data.marketingPages != null && Object.keys(data.marketingPages).length > 0
      ? {
          marketingPages: Object.fromEntries(
            await Promise.all(
              Object.entries(data.marketingPages).map(async ([k, secs]) => [
                k,
                await replaceUnsplashImagesInSections(secs, process.env.UNSPLASH_ACCESS_KEY, unsplashTheme, {
                  designContract,
                  pageIntent: "marketing",
                }),
              ]),
            ),
          ),
        }
      : {}),
  };

  data = {
    ...data,
    sections: finalizeBookingShopAfterAiGeneration(data.sections, {
      preserveLayoutUpgrade: Boolean(promptOptions?.preserveLayoutUpgrade),
    }),
  };

  if (process.env.NODE_ENV === "development") {
    const joined = data.sections.map((s) => s.html).join("\n");
    const v = validateGeneratedPageHtml(joined, p.homepagePlan);
    if (v.errors.length > 0 || v.warnings.length > 0) {
      console.warn("[validateGeneratedPageHtml]", v);
    }
  }

  if (p.strictLandingContract) {
    const strictErrs = validateStrictLandingPageContract(data.sections);
    if (strictErrs.length > 0) {
      return { ok: false, error: `Strikte landingspagina: ${strictErrs.join(" ")}` };
    }
  }

  return { ok: true, data };
}

export type GenerateSiteStreamNdjsonEvent =
  | { type: "status"; message: string }
  | { type: "keepalive" }
  | { type: "generation_meta"; feedback: GenerationPipelineFeedback }
  | {
      type: "design_rationale";
      text: string | null;
      contract?: DesignGenerationContract | null;
      contractWarning?: string | null;
      skipReason?: string;
    }
  | { type: "self_review"; ran: boolean; refined: boolean }
  | { type: "token"; content: string }
  | { type: "section_complete"; section: { id: string; html: string; sectionName?: string } }
  | { type: "complete"; outputFormat: "tailwind_sections"; data: GeneratedTailwindPage }
  | { type: "complete"; outputFormat: "react_sections"; data: ReactSiteDocument }
  | { type: "error"; message: string; rawText?: string };

/**
 * Tijdens stille server-stappen (o.a. zelfreview) bytes blijven sturen zodat proxies/CDN's geen idle-timeout geven.
 * Kort interval + **direct eerste ping**: `setInterval` vuurt anders pas na 1× interval — bij 10s was de eerste
 * stilte vaak langer dan veel loadbalancers (5–60s) tolereren, vooral net ná de token-stream.
 */
const NDJSON_SILENT_WORK_KEEPALIVE_MS = 4_000;

/** Houd gelijk met `export const maxDuration` in `app/api/generate-site/stream/route.ts`. */
const GENERATE_SITE_STREAM_MAX_DURATION_MS = 300_000;
/** Ruimte voor zelfreview + Unsplash + journal vóór Vercel het verzoek beëindigt. */
const GENERATE_SITE_TAIL_RESERVE_MS = 95_000;

function startNdjsonKeepaliveForSilentWork(
  controller: ReadableStreamDefaultController<Uint8Array>,
  send: (c: ReadableStreamDefaultController<Uint8Array>, e: GenerateSiteStreamNdjsonEvent) => void,
): () => void {
  const ping = () => {
    try {
      send(controller, { type: "keepalive" });
    } catch {
      /* stream gesloten of enqueue geweigerd */
    }
  };
  ping();
  const timer = setInterval(ping, NDJSON_SILENT_WORK_KEEPALIVE_MS);
  return () => clearInterval(timer);
}

export type CreateGenerateSiteReadableStreamOptions = {
  onSuccess?: (data: GeneratedTailwindPage) => Promise<void>;
};

/** Hangt het Denklijn-contract in de user-prompt (placeholder vóór referentie-excerpt, anders achteraan). */
export function appendDesignContractToUserContent(
  userContent: string | ContentBlockParam[],
  contractBlock: string,
): string | ContentBlockParam[] {
  const header = "\n\n=== DESIGN-AFSPRAAK (Denklijn-contract, bindend in deze run) ===\n\n";
  const footer =
    "\n\nVolg dit blok bij `config`, hero-beelden en motion. Bij **expliciete** tegenstrijdigheid met de briefing over **feiten of claims** wint de briefing. " +
    "Voor **beelden, sfeer en sectorherkenning** gelden `imageryMustReflect`, `heroVisualSubject` en dit contract samen met de briefing — vervang geen branche-passende scènes door generieke stock alleen omdat het REFERENTIESITE-excerpt veel markup bevat.";

  const injection = `${header}${contractBlock}${footer}`;

  const injectIntoText = (text: string): string => {
    if (text.includes(SITE_GENERATION_DESIGN_CONTRACT_SLOT)) {
      return text.replace(SITE_GENERATION_DESIGN_CONTRACT_SLOT, injection);
    }
    return `${text}${injection}`;
  };

  if (typeof userContent === "string") {
    return injectIntoText(userContent);
  }
  if (userContent.length === 0) {
    return [{ type: "text", text: injection.trim() }];
  }
  const last = userContent[userContent.length - 1];
  if (last?.type === "text" && "text" in last && typeof (last as { text: string }).text === "string") {
    const lt = last as { type: "text"; text: string };
    return [...userContent.slice(0, -1), { type: "text", text: injectIntoText(lt.text) }];
  }
  return [...userContent, { type: "text", text: injection.trim() }];
}

export function createGenerateSiteReadableStream(
  businessName: string,
  description: string,
  recentClientNames: string[],
  promptOptions?: GenerateSitePromptOptions,
  streamOptions?: CreateGenerateSiteReadableStreamOptions,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const send = (controller: ReadableStreamDefaultController<Uint8Array>, event: GenerateSiteStreamNdjsonEvent) => {
    controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
  };

  return new ReadableStream({
    async start(controller) {
      const streamWallClockStartMs = Date.now();
      try {
        const hasRefStyleUrl = Boolean(promptOptions?.referenceStyleUrl?.trim());
        send(controller, {
          type: "status",
          message: hasRefStyleUrl
            ? "Generatie gestart — briefing en context worden voorbereid (kan ½–2 min duren: referentiesite ophalen en zware context)."
            : "Generatie gestart — briefing en context worden voorbereid (typisch ½–2 min; langer bij een uitgebreide briefing of veel opties).",
        });

        /** Zonder pings blijft async `site_generation_jobs` minutenlang zonder `updated_at` tijdens o.a. (optionele) referentiesite-fetch + promptbouw. */
        const stopPrepareKeepalive = startNdjsonKeepaliveForSilentWork(controller, send);
        let prepared: Awaited<ReturnType<typeof prepareGenerateSiteClaudeCall>>;
        try {
          prepared = await prepareGenerateSiteClaudeCall(
            businessName,
            description,
            recentClientNames,
            promptOptions,
          );
        } finally {
          stopPrepareKeepalive();
        }

        if ("ok" in prepared && prepared.ok === false) {
          send(controller, { type: "error", message: prepared.error });
          controller.close();
          return;
        }

        const p = prepared as PreparedGenerateSiteClaudeCall;
        send(controller, { type: "generation_meta", feedback: p.pipelineFeedback });

        send(controller, { type: "status", message: "Denklijn uitschrijven (interpretatie → woorden)…" });
        const stopRationaleKeepalive = startNdjsonKeepaliveForSilentWork(controller, send);
        let rationale: Awaited<ReturnType<typeof generateDesignRationaleWithClaude>>;
        try {
          rationale = await generateDesignRationaleWithClaude(p.client, p.supportModel, {
            businessName,
            description,
            feedback: p.pipelineFeedback,
            referenceSiteSnapshot: p.referenceSiteSnapshot,
          });
        } finally {
          stopRationaleKeepalive();
        }
        let designContract: DesignGenerationContract | null = null;
        let contractWarning: string | null = null;
        if (rationale.ok) {
          if (rationale.contract != null) {
            designContract = rationale.contract;
            contractWarning = null;
          } else {
            designContract = null;
            contractWarning =
              "contractWarning" in rationale ? (rationale.contractWarning ?? null) : null;
          }
          send(controller, {
            type: "design_rationale",
            text: rationale.text,
            contract: designContract,
            contractWarning,
          });
        } else {
          send(controller, {
            type: "design_rationale",
            text: null,
            contract: null,
            contractWarning: null,
            skipReason: rationale.error,
          });
        }

        const userContentForGeneration =
          rationale.ok && rationale.contract != null
            ? appendDesignContractToUserContent(
                p.userContent,
                buildDesignContractPromptInjection(rationale.contract, p.referenceSiteSnapshot ?? null),
              )
            : p.userContent;

        send(controller, { type: "status", message: "Pagina genereren (HTML/JSON)…" });
        let buffer = "";
        const sentSectionIds = new Set<string>();
        let extractTick = 0;
        let usage: MessageDeltaUsage | null = null;
        let stop_reason: string | null = null;

        for await (const ev of streamClaudeMessageText(p.client, {
          model: p.generateModel,
          max_tokens: p.max_tokens,
          system: p.system,
          userContent: userContentForGeneration,
        })) {
          if (ev.type === "delta") {
            buffer += ev.text;
            send(controller, { type: "token", content: ev.text });
            extractTick += 1;
            if (buffer.length < 120_000 || extractTick % 14 === 0) {
              const { newSections } = tryExtractCompletedSections(buffer, sentSectionIds);
              for (const section of newSections) {
                send(controller, { type: "section_complete", section });
              }
            }
          } else {
            usage = ev.usage;
            stop_reason = ev.stop_reason;
          }
        }

        const stopUsageKeepalive = startNdjsonKeepaliveForSilentWork(controller, send);
        try {
          if (usage) {
            await logClaudeMessageUsage("generate_site", p.generateModel, {
              input_tokens: usage.input_tokens ?? 0,
              output_tokens: usage.output_tokens,
              cache_creation_input_tokens: usage.cache_creation_input_tokens,
              cache_read_input_tokens: usage.cache_read_input_tokens,
            });
          }
        } finally {
          stopUsageKeepalive();
        }

        const result = finalizeGenerateSiteFromClaudeText(buffer, stop_reason, {
          useMarketingMultiPage: p.useMarketingMultiPage,
          strictLandingContract: p.strictLandingContract,
          marketingPageSlugs: p.marketingPageSlugs,
        });
        if (!result.ok) {
          send(controller, {
            type: "error",
            message: result.error,
            ...(result.rawText ? { rawText: result.rawText } : {}),
          });
          controller.close();
          return;
        }

        let data = withContentClaimDiagnostics(result.data);

        const elapsedBeforeSelfReviewMs = Date.now() - streamWallClockStartMs;
        const selfReviewBudgetExceeded =
          elapsedBeforeSelfReviewMs > GENERATE_SITE_STREAM_MAX_DURATION_MS - GENERATE_SITE_TAIL_RESERVE_MS;

        let reviewed: Awaited<ReturnType<typeof applySelfReviewToGeneratedPage>>;
        if (!isSiteSelfReviewEnabled()) {
          reviewed = { data, ran: false, usedRefined: false };
        } else if (selfReviewBudgetExceeded) {
          send(controller, {
            type: "status",
            message:
              "Zelfreview overgeslagen: tijdbudget voor deze run is bijna op — concept wordt direct afgerond (geen verbinding-verlies).",
          });
          reviewed = { data, ran: false, usedRefined: false };
        } else {
          send(controller, {
            type: "status",
            message: "Kwaliteitscontrole: concept nalopen en zo nodig verbeteren (zelfreview)…",
          });
          const stopSelfReviewKeepalive = startNdjsonKeepaliveForSilentWork(controller, send);
          try {
            reviewed = await applySelfReviewToGeneratedPage({
              client: p.client,
              model: p.supportModel,
              businessName,
              description,
              draft: data,
              homepagePlan: p.homepagePlan,
              preserveLayoutUpgrade: Boolean(promptOptions?.preserveLayoutUpgrade),
              pipelineInterpreted: p.pipelineFeedback.interpreted,
              designContract,
              referenceSiteSnapshot: p.referenceSiteSnapshot,
            });
          } finally {
            stopSelfReviewKeepalive();
          }
        }
        data = reviewed.data;
        send(controller, { type: "self_review", ran: reviewed.ran, refined: reviewed.usedRefined });
        send(controller, {
          type: "status",
          message: reviewed.usedRefined
            ? "Zelfreview toegepast — finale HTML bijgewerkt."
            : reviewed.ran
              ? "Zelfreview afgerond (geen wijziging of overgeslagen)."
              : "Zelfreview overgeslagen (upgrade-modus of uitgeschakeld).",
        });

        if (process.env.UNSPLASH_ACCESS_KEY) {
          send(controller, {
            type: "status",
            message: "Afbeeldingen matchen via Unsplash…",
          });
        }
        const stopUnsplashKeepalive = startNdjsonKeepaliveForSilentWork(controller, send);
        let sectionsAfterUnsplash: typeof data.sections;
        let contactAfterUnsplash: typeof data.contactSections | undefined;
        let marketingAfterUnsplash: typeof data.marketingPages | undefined;
        const unsplashTheme = buildUnsplashThemeContextWithContract(description, designContract, businessName);
        try {
          sectionsAfterUnsplash = await replaceUnsplashImagesInSections(
            data.sections,
            process.env.UNSPLASH_ACCESS_KEY,
            unsplashTheme,
            { designContract, pageIntent: "home" },
          );
          contactAfterUnsplash =
            data.contactSections != null && data.contactSections.length > 0
              ? await replaceUnsplashImagesInSections(
                  data.contactSections,
                  process.env.UNSPLASH_ACCESS_KEY,
                  unsplashTheme,
                  { designContract, pageIntent: "contact" },
                )
              : undefined;
          marketingAfterUnsplash =
            data.marketingPages != null && Object.keys(data.marketingPages).length > 0
              ? Object.fromEntries(
                  await Promise.all(
                    Object.entries(data.marketingPages).map(async ([k, secs]) => [
                      k,
                      await replaceUnsplashImagesInSections(secs, process.env.UNSPLASH_ACCESS_KEY, unsplashTheme, {
                        designContract,
                        pageIntent: "marketing",
                      }),
                    ]),
                  ),
                )
              : undefined;
        } finally {
          stopUnsplashKeepalive();
        }
        data = {
          ...data,
          sections: sectionsAfterUnsplash,
          ...(contactAfterUnsplash != null && contactAfterUnsplash.length > 0
            ? { contactSections: contactAfterUnsplash }
            : {}),
          ...(marketingAfterUnsplash != null ? { marketingPages: marketingAfterUnsplash } : {}),
        };

        data = { ...data, sections: maybeEnhanceHero(data.sections, data.config, description) };

        data = {
          ...data,
          sections: finalizeBookingShopAfterAiGeneration(data.sections, {
            preserveLayoutUpgrade: Boolean(promptOptions?.preserveLayoutUpgrade),
          }),
        };

        if (process.env.NODE_ENV === "development") {
          const joined = data.sections.map((s) => s.html).join("\n");
          const v = validateGeneratedPageHtml(joined, p.homepagePlan);
          if (v.errors.length > 0 || v.warnings.length > 0) {
            console.warn("[validateGeneratedPageHtml]", v);
          }
        }

        if (p.strictLandingContract) {
          const strictErrs = validateStrictLandingPageContract(data.sections);
          if (strictErrs.length > 0) {
            send(controller, {
              type: "error",
              message: `Strikte landingspagina: ${strictErrs.join(" ")}`,
            });
            controller.close();
            return;
          }
        }

        /** Journal + usage-log kunnen lang duren (extra Claude + DB); zonder keepalive knipt de stream vaak net vóór `complete`. */
        const stopPostProcessKeepalive = startNdjsonKeepaliveForSilentWork(controller, send);
        try {
          await streamOptions?.onSuccess?.(data);
        } catch (journalErr) {
          console.error("[generate-site-stream] onSuccess (journal/log) mislukt; generatie wordt alsnog afgerond:", journalErr);
        } finally {
          stopPostProcessKeepalive();
        }

        send(controller, { type: "complete", outputFormat: "tailwind_sections", data });
        send(controller, { type: "status", message: "Generatie voltooid" });
        controller.close();
      } catch (error) {
        send(controller, {
          type: "error",
          message: error instanceof Error ? error.message : "Onbekende fout",
        });
        controller.close();
      }
    },
  });
}

export function generateSiteWithClaudeStreaming(
  businessName: string,
  description: string,
  recentClientNames: string[],
  promptOptions?: GenerateSitePromptOptions,
  streamOptions?: CreateGenerateSiteReadableStreamOptions,
): ReadableStream<Uint8Array> {
  return createGenerateSiteReadableStream(businessName, description, recentClientNames, promptOptions, streamOptions);
}

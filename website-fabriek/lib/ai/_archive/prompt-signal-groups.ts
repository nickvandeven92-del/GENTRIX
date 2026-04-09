/**
 * Signaalgroepen voor prompt-heuristiek: gewogen tokens, regex-roots, frasen, contrast & negatie.
 * Taal: `lang` filtert bij scoring (nl/en); `all` = altijd actief.
 * Downstream telt en weegt — dit is bewust geen first-match parser.
 */

export type PromptSignalLocale = "nl" | "en";

/** Los woord of vaste frase; `weight` is relatief binnen de groep. */
export type WeightedToken = {
  value: string;
  weight: number;
  /** Standaard: beide talen. */
  lang?: "nl" | "en" | "all";
};

/** Morfologische / concept-regex (geen lastIndex-mutatie: altijd nieuwe RegExp bij gebruik). */
export type RegexSignal = {
  re: RegExp;
  weight: number;
  lang?: "nl" | "en" | "all";
};

export function filterWeightedByLocale(
  items: WeightedToken[],
  locale: PromptSignalLocale,
): WeightedToken[] {
  return items.filter((x) => !x.lang || x.lang === "all" || x.lang === locale);
}

export function filterRegexByLocale(
  items: RegexSignal[],
  locale: PromptSignalLocale,
): RegexSignal[] {
  return items.filter((x) => !x.lang || x.lang === "all" || x.lang === locale);
}

// --- Lexicon: luxury / refinement -------------------------------------------

export const WEIGHTED_LUXURY: WeightedToken[] = [
  { value: "luxury", weight: 2, lang: "en" },
  { value: "luxe", weight: 2, lang: "nl" },
  { value: "high-end", weight: 1.9, lang: "all" },
  { value: "high end", weight: 1.9, lang: "all" },
  { value: "exclusive", weight: 1.9, lang: "en" },
  { value: "exclusief", weight: 1.9, lang: "nl" },
  { value: "premium", weight: 1.85, lang: "all" },
  { value: "bespoke", weight: 1.85, lang: "en" },
  { value: "hoogwaardig", weight: 1.5, lang: "nl" },
  { value: "upscale", weight: 1.6, lang: "en" },
  { value: "up-market", weight: 1.5, lang: "en" },
  { value: "boutique", weight: 1.5, lang: "all" },
  { value: "prestige", weight: 1.55, lang: "all" },
  { value: "prestigieus", weight: 1.5, lang: "nl" },
  { value: "designer", weight: 1.4, lang: "all" },
  { value: "signature", weight: 1.35, lang: "en" },
  { value: "chique", weight: 1.45, lang: "all" },
  { value: "stijlvol", weight: 1.35, lang: "nl" },
  { value: "sophisticated", weight: 1.5, lang: "en" },
  { value: "maatwerk", weight: 1.4, lang: "nl" },
  { value: "tailored", weight: 1.35, lang: "en" },
  { value: "refined", weight: 1.4, lang: "en" },
  { value: "luxe uitstraling", weight: 1.6, lang: "nl" },
  { value: "premium gevoel", weight: 1.5, lang: "nl" },
  { value: "high quality", weight: 1.3, lang: "en" },
  { value: "topkwaliteit", weight: 1.3, lang: "nl" },
  { value: "vip", weight: 0.55, lang: "all" },
  { value: "concierge", weight: 0.6, lang: "all" },
  { value: "white glove", weight: 0.65, lang: "en" },
];

/** Woordstammen i.p.v. eindeloze verbuigingen. */
export const REGEX_LUXURY_ROOTS: RegexSignal[] = [
  { re: /\belegan\w*\b/giu, weight: 1.35, lang: "all" },
  { re: /\bverfijn\w*\b/giu, weight: 1.3, lang: "nl" },
];

// --- Minimal / clean --------------------------------------------------------

export const WEIGHTED_MINIMAL: WeightedToken[] = [
  { value: "minimal", weight: 1.5, lang: "en" },
  { value: "minimalist", weight: 1.45, lang: "en" },
  { value: "minimalistisch", weight: 1.45, lang: "nl" },
  { value: "clean", weight: 1.4, lang: "en" },
  { value: "strak", weight: 1.35, lang: "nl" },
  { value: "strakke", weight: 1.2, lang: "nl" },
  { value: "simpel", weight: 1.15, lang: "nl" },
  { value: "eenvoudig", weight: 1.15, lang: "nl" },
  { value: "simple", weight: 1.15, lang: "en" },
  { value: "less is more", weight: 1.5, lang: "en" },
  { value: "veel witruimte", weight: 1.4, lang: "nl" },
  { value: "witruimte", weight: 1.1, lang: "nl" },
  { value: "whitespace", weight: 1.1, lang: "en" },
  { value: "ruim", weight: 1, lang: "nl" },
  { value: "luchtig", weight: 1.15, lang: "nl" },
  { value: "airy", weight: 1.1, lang: "en" },
  { value: "niet te druk", weight: 1.35, lang: "nl" },
  { value: "niet druk", weight: 1.1, lang: "nl" },
  { value: "rustig", weight: 1.1, lang: "nl" },
  { value: "calm", weight: 1.05, lang: "en" },
  { value: "zen", weight: 1, lang: "all" },
  { value: "japans minimal", weight: 1.3, lang: "nl" },
  { value: "subtiel", weight: 1.15, lang: "nl" },
  { value: "subtle", weight: 1.1, lang: "en" },
  { value: "ingehouden", weight: 1.1, lang: "nl" },
  { value: "sober", weight: 1.15, lang: "nl" },
  { value: "pared down", weight: 1.2, lang: "en" },
  { value: "decluttered", weight: 1.15, lang: "en" },
  { value: "uncluttered", weight: 1.15, lang: "en" },
  { value: "flat design", weight: 1, lang: "en" },
  { value: "swiss style", weight: 1.25, lang: "en" },
  { value: "grid", weight: 0.28, lang: "en" },
  { value: "systematic", weight: 0.3, lang: "en" },
];

// --- Tech / SaaS (sterke termen zwaar; brede noise licht) -------------------

export const WEIGHTED_TECH: WeightedToken[] = [
  { value: "saas", weight: 2, lang: "all" },
  { value: "software", weight: 1.5, lang: "all" },
  { value: "api", weight: 1.8, lang: "all" },
  { value: "dashboard", weight: 1.6, lang: "all" },
  { value: "cloud", weight: 1.35, lang: "all" },
  { value: "hosting", weight: 1.2, lang: "all" },
  { value: "devops", weight: 1.45, lang: "all" },
  { value: "sdk", weight: 1.5, lang: "all" },
  { value: "integration", weight: 1.25, lang: "en" },
  { value: "integratie", weight: 1.25, lang: "nl" },
  { value: "automatisering", weight: 1.2, lang: "nl" },
  { value: "machine learning", weight: 1.35, lang: "en" },
  { value: "subscription", weight: 1.25, lang: "en" },
  { value: "abonnement", weight: 1.2, lang: "nl" },
  { value: "per seat", weight: 1.3, lang: "en" },
  { value: "per user", weight: 1.25, lang: "en" },
  { value: "enterprise software", weight: 1.65, lang: "en" },
  { value: "b2b software", weight: 1.55, lang: "en" },
  { value: "digital product", weight: 1.4, lang: "en" },
  { value: "data platform", weight: 1.35, lang: "en" },
  { value: "cybersecurity", weight: 1.3, lang: "en" },
  { value: "security tool", weight: 1.25, lang: "en" },
  { value: "code", weight: 1.15, lang: "en" },
  { value: "developer", weight: 1.2, lang: "en" },
  { value: "developers", weight: 1.15, lang: "en" },
  { value: "frontend", weight: 1.25, lang: "all" },
  { value: "backend", weight: 1.25, lang: "all" },
  { value: "full-stack", weight: 1.3, lang: "all" },
  { value: "fullstack", weight: 1.25, lang: "all" },
  { value: "programmeur", weight: 1.15, lang: "nl" },
  { value: "ontwikkelaar", weight: 1.2, lang: "nl" },
  { value: "ict", weight: 1.1, lang: "nl" },
  { value: "ai tool", weight: 1.2, lang: "en" },
  { value: "platform", weight: 0.65, lang: "all" },
  { value: "app", weight: 0.38, lang: "all" },
];

export const REGEX_TECH_ROOTS: RegexSignal[] = [
  { re: /\bweb\s*app\b/giu, weight: 1.15, lang: "en" },
  { re: /\bmobile\s*app\b/giu, weight: 1.1, lang: "en" },
];

// --- Industrial -------------------------------------------------------------

export const WEIGHTED_INDUSTRIAL: WeightedToken[] = [
  { value: "industrieel", weight: 1.45, lang: "nl" },
  { value: "industrial", weight: 1.45, lang: "en" },
  { value: "robust", weight: 1.2, lang: "en" },
  { value: "robuust", weight: 1.2, lang: "nl" },
  { value: "staal", weight: 1.15, lang: "nl" },
  { value: "steel", weight: 1.15, lang: "en" },
  { value: "metal", weight: 1.1, lang: "en" },
  { value: "metaal", weight: 1.1, lang: "nl" },
  { value: "constructie", weight: 1.2, lang: "nl" },
  { value: "bouw", weight: 1.15, lang: "nl" },
  { value: "aannemer", weight: 1.2, lang: "nl" },
  { value: "aannemers", weight: 1.15, lang: "nl" },
  { value: "installateur", weight: 1.15, lang: "nl" },
  { value: "installateurs", weight: 1.1, lang: "nl" },
  { value: "machine", weight: 1.05, lang: "all" },
  { value: "fabriek", weight: 1.15, lang: "nl" },
  { value: "productie", weight: 1.1, lang: "nl" },
  { value: "logistiek", weight: 1.15, lang: "nl" },
  { value: "warehouse", weight: 1.1, lang: "en" },
  { value: "magazijn", weight: 1.05, lang: "nl" },
  { value: "heavy duty", weight: 1.25, lang: "en" },
  { value: "rauw", weight: 1.1, lang: "nl" },
  { value: "raw", weight: 1.1, lang: "en" },
  { value: "gritty", weight: 1.15, lang: "en" },
  { value: "werkplaats", weight: 1.1, lang: "nl" },
  { value: "monteur", weight: 1.05, lang: "nl" },
  { value: "techniek", weight: 1.1, lang: "nl" },
  { value: "civiel", weight: 1.15, lang: "nl" },
  { value: "infra", weight: 1.05, lang: "nl" },
  { value: "infrastructuur", weight: 1.15, lang: "nl" },
];

// --- Editorial (narrative / beeld / ritme; branche zwak) ---------------------

export const WEIGHTED_EDITORIAL: WeightedToken[] = [
  { value: "editorial", weight: 1.75, lang: "all" },
  { value: "story-led", weight: 1.55, lang: "en" },
  { value: "narrative", weight: 1.6, lang: "en" },
  { value: "storytelling", weight: 1.55, lang: "all" },
  { value: "immersive", weight: 1.45, lang: "en" },
  { value: "image-first", weight: 1.5, lang: "en" },
  { value: "image first", weight: 1.45, lang: "en" },
  { value: "art-directed", weight: 1.5, lang: "en" },
  { value: "art direction", weight: 1.45, lang: "all" },
  { value: "art directed", weight: 1.4, lang: "en" },
  { value: "sequenced", weight: 1.35, lang: "en" },
  { value: "chaptered", weight: 1.2, lang: "en" },
  { value: "editorial layout", weight: 1.55, lang: "en" },
  { value: "long-form", weight: 1.45, lang: "en" },
  { value: "long form", weight: 1.4, lang: "en" },
  { value: "reading rhythm", weight: 1.45, lang: "en" },
  { value: "magazine", weight: 1.35, lang: "all" },
  { value: "magazine-achtig", weight: 1.3, lang: "nl" },
  { value: "lookbook", weight: 1.25, lang: "all" },
  { value: "journal", weight: 1.25, lang: "en" },
  { value: "longread", weight: 1.35, lang: "all" },
  { value: "merkverhaal", weight: 1.35, lang: "nl" },
  { value: "cover story", weight: 1.3, lang: "en" },
  { value: "hoofdartikel", weight: 1.2, lang: "nl" },
  { value: "portfolio site", weight: 1.15, lang: "all" },
  { value: "curated", weight: 1.4, lang: "en" },
  { value: "curatie", weight: 1.25, lang: "nl" },
  { value: "fotografie portfolio", weight: 0.85, lang: "nl" },
  { value: "fashion", weight: 0.55, lang: "en" },
  { value: "mode", weight: 0.5, lang: "nl" },
  { value: "interieur studio", weight: 0.65, lang: "nl" },
  { value: "interieurstudio", weight: 0.65, lang: "nl" },
  { value: "architectuur", weight: 0.65, lang: "nl" },
  { value: "architecture", weight: 0.65, lang: "en" },
  { value: "gallery", weight: 1.15, lang: "en" },
  { value: "galerie", weight: 1.1, lang: "nl" },
  { value: "exhibition", weight: 1.05, lang: "en" },
  { value: "tentoonstelling", weight: 1.05, lang: "nl" },
  { value: "manifesto", weight: 1.15, lang: "all" },
  { value: "essay", weight: 1.2, lang: "en" },
  { value: "column", weight: 1.05, lang: "en" },
  { value: "blog als merk", weight: 1.25, lang: "nl" },
  { value: "content first", weight: 1.35, lang: "all" },
  { value: "redactioneel", weight: 1.4, lang: "nl" },
  { value: "vintage", weight: 1.85, lang: "all" },
  { value: "retro", weight: 1.65, lang: "all" },
  { value: "klassiek", weight: 1.55, lang: "nl" },
  { value: "classic", weight: 1.5, lang: "en" },
  { value: "old school", weight: 1.7, lang: "en" },
  { value: "old-school", weight: 1.75, lang: "all" },
  { value: "oldschool", weight: 1.65, lang: "all" },
  { value: "warm papier", weight: 1.75, lang: "nl" },
  { value: "warme papierlook", weight: 1.65, lang: "nl" },
  { value: "papierlook", weight: 1.45, lang: "nl" },
  { value: "papierachtig", weight: 1.5, lang: "nl" },
  { value: "aged paper", weight: 1.55, lang: "en" },
  { value: "nostalgisch", weight: 1.5, lang: "nl" },
  { value: "nostalgic", weight: 1.45, lang: "en" },
  { value: "antiek", weight: 1.35, lang: "nl" },
  { value: "antique", weight: 1.35, lang: "en" },
  { value: "barbershop vintage", weight: 1.55, lang: "all" },
  { value: "heritage", weight: 1.45, lang: "en" },
  { value: "erfgoed", weight: 1.35, lang: "nl" },
  { value: "serif koppen", weight: 1.5, lang: "nl" },
  { value: "serif headings", weight: 1.45, lang: "en" },
  { value: "schreef", weight: 1.35, lang: "nl" },
  { value: "typewriter", weight: 1.25, lang: "all" },
];

/** Woordstammen: vintage / klassiek zonder elke verbuiging te hoeven spellen. */
export const REGEX_EDITORIAL_VINTAGE_ROOTS: RegexSignal[] = [
  { re: /\bklassiek\w*\b/giu, weight: 1.15, lang: "nl" },
  { re: /\bvintage\w*\b/giu, weight: 1.2, lang: "all" },
  { re: /\bretro\w*\b/giu, weight: 1.05, lang: "all" },
];

// --- Playful / creative -------------------------------------------------------

export const WEIGHTED_PLAYFUL: WeightedToken[] = [
  { value: "speels", weight: 1.45, lang: "nl" },
  { value: "playful", weight: 1.45, lang: "en" },
  { value: "fun", weight: 1.2, lang: "en" },
  { value: "vrolijk", weight: 1.25, lang: "nl" },
  { value: "kleurrijk", weight: 1.3, lang: "nl" },
  { value: "colorful", weight: 1.25, lang: "en" },
  { value: "illustraties", weight: 1.25, lang: "nl" },
  { value: "illustration", weight: 1.2, lang: "en" },
  { value: "mascotte", weight: 1.15, lang: "nl" },
  { value: "mascot", weight: 1.15, lang: "en" },
  { value: "emoji", weight: 1, lang: "all" },
  { value: "quirky", weight: 1.25, lang: "en" },
  { value: "eigenzinnig", weight: 1.2, lang: "nl" },
  { value: "creatief bureau", weight: 1.2, lang: "nl" },
  { value: "design agency", weight: 1.15, lang: "en" },
  { value: "branding agency", weight: 1.1, lang: "en" },
  { value: "animatie", weight: 1.15, lang: "nl" },
  { value: "motion", weight: 1.1, lang: "en" },
  { value: "kids", weight: 1.2, lang: "en" },
  { value: "kinderen", weight: 1.15, lang: "nl" },
  { value: "friendly brand", weight: 1.2, lang: "en" },
  { value: "warm merk", weight: 1.15, lang: "nl" },
  { value: "videogame", weight: 0.9, lang: "all" },
  { value: "gameplay", weight: 0.85, lang: "en" },
  { value: "gezinssite", weight: 0.45, lang: "nl" },
];

// --- Corporate / formal -------------------------------------------------------

export const WEIGHTED_CORPORATE: WeightedToken[] = [
  { value: "corporate", weight: 1.55, lang: "all" },
  { value: "zakelijk", weight: 1.35, lang: "nl" },
  { value: "formeel", weight: 1.25, lang: "nl" },
  { value: "formal", weight: 1.25, lang: "en" },
  { value: "enterprise", weight: 1.5, lang: "en" },
  { value: "holding", weight: 1.2, lang: "all" },
  { value: "maatschappij", weight: 1.15, lang: "nl" },
  { value: "b2b", weight: 1.35, lang: "all" },
  { value: "compliance", weight: 1.3, lang: "en" },
  { value: "juridisch", weight: 1.2, lang: "nl" },
  { value: "legal", weight: 1.2, lang: "en" },
  { value: "notaris", weight: 1.25, lang: "nl" },
  { value: "advocaat", weight: 1.2, lang: "nl" },
  { value: "accountancy", weight: 1.2, lang: "all" },
  { value: "consultancy", weight: 1.2, lang: "all" },
  { value: "consulting", weight: 1.2, lang: "en" },
  { value: "partner", weight: 0.42, lang: "en" },
  { value: "partners", weight: 0.4, lang: "en" },
  { value: "board", weight: 1.15, lang: "en" },
  { value: "bestuur", weight: 1.1, lang: "nl" },
  { value: "annual report", weight: 1.35, lang: "en" },
  { value: "jaarverslag", weight: 1.35, lang: "nl" },
  { value: "investor", weight: 1.25, lang: "en" },
  { value: "investeerders", weight: 1.2, lang: "nl" },
];

export const REGEX_CORPORATE_SPILLOVER: RegexSignal[] = [
  { re: /\benterprise\s+(software|platform|solution|solutions)\b/giu, weight: 0.55, lang: "en" },
];

// --- Trust / proof ------------------------------------------------------------

export const WEIGHTED_TRUST: WeightedToken[] = [
  { value: "vertrouwen", weight: 1.35, lang: "nl" },
  { value: "trust", weight: 1.2, lang: "en" },
  { value: "betrouwbaar", weight: 1.35, lang: "nl" },
  { value: "betrouwbaarheid", weight: 1.3, lang: "nl" },
  { value: "reviews", weight: 1.15, lang: "en" },
  { value: "review", weight: 0.42, lang: "en" },
  { value: "recensies", weight: 1.1, lang: "nl" },
  { value: "testimonials", weight: 1.45, lang: "en" },
  { value: "ervaringen", weight: 1.2, lang: "nl" },
  { value: "case study", weight: 1.5, lang: "en" },
  { value: "case studies", weight: 1.45, lang: "en" },
  { value: "referenties", weight: 1.25, lang: "nl" },
  { value: "references", weight: 1.2, lang: "en" },
  { value: "keurmerk", weight: 1.3, lang: "nl" },
  { value: "certificaat", weight: 1.2, lang: "nl" },
  { value: "certified", weight: 1.2, lang: "en" },
  { value: "iso", weight: 1.15, lang: "all" },
  { value: "garantie", weight: 1.1, lang: "nl" },
  { value: "warranty", weight: 1.05, lang: "en" },
  { value: "kwaliteit gegarandeerd", weight: 1.25, lang: "nl" },
  { value: "social proof", weight: 1.55, lang: "en" },
  { value: "sterren", weight: 1, lang: "nl" },
  { value: "ratings", weight: 1.1, lang: "en" },
  { value: "trusted by", weight: 1.45, lang: "en" },
  { value: "erkend", weight: 1.15, lang: "nl" },
  { value: "lid van", weight: 1.05, lang: "nl" },
  { value: "aangesloten bij", weight: 1.1, lang: "nl" },
];

// --- Lead / conversion --------------------------------------------------------

export const WEIGHTED_LEAD: WeightedToken[] = [
  { value: "lead", weight: 1.25, lang: "en" },
  { value: "leads", weight: 1.3, lang: "en" },
  { value: "aanvraag", weight: 1.2, lang: "nl" },
  { value: "aanvragen", weight: 1.25, lang: "nl" },
  { value: "offerte", weight: 1.35, lang: "nl" },
  { value: "offertes", weight: 1.3, lang: "nl" },
  { value: "quote", weight: 1.15, lang: "en" },
  { value: "quotes", weight: 1.1, lang: "en" },
  { value: "contact opnemen", weight: 1.35, lang: "nl" },
  { value: "neem contact", weight: 1.25, lang: "nl" },
  { value: "bel ons", weight: 1.2, lang: "nl" },
  { value: "plan gesprek", weight: 1.35, lang: "nl" },
  { value: "boek afspraak", weight: 1.35, lang: "nl" },
  { value: "book a call", weight: 1.35, lang: "en" },
  { value: "schedule", weight: 0.38, lang: "en" },
  { value: "inplannen", weight: 1.15, lang: "nl" },
  { value: "demo", weight: 1.4, lang: "all" },
  { value: "demo aanvragen", weight: 1.5, lang: "nl" },
  { value: "vraag demo", weight: 1.45, lang: "nl" },
  { value: "trial", weight: 1.25, lang: "en" },
  { value: "proefperiode", weight: 1.2, lang: "nl" },
  { value: "gratis proberen", weight: 1.2, lang: "nl" },
  { value: "signup", weight: 1.15, lang: "en" },
  { value: "registreren", weight: 1.1, lang: "nl" },
  { value: "inschrijven", weight: 1.1, lang: "nl" },
  { value: "meer klanten", weight: 1.35, lang: "nl" },
  { value: "acquisitie", weight: 1.2, lang: "nl" },
  { value: "converteren", weight: 1.15, lang: "nl" },
  { value: "conversie", weight: 1.25, lang: "nl" },
  { value: "conversion", weight: 1.2, lang: "en" },
  { value: "cta", weight: 1.3, lang: "all" },
  { value: "call to action", weight: 1.35, lang: "en" },
  { value: "snel beslissen", weight: 1.15, lang: "nl" },
  { value: "direct boeken", weight: 1.25, lang: "nl" },
  { value: "vandaag nog", weight: 1.2, lang: "nl" },
  { value: "inbound", weight: 1.25, lang: "en" },
  { value: "boeking", weight: 1.15, lang: "nl" },
  { value: "boekingen", weight: 1.2, lang: "nl" },
];

export const REGEX_LEAD_STRONG: RegexSignal[] = [
  { re: /\b(schedule|plan)\s+(a\s+)?(call|demo|meeting|afspraak)\b/giu, weight: 1.4, lang: "all" },
  { re: /\bafspraak\s+inplannen\b/giu, weight: 1.35, lang: "nl" },
];

// --- Sales / commerce ---------------------------------------------------------

export const WEIGHTED_SALES: WeightedToken[] = [
  { value: "verkopen", weight: 1.35, lang: "nl" },
  { value: "verkoop", weight: 1.25, lang: "nl" },
  { value: "sales", weight: 1.3, lang: "en" },
  { value: "bestellen", weight: 1.25, lang: "nl" },
  { value: "bestel nu", weight: 1.35, lang: "nl" },
  { value: "koop nu", weight: 1.35, lang: "nl" },
  { value: "shop", weight: 1.2, lang: "en" },
  { value: "webshop", weight: 1.35, lang: "nl" },
  { value: "winkelwagen", weight: 1.3, lang: "nl" },
  { value: "checkout", weight: 1.35, lang: "en" },
  { value: "prijs", weight: 1.1, lang: "nl" },
  { value: "prijzen", weight: 1.15, lang: "nl" },
  { value: "pricing", weight: 1.25, lang: "en" },
  { value: "korting", weight: 1.15, lang: "nl" },
  { value: "sale", weight: 1, lang: "en" },
  { value: "uitverkoop", weight: 1.15, lang: "nl" },
  { value: "voorraad", weight: 1.1, lang: "nl" },
  { value: "sku", weight: 1.25, lang: "en" },
  { value: "producten", weight: 1.15, lang: "nl" },
  { value: "catalogus", weight: 1.2, lang: "nl" },
  { value: "catalog", weight: 1.2, lang: "en" },
  { value: "winkel", weight: 1.1, lang: "nl" },
  { value: "retail", weight: 1.2, lang: "en" },
  { value: "ecommerce", weight: 1.3, lang: "en" },
  { value: "e-commerce", weight: 1.3, lang: "all" },
  { value: "buy now", weight: 1.35, lang: "en" },
  { value: "add to cart", weight: 1.35, lang: "en" },
  { value: "mandje", weight: 1.15, lang: "nl" },
];

// --- Branding / awareness -----------------------------------------------------

export const WEIGHTED_BRANDING: WeightedToken[] = [
  { value: "branding", weight: 1.45, lang: "all" },
  { value: "merk", weight: 1.25, lang: "nl" },
  { value: "merkbeleving", weight: 1.35, lang: "nl" },
  { value: "naamsbekendheid", weight: 1.3, lang: "nl" },
  { value: "awareness", weight: 1.25, lang: "en" },
  { value: "positionering", weight: 1.2, lang: "nl" },
  { value: "reputatie", weight: 1.2, lang: "nl" },
  { value: "image", weight: 1.15, lang: "en" },
  { value: "uitstraling", weight: 1.2, lang: "nl" },
  { value: "sfeer", weight: 1.1, lang: "nl" },
  { value: "identiteit", weight: 1.25, lang: "nl" },
  { value: "brand story", weight: 1.35, lang: "en" },
  { value: "niet verkopen", weight: 1.15, lang: "nl" },
  { value: "geen webshop", weight: 1.2, lang: "nl" },
  { value: "showcase", weight: 1.25, lang: "en" },
  { value: "showreel", weight: 1.2, lang: "en" },
  { value: "portfolio", weight: 1.3, lang: "all" },
  { value: "personal brand", weight: 1.25, lang: "en" },
];

// --- Signup / product ---------------------------------------------------------

export const WEIGHTED_SIGNUP: WeightedToken[] = [
  { value: "aanmelden", weight: 1.25, lang: "nl" },
  { value: "account aanmaken", weight: 1.35, lang: "nl" },
  { value: "registratie", weight: 1.2, lang: "nl" },
  { value: "free trial", weight: 1.35, lang: "en" },
  { value: "freemium", weight: 1.3, lang: "en" },
  { value: "proefaccount", weight: 1.25, lang: "nl" },
  { value: "start gratis", weight: 1.3, lang: "nl" },
  { value: "get started", weight: 1.25, lang: "en" },
  { value: "create account", weight: 1.3, lang: "en" },
  { value: "self-serve", weight: 1.35, lang: "en" },
  { value: "self serve", weight: 1.3, lang: "en" },
  { value: "online tool", weight: 1.15, lang: "en" },
  { value: "inloggen", weight: 1.05, lang: "nl" },
  { value: "login portal", weight: 1.15, lang: "en" },
];

// --- Content / publishing (opgeschoond) -------------------------------------

export const WEIGHTED_CONTENT: WeightedToken[] = [
  { value: "blog", weight: 1.35, lang: "all" },
  { value: "nieuws", weight: 1.2, lang: "nl" },
  { value: "artikelen", weight: 1.25, lang: "nl" },
  { value: "magazine site", weight: 1.2, lang: "nl" },
  { value: "nieuwsbrief content", weight: 1.1, lang: "nl" },
  { value: "podcast", weight: 1.2, lang: "all" },
  { value: "video content", weight: 1.15, lang: "en" },
  { value: "youtube", weight: 1.05, lang: "all" },
  { value: "kennisbank", weight: 1.35, lang: "nl" },
  { value: "wiki", weight: 1.15, lang: "all" },
  { value: "docs", weight: 1.2, lang: "en" },
  { value: "documentation", weight: 1.25, lang: "en" },
  { value: "help center", weight: 1.25, lang: "en" },
  { value: "faq site", weight: 1.15, lang: "en" },
  { value: "media site", weight: 1.1, lang: "en" },
];

// --- Dark / light accents -----------------------------------------------------

export const WEIGHTED_DARK_MODE: WeightedToken[] = [
  { value: "dark mode", weight: 1.45, lang: "en" },
  { value: "darkmode", weight: 1.35, lang: "all" },
  { value: "donker", weight: 1.2, lang: "nl" },
  { value: "donkere", weight: 1.1, lang: "nl" },
  { value: "zwarte achtergrond", weight: 1.3, lang: "nl" },
  { value: "black background", weight: 1.3, lang: "en" },
  { value: "nachtmodus", weight: 1.2, lang: "nl" },
  { value: "low light", weight: 1.15, lang: "en" },
  { value: "cinematic", weight: 1.25, lang: "en" },
  { value: "filmisch", weight: 1.2, lang: "nl" },
];

export const WEIGHTED_LIGHT_SOFT: WeightedToken[] = [
  { value: "licht", weight: 1.05, lang: "nl" },
  { value: "light mode", weight: 1.25, lang: "en" },
  { value: "witte achtergrond", weight: 1.2, lang: "nl" },
  { value: "white background", weight: 1.2, lang: "en" },
  { value: "pastel", weight: 1.2, lang: "all" },
  { value: "zacht", weight: 1.1, lang: "nl" },
  { value: "soft tones", weight: 1.2, lang: "en" },
  { value: "organic", weight: 0.45, lang: "en" },
  { value: "natuurlijk", weight: 0.85, lang: "nl" },
  { value: "wellness", weight: 1.05, lang: "en" },
  { value: "spa gevoel", weight: 1.15, lang: "nl" },
];

// --- Uniqueness ---------------------------------------------------------------

export const WEIGHTED_UNIQUENESS: WeightedToken[] = [
  { value: "geen template", weight: 1.45, lang: "nl" },
  { value: "niet standaard", weight: 1.35, lang: "nl" },
  { value: "niet zo'n standaard", weight: 1.35, lang: "nl" },
  { value: "custom", weight: 1.25, lang: "en" },
  { value: "uniek", weight: 1.35, lang: "nl" },
  { value: "unique", weight: 1.3, lang: "en" },
  { value: "opvallend", weight: 1.2, lang: "nl" },
  { value: "anders dan anderen", weight: 1.3, lang: "nl" },
  { value: "geen saas look", weight: 1.4, lang: "nl" },
  { value: "geen corporate cliché", weight: 1.35, lang: "nl" },
  { value: "niet generiek", weight: 1.3, lang: "nl" },
  { value: "award", weight: 1.15, lang: "en" },
  { value: "award-winning", weight: 1.25, lang: "en" },
  { value: "high end design", weight: 1.35, lang: "en" },
  { value: "bespoke design", weight: 1.4, lang: "en" },
];

// --- Scan behavior ------------------------------------------------------------

export const WEIGHTED_FAST_SCAN: WeightedToken[] = [
  { value: "snel duidelijk", weight: 1.35, lang: "nl" },
  { value: "duidelijk waar klikken", weight: 1.3, lang: "nl" },
  { value: "scanbaar", weight: 1.35, lang: "nl" },
  { value: "scannable", weight: 1.3, lang: "en" },
  { value: "above the fold", weight: 1.25, lang: "en" },
  { value: "boven de fold", weight: 1.2, lang: "nl" },
  { value: "direct zien", weight: 1.2, lang: "nl" },
  { value: "instant", weight: 0.48, lang: "en" },
  { value: "snelle beslissers", weight: 1.25, lang: "nl" },
  { value: "busy professionals", weight: 1.2, lang: "en" },
  { value: "weinig tijd", weight: 1.2, lang: "nl" },
  { value: "one glance", weight: 1.25, lang: "en" },
];

export const WEIGHTED_EXPLORATORY: WeightedToken[] = [
  { value: "verkennen", weight: 1.35, lang: "nl" },
  { value: "explore", weight: 1.3, lang: "en" },
  { value: "rondkijken", weight: 1.25, lang: "nl" },
  { value: "diepgaand", weight: 1.25, lang: "nl" },
  { value: "lezen", weight: 1.15, lang: "nl" },
  { value: "long form", weight: 1.3, lang: "en" },
  { value: "uitgebreid", weight: 1.2, lang: "nl" },
  { value: "magazine feel", weight: 1.35, lang: "en" },
  { value: "lang scrollen", weight: 1.25, lang: "nl" },
  { value: "chapter", weight: 0.4, lang: "en" },
  { value: "hoofdstukken", weight: 1.05, lang: "nl" },
];

// --- B2C / B2B ----------------------------------------------------------------

export const WEIGHTED_B2C: WeightedToken[] = [
  { value: "consument", weight: 1.35, lang: "nl" },
  { value: "consumenten", weight: 1.3, lang: "nl" },
  { value: "particulier", weight: 1.3, lang: "nl" },
  { value: "particulieren", weight: 1.25, lang: "nl" },
  { value: "huishoudens", weight: 1.15, lang: "nl" },
  { value: "gezinnen", weight: 1.1, lang: "nl" },
  { value: "shoppers", weight: 1.2, lang: "en" },
  { value: "fans", weight: 1.05, lang: "en" },
  { value: "community leden", weight: 1.1, lang: "nl" },
];

export const WEIGHTED_B2B: WeightedToken[] = [
  { value: "b2b", weight: 1.4, lang: "all" },
  { value: "bedrijven", weight: 1.25, lang: "nl" },
  { value: "ondernemingen", weight: 1.2, lang: "nl" },
  { value: "beslissers", weight: 1.3, lang: "nl" },
  { value: "procurement", weight: 1.25, lang: "en" },
  { value: "inkoop", weight: 1.2, lang: "nl" },
  { value: "c-level", weight: 1.35, lang: "en" },
  { value: "managers", weight: 1.15, lang: "en" },
  { value: "teams", weight: 0.38, lang: "en" },
  { value: "organisaties", weight: 1.2, lang: "nl" },
];

// --- Industry: canonieke id + zwakke bias (NL-label voor downstream string match)

export const INDUSTRY_HINT_ID_TO_LABEL: Record<string, string> = {
  construction_services: "bouw, installatie en techniek",
  health_wellness: "zorg en welzijn",
  hospitality: "horeca en gastronomie",
  real_estate: "vastgoed en makelaardij",
  software: "tech en software",
  retail: "retail en e-commerce",
  creative: "creatieve sector",
  education: "onderwijs en training",
};

export const WEIGHTED_INDUSTRY_GROUPS: { id: string; tokens: WeightedToken[] }[] = [
  {
    id: "construction_services",
    tokens: [
      { value: "aannemer", weight: 1, lang: "nl" },
      { value: "aannemersbedrijf", weight: 1, lang: "nl" },
      { value: "bouwbedrijf", weight: 1, lang: "nl" },
      { value: "stukadoor", weight: 1, lang: "nl" },
      { value: "schilder", weight: 0.85, lang: "nl" },
      { value: "loodgieter", weight: 1, lang: "nl" },
      { value: "elektricien", weight: 1, lang: "nl" },
      { value: "dakdekker", weight: 1, lang: "nl" },
      { value: "verbouwing", weight: 0.9, lang: "nl" },
      { value: "renovatie", weight: 0.9, lang: "nl" },
    ],
  },
  {
    id: "health_wellness",
    tokens: [
      { value: "tandarts", weight: 1, lang: "nl" },
      { value: "huisarts", weight: 1, lang: "nl" },
      { value: "kliniek", weight: 1, lang: "nl" },
      { value: "therapie", weight: 0.95, lang: "nl" },
      { value: "fysio", weight: 0.95, lang: "nl" },
      { value: "welzijn", weight: 1, lang: "nl" },
      { value: "zorg", weight: 0.85, lang: "nl" },
      { value: "hospice", weight: 1, lang: "nl" },
      { value: "apotheek", weight: 1, lang: "nl" },
    ],
  },
  {
    id: "hospitality",
    tokens: [
      { value: "restaurant", weight: 1, lang: "nl" },
      { value: "café", weight: 1, lang: "nl" },
      { value: "brasserie", weight: 1, lang: "nl" },
      { value: "chef", weight: 0.9, lang: "all" },
      { value: "menu", weight: 0.75, lang: "all" },
      { value: "horeca", weight: 1.1, lang: "nl" },
      { value: "bar", weight: 0.7, lang: "all" },
      { value: "sommelier", weight: 1, lang: "all" },
      { value: "winery", weight: 1, lang: "en" },
      { value: "brouwerij", weight: 1, lang: "nl" },
    ],
  },
  {
    id: "real_estate",
    tokens: [
      { value: "makelaar", weight: 1.1, lang: "nl" },
      { value: "makelaardij", weight: 1.1, lang: "nl" },
      { value: "vastgoed", weight: 1.15, lang: "nl" },
      { value: "woningmarkt", weight: 0.95, lang: "nl" },
      { value: "hypotheek", weight: 0.95, lang: "nl" },
      { value: "real estate", weight: 1.1, lang: "en" },
    ],
  },
  {
    id: "software",
    tokens: [
      { value: "saas", weight: 1.1, lang: "all" },
      { value: "softwarebedrijf", weight: 1.05, lang: "nl" },
      { value: "startup tech", weight: 0.95, lang: "nl" },
      { value: "scale-up", weight: 0.95, lang: "nl" },
      { value: "ict-bedrijf", weight: 1, lang: "nl" },
      { value: "hosting", weight: 0.85, lang: "all" },
    ],
  },
  {
    id: "retail",
    tokens: [
      { value: "webshop", weight: 1.1, lang: "nl" },
      { value: "winkelketen", weight: 1, lang: "nl" },
      { value: "retail", weight: 1, lang: "en" },
      { value: "webwinkel", weight: 1.05, lang: "nl" },
      { value: "web store", weight: 1, lang: "en" },
      { value: "dropship", weight: 1, lang: "en" },
    ],
  },
  {
    id: "creative",
    tokens: [
      { value: "fotograaf", weight: 1, lang: "nl" },
      { value: "ontwerpbureau", weight: 1.05, lang: "nl" },
      { value: "reclamebureau", weight: 1, lang: "nl" },
      { value: "designstudio", weight: 0.95, lang: "nl" },
      { value: "artiest", weight: 0.95, lang: "nl" },
      { value: "muzikant", weight: 0.9, lang: "nl" },
    ],
  },
  {
    id: "education",
    tokens: [
      { value: "cursus", weight: 1, lang: "nl" },
      { value: "training", weight: 1, lang: "all" },
      { value: "coach", weight: 0.85, lang: "all" },
      { value: "academy", weight: 1.05, lang: "en" },
      { value: "opleiding", weight: 1, lang: "nl" },
      { value: "e-learning", weight: 1.05, lang: "all" },
    ],
  },
];

// --- Phrase patterns (intent-clusters; geen glob lastIndex) --------------------

export const PHRASE_PATTERNS: { re: RegExp; label: string }[] = [
  { re: /\bmeer\s+(aanvragen|offertes|klanten|leads)\b/i, label: "strong_lead_goal" },
  { re: /\bmeer\s+inbound\s+leads\b/i, label: "strong_lead_goal" },
  { re: /\bmeer\s+(offerteaanvragen|contactaanvragen|boekingen|demo'?s|demos)\b/i, label: "strong_lead_goal" },
  { re: /\bmeer\s+aanvragen\s+(via|door)\s+de\s+site\b/i, label: "strong_lead_goal" },
  { re: /\bvertrouwen\s+(uitstralen|geven|opwekken)\b/i, label: "strong_trust" },
  { re: /\b(niet|geen)\s+te\s+druk\b/i, label: "restraint_high" },
  { re: /\bmodern\s+en\s+rustig\b/i, label: "minimal_calm" },
  { re: /\bpremium\s+en\s+strak\b/i, label: "luxury_minimal" },
  { re: /\bgeen\s+standaard\s+template\b/i, label: "unique_high" },
  { re: /\bgeen\s+poespas\b/i, label: "restraint_high" },
  { re: /\bduidelijk\s+waar\s+(je\s+)?moet\s+klikken\b/i, label: "fast_scan" },
  { re: /\bfor\s+sale\b|\bte\s+koop\b/i, label: "sales_strong" },
  { re: /\bbook\s+(now|today)\b|\bvandaag\s+nog\b/i, label: "cta_high" },
  { re: /\bhigh[\s-]?end\b|\bhigh end\b/i, label: "luxury_phrase" },
  { re: /\bbrand\s+awareness\b|\bnaamsbekendheid\b/i, label: "branding_goal" },
  { re: /\bcontent\s*hub\b|\bkennishub\b/i, label: "content_business" },
  { re: /\bshop\s+and\s+blog\b|\bwinkel\s+en\s+blog\b/i, label: "hybrid_commerce" },
  { re: /\bserious\s+and\s+professional\b|\bserieus\s+en\s+zakelijk\b/i, label: "corporate_tone" },
  { re: /\bwarm\s+en\s+persoonlijk\b/i, label: "friendly_warm" },
  {
    re: /\bklassiek\w*\s+vintage\b|\bvintage\s*,\s*warm\b|\bwarm\w*\s+papier\w*\b|\bold[\s-]?school\b|\bretro\s+typo\w*\b/i,
    label: "vintage_editorial",
  },
];

/** Tegenstellingen / nuance — vaak rijker dan losse keywords. */
export const CONTRAST_PATTERNS: { re: RegExp; effects: string[] }[] = [
  { re: /\bniet\s+te\s+speels\b|\bnot\s+too\s+playful\b/i, effects: ["playful_down", "trust_up"] },
  { re: /\bspeels\s+maar\s+wel\s+warm\b|\bplayful\s+but\s+warm\b/i, effects: ["playful_mild", "warm_bias"] },
  { re: /\bstrak\s+maar\s+niet\s+kil\b|\bclean\s+but\s+not\s+cold\b/i, effects: ["minimal_up", "warm_bias"] },
  { re: /\bluxe\s+maar\s+toegankelijk\b|\bluxury\s+but\s+accessible\b/i, effects: ["luxury_up", "playful_down"] },
  { re: /\bmodern\s+maar\s+betrouwbaar\b|\bmodern\s+but\s+trustworthy\b/i, effects: ["tech_soft", "trust_up"] },
  { re: /\bminimalistisch\s+zonder\s+saa(i)?\b|\bminimal\s+without\s+being\s+boring\b/i, effects: ["minimal_up", "playful_mild"] },
  { re: /\bprofessioneel\s+maar\s+niet\s+corporate\b|\bprofessional\s+but\s+not\s+corporate\b/i, effects: ["corporate_soft", "trust_up"] },
  { re: /\bniet\s+te\s+luxe\b|\bgeen\s+high[\s-]?end\s+gedoe\b|\bnot\s+too\s+luxury\b/i, effects: ["luxury_down"] },
  { re: /\bmag\s+best\s+premium\b|\bkan\s+wel\s+premium\b/i, effects: ["luxury_mild"] },
];

/** Negatie / afzwakking (breedere varianten). */
export const NEGATION_PATTERNS: { re: RegExp; effect: string }[] = [
  { re: /\bniet\s+luxe\b|\bgeen\s+luxe\b|\bnot\s+luxury\b/i, effect: "down_luxury" },
  { re: /\b(hoeft\s+niet|niet)\s+luxe\b|\bdoesn'?t\s+need\s+to\s+be\s+luxury\b/i, effect: "down_luxury" },
  { re: /\bniet\s+overdreven\s+luxe\b|\bgeen\s+overdreven\s+luxe\b/i, effect: "down_luxury" },
  { re: /\bniet\s+te\s+luxe\b|\bnot\s+too\s+luxe\b/i, effect: "down_luxury_soft" },
  { re: /\bgeen\s+high[\s-]?end\b|\bgeen\s+chic\b|\bno\s+high[\s-]?end\b/i, effect: "down_luxury" },
  { re: /\bniet\s+speels\b|\bgeen\s+kinders\b|\bnot\s+playful\b/i, effect: "down_playful" },
  { re: /\bniet\s+klinisch\b|\bnot\s+clinical\b/i, effect: "warm_bias" },
  { re: /\bniet\s+te\s+zwart\b|\bgeen\s+donkere\b|\bno\s+pure\s+black\b/i, effect: "down_dark" },
];

// --- Legacy platte exportnamen (tests / dashboards) ---------------------------
/** @deprecated Gebruik WEIGHTED_LUXURY + REGEX_LUXURY_ROOTS */
export const TOKENS_LUXURY_REFINEMENT: string[] = WEIGHTED_LUXURY.map((x) => x.value);
/** @deprecated Gebruik WEIGHTED_* */
export const TOKENS_MINIMAL_CLEAN: string[] = WEIGHTED_MINIMAL.map((x) => x.value);
export const TOKENS_TECH_SAAS: string[] = WEIGHTED_TECH.map((x) => x.value);
export const TOKENS_INDUSTRIAL_BOLD: string[] = WEIGHTED_INDUSTRIAL.map((x) => x.value);
export const TOKENS_EDITORIAL_MAGAZINE: string[] = WEIGHTED_EDITORIAL.map((x) => x.value);
export const TOKENS_PLAYFUL_CREATIVE: string[] = WEIGHTED_PLAYFUL.map((x) => x.value);
export const TOKENS_CORPORATE_FORMAL: string[] = WEIGHTED_CORPORATE.map((x) => x.value);
export const TOKENS_TRUST_PROOF: string[] = WEIGHTED_TRUST.map((x) => x.value);
export const TOKENS_LEAD_CONVERSION: string[] = WEIGHTED_LEAD.map((x) => x.value);
export const TOKENS_SALES_COMMERCE: string[] = WEIGHTED_SALES.map((x) => x.value);
export const TOKENS_BRANDING_AWARENESS: string[] = WEIGHTED_BRANDING.map((x) => x.value);
export const TOKENS_SIGNUP_PRODUCT: string[] = WEIGHTED_SIGNUP.map((x) => x.value);
export const TOKENS_CONTENT_BLOG: string[] = WEIGHTED_CONTENT.map((x) => x.value);
export const TOKENS_DARK_MODE: string[] = WEIGHTED_DARK_MODE.map((x) => x.value);
export const TOKENS_LIGHT_SOFT: string[] = WEIGHTED_LIGHT_SOFT.map((x) => x.value);
export const TOKENS_UNIQUENESS_ANTI_TEMPLATE: string[] = WEIGHTED_UNIQUENESS.map((x) => x.value);
export const TOKENS_FAST_SCAN: string[] = WEIGHTED_FAST_SCAN.map((x) => x.value);
export const TOKENS_EXPLORATORY: string[] = WEIGHTED_EXPLORATORY.map((x) => x.value);
export const TOKENS_B2C_CONSUMER: string[] = WEIGHTED_B2C.map((x) => x.value);
export const TOKENS_B2B_PRO: string[] = WEIGHTED_B2B.map((x) => x.value);

/** @deprecated Gebruik WEIGHTED_INDUSTRY_GROUPS + INDUSTRY_HINT_ID_TO_LABEL */
export const TOKENS_INDUSTRY_HINTS: { hint: string; tokens: string[] }[] =
  WEIGHTED_INDUSTRY_GROUPS.map((g) => ({
    hint: INDUSTRY_HINT_ID_TO_LABEL[g.id] ?? g.id,
    tokens: g.tokens.map((t) => t.value),
  }));

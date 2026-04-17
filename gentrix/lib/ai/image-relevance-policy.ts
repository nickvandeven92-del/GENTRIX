/**
 * Deterministische beeld-relevantie voor Unsplash-postprocessing.
 * Los van layout/JSON van de generator — alleen ranking/filter op API-resultaten.
 */

import type { DesignGenerationContract } from "@/lib/ai/design-generation-contract";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type UnsplashPageIntent = "home" | "contact" | "marketing";

/** Herkenbare niche-bundle (data-gedreven, uitbreidbaar). */
export type NicheBundleId = "mature_retail_ambient" | "fishing_angling_retail" | "barbershop" | null;

export type NicheDomainBundle = {
  id: NonNullable<NicheBundleId>;
  /** Miniatuur-triggers in briefing/contract-tekst (lowercase substring). */
  triggers: string[];
  /** Sterke domeinsignalen in stock-metadata (substring, lowercase). */
  anchorTerms: string[];
  /** Altijd afkeuren op kandidaat-tekst (substring). */
  forbiddenTerms: string[];
  /** Zwakke context (+score), kan misleiden — niet als enige gate. */
  weakContextTerms: string[];
  /** Vervangt/verruimt sectie-gates voor deze bucket (alleen gezet buckets). */
  sectionOverrides?: Partial<
    Record<"hero" | "product_grid" | "about" | "gallery" | "contact" | "default", Partial<Pick<SectionGateRule, "mustHaveOneOf" | "avoid">>>
  >;
};

export type SectionGateRule = {
  /** Sectie-bucket (afgeleid van id/naam). */
  bucket: string;
  /** Minstens één substring-match op kandidaat-tekst. */
  mustHaveOneOf: string[];
  avoid: string[];
};

export type ImageRelevanceEvaluation = {
  score: number;
  forbiddenHit: boolean;
  matchedForbidden: string[];
  passedDomainGate: boolean;
  matchedDomainAnchors: string[];
  passedSectionGate: boolean;
  matchedSectionMust: string[];
  matchedSectionAvoid: string[];
  matchedWeak: string[];
  matchedContractMust: string[];
  reasons: string[];
};

// ---------------------------------------------------------------------------
// Data — niche + sectie (uitbreidbaar zonder generator-prompts te wijzigen)
// ---------------------------------------------------------------------------

const NICHE_BUNDLES: NicheDomainBundle[] = [
  {
    id: "mature_retail_ambient",
    triggers: [
      "erotische artikelen",
      "erotische webshop",
      "webshop in erotische",
      "seksshop",
      "sexshop",
      "sex shop",
      "adult shop",
      "adult novelty",
      "erotiekshop",
      "de wallen",
      "wallen amsterdam",
      "wallen in amsterdam",
      "red light district",
      "lingerie webshop",
      "intimate wellness",
      "bdsm shop",
    ],
    anchorTerms: [
      "neon",
      "neon sign",
      "nightlife",
      "night club",
      "velvet",
      "silk",
      "satin",
      "fabric texture",
      "candle",
      "candlelight",
      "moody",
      "dark interior",
      "luxury hotel",
      "hotel corridor",
      "boutique",
      "urban night",
      "city lights",
      "night city",
      "night street",
      "lingerie",
      "noir",
      "rose petals",
      "champagne",
      "night portrait",
      "shadow portrait",
    ],
    forbiddenTerms: [
      "toddler",
      "child playing",
      "children",
      "kids room",
      "kids toys",
      "kid toy",
      "kindergarten",
      "nursery",
      "playground",
      "schoolyard",
      "classroom",
      "baby",
      "infant",
      "newborn",
      "wooden blocks",
      "building blocks",
      "toy blocks",
      "lego",
      "stuffed animal",
      "plush toy",
      "toy car",
      "baby toy",
      "family with kids",
      "little boy",
      "little girl",
      "sock monkey",
      "scuba",
    ],
    weakContextTerms: ["playroom", "birthday party", "crib"],
    sectionOverrides: {
      hero: {
        mustHaveOneOf: [
          "neon",
          "night",
          "nightlife",
          "velvet",
          "silk",
          "satin",
          "fabric",
          "candle",
          "moody",
          "boutique",
          "hotel",
          "city lights",
          "urban",
          "lingerie",
          "noir",
          "shadow",
          "dark interior",
          "luxury",
          "sign",
          "glow",
          "street night",
        ],
        avoid: ["playground", "classroom", "kindergarten"],
      },
    },
  },
  {
    id: "fishing_angling_retail",
    triggers: [
      "hengel",
      "hengelsport",
      "hengelsportwinkel",
      "viswinkel",
      "visartikel",
      "visartikelen",
      "visser",
      "vissen",
      "kunstaas",
      "spinmolen",
      "molen",
      "karper",
      "forel",
      "snoek",
      "baars",
      "vliegvis",
      "tackle",
      "fishing shop",
      "fishing tackle",
      "fishing gear",
      "angling",
      "fishing rod",
      "fly fishing",
      "bait shop",
      "fish shop",
    ],
    anchorTerms: [
      "fishing",
      "angler",
      "angling",
      "fishing rod",
      "fly rod",
      "spinning",
      "reel",
      "fishing reel",
      "tackle",
      "lure",
      "lures",
      "bait",
      "hook",
      "hooks",
      "fishing line",
      "wader",
      "waders",
      "fishing boat",
      "fishing net",
      "fishing shop",
      "tackle shop",
      "fly fishing",
      "hengel",
      "kunstaas",
      "visser",
      "vissen",
      "karper",
      "forel",
    ],
    forbiddenTerms: [
      "scuba",
      "scuba diving",
      "snorkel",
      "snorkeling",
      "underwater diver",
      "diving suit",
      "coral reef diving",
      "deep dive",
      "skydiving",
      "bungee",
      // "Industrieel" in de briefing wordt vaak verkeerd gelezen als zware industrie i.p.v. ruwe tackle/boot.
      "gantry crane",
      "port crane",
      "container crane",
      "shipping crane",
      "construction crane",
      "excavator",
      "bulldozer",
      "steel mill",
      "oil refinery",
      "chemical plant",
      "smokestack",
      "mountain summit",
      "snow-capped peaks",
      "snow capped mountain",
      "alpine hiking",
      "ski resort",
    ],
    weakContextTerms: [
      "lake",
      "river",
      "ocean",
      "water",
      "dock",
      "pier",
      "boat",
      "sunset",
      "nature",
      "landscape",
    ],
  },
  {
    id: "barbershop",
    triggers: [
      "barber",
      "barbershop",
      "herenkapper",
      "mens haircut",
      "fade haircut",
      "beard trim",
    ],
    anchorTerms: [
      "barber",
      "barbershop",
      "haircut",
      "clippers",
      "barber chair",
      "barber pole",
      "beard",
      "mustache",
      "fade",
      "herenkapper",
      "kappersstoel",
    ],
    forbiddenTerms: [
      "womens salon",
      "nail salon",
      "manicure",
      "pedicure",
      "spa facial",
    ],
    weakContextTerms: ["mirror", "salon", "scissors", "comb"],
  },
];

const SECTION_RULES: SectionGateRule[] = [
  {
    bucket: "hero",
    mustHaveOneOf: [
      "fishing",
      "angler",
      "angling",
      "rod",
      "reel",
      "tackle",
      "lure",
      "bait",
      "shop",
      "store",
      "retail",
      "winkel",
      "barber",
      "haircut",
      "beard",
      "interior",
      "workspace",
    ],
    avoid: ["underwater", "scuba", "coral reef", "abstract gradient"],
  },
  {
    bucket: "product_grid",
    mustHaveOneOf: [
      "rod",
      "reel",
      "lure",
      "tackle",
      "bait",
      "fishing",
      "product",
      "retail",
      "shelf",
      "display",
      "electronics",
      "device",
      "package",
    ],
    avoid: ["underwater", "wildlife only", "empty beach"],
  },
  {
    bucket: "about",
    mustHaveOneOf: [
      "team",
      "people",
      "workshop",
      "interior",
      "store",
      "shop",
      "craft",
      "workspace",
      "office",
      "fishing",
      "barber",
    ],
    avoid: ["random stock", "unrelated"],
  },
  {
    bucket: "gallery",
    mustHaveOneOf: [
      "fishing",
      "rod",
      "reel",
      "lure",
      "tackle",
      "hair",
      "salon",
      "interior",
      "product",
      "photo",
    ],
    avoid: ["underwater diver"],
  },
  {
    bucket: "default",
    mustHaveOneOf: [],
    avoid: [],
  },
];

const WEIGHTS = {
  domainAnchor: 5,
  contractMust: 6,
  sectionMust: 4,
  weakContext: 1,
  sectionAvoid: 5,
  nicheForbidden: 8,
  contractAvoid: 8,
} as const;

// ---------------------------------------------------------------------------
// Resolvers
// ---------------------------------------------------------------------------

function norm(s: string): string {
  return s.toLowerCase();
}

function haystackForCandidate(alt: string | null | undefined, description?: string | null): string {
  return norm([alt ?? "", description ?? ""].filter(Boolean).join(" \n "));
}

function collectMatches(haystack: string, terms: string[]): string[] {
  const out: string[] = [];
  for (const t of terms) {
    const n = norm(t);
    if (n.length < 2) continue;
    if (haystack.includes(n)) out.push(t);
  }
  return out;
}

function tokenizeContractPhrases(phrases: string[]): string[] {
  const tokens = new Set<string>();
  for (const p of phrases) {
    const parts = p
      .split(/[,;./|]+/g)
      .flatMap((x) => x.split(/\s+/g))
      .map((w) => w.replace(/[^\wÀ-ÿ-]/g, "").trim())
      .filter((w) => w.length >= 3);
    for (const w of parts) tokens.add(w);
  }
  return [...tokens].map((t) => t.toLowerCase());
}

export function detectNicheBundle(themeContext: string): NicheBundleId {
  const h = norm(themeContext);
  for (const b of NICHE_BUNDLES) {
    if (b.triggers.some((t) => h.includes(norm(t)))) return b.id;
  }
  return null;
}

export function inferSectionBucket(sectionId: string, sectionName: string): string {
  const s = `${sectionId} ${sectionName}`.toLowerCase();
  if (/\bhero\b|^top[-_]|[-_]top\b/.test(s)) return "hero";
  if (/\bshop\b|product|winkel|catalog|collectie|assortiment/.test(s)) return "product_grid";
  if (/about|over[-_\s]?ons|story|team|ons[-_\s]?verhaal/.test(s)) return "about";
  if (/gallery|portfolio|gallerij|impressie|foto/.test(s)) return "gallery";
  if (/contact|locatie|bezoek|route|cta[-_]banner/.test(s)) return "contact";
  return "default";
}

function sectionRuleForBucket(bucket: string): SectionGateRule {
  return SECTION_RULES.find((r) => r.bucket === bucket) ?? SECTION_RULES.find((r) => r.bucket === "default")!;
}

function effectiveSectionRule(bucket: string, bundle: NicheDomainBundle | null): SectionGateRule {
  const base = sectionRuleForBucket(bucket);
  const ov = bundle?.sectionOverrides?.[bucket as keyof NonNullable<NicheDomainBundle["sectionOverrides"]>];
  if (!ov) return base;
  const must = ov.mustHaveOneOf && ov.mustHaveOneOf.length > 0 ? ov.mustHaveOneOf : base.mustHaveOneOf;
  const avoid = [...base.avoid, ...(ov.avoid ?? [])];
  return { bucket: base.bucket, mustHaveOneOf: must, avoid };
}

export function buildContractAvoidList(contract: DesignGenerationContract | null | undefined): string[] {
  const base = contract?.imageryAvoid?.length
    ? contract.imageryAvoid.filter((x) => x.trim().length > 1)
    : [];
  const sig = contract?.siteSignature?.anti_templates_nl?.length
    ? contract.siteSignature.anti_templates_nl.filter((x) => x.trim().length > 1)
    : [];
  return [...base, ...sig];
}

export function buildContractMustTokens(contract: DesignGenerationContract | null | undefined): string[] {
  if (!contract?.imageryMustReflect?.length) return [];
  return tokenizeContractPhrases(contract.imageryMustReflect);
}

function nicheBundleById(id: NicheBundleId): NicheDomainBundle | null {
  if (!id) return null;
  return NICHE_BUNDLES.find((b) => b.id === id) ?? null;
}

// ---------------------------------------------------------------------------
// Evaluatie (pure)
// ---------------------------------------------------------------------------

export function evaluateUnsplashCandidate(
  altDescription: string | null | undefined,
  description: string | null | undefined,
  options: {
    niche: NicheDomainBundle | null;
    nicheActive: boolean;
    pageIntent: UnsplashPageIntent;
    sectionBucket: string;
    contractAvoid: string[];
    contractMustTokens: string[];
  },
): ImageRelevanceEvaluation {
  const haystack = haystackForCandidate(altDescription, description);
  const reasons: string[] = [];
  let score = 0;

  const bundle = options.niche;
  const domainAnchors = bundle?.anchorTerms ?? [];
  const nicheForbidden = bundle?.forbiddenTerms ?? [];
  const weakTerms = bundle?.weakContextTerms ?? [];

  const matchedContractMust = collectMatches(haystack, options.contractMustTokens);
  const matchedDomainAnchors = collectMatches(haystack, domainAnchors);
  const matchedWeak = collectMatches(haystack, weakTerms);

  const matchedForbiddenNiche = collectMatches(haystack, nicheForbidden);
  const matchedForbiddenContract = collectMatches(haystack, options.contractAvoid.map(norm));
  const matchedForbidden = [...matchedForbiddenNiche, ...matchedForbiddenContract];
  const forbiddenHit = matchedForbidden.length > 0;

  if (forbiddenHit) {
    score -= WEIGHTS.nicheForbidden * matchedForbiddenNiche.length;
    score -= WEIGHTS.contractAvoid * matchedForbiddenContract.length;
    reasons.push(`forbidden:${matchedForbidden.join(",")}`);
  }

  for (const t of matchedDomainAnchors) {
    score += WEIGHTS.domainAnchor;
    reasons.push(`domain:${t}`);
  }
  for (const t of matchedContractMust) {
    score += WEIGHTS.contractMust;
    reasons.push(`contract_must:${t}`);
  }
  for (const t of matchedWeak) {
    score += WEIGHTS.weakContext;
    reasons.push(`weak:${t}`);
  }

  const rule = effectiveSectionRule(options.sectionBucket, options.niche);
  const matchedSectionMust =
    rule.mustHaveOneOf.length > 0 ? collectMatches(haystack, rule.mustHaveOneOf) : [];
  const matchedSectionAvoid = collectMatches(haystack, rule.avoid);

  for (const t of matchedSectionAvoid) {
    score -= WEIGHTS.sectionAvoid;
    reasons.push(`section_avoid:${t}`);
  }
  for (const t of matchedSectionMust) {
    score += WEIGHTS.sectionMust;
    reasons.push(`section_must:${t}`);
  }

  const passedDomainGate =
    !options.nicheActive || options.pageIntent === "contact"
      ? true
      : matchedDomainAnchors.length > 0 || matchedContractMust.length > 0;

  const passedSectionGate =
    options.pageIntent === "contact" || rule.mustHaveOneOf.length === 0
      ? true
      : matchedSectionMust.length > 0;

  return {
    score,
    forbiddenHit,
    matchedForbidden,
    passedDomainGate,
    matchedDomainAnchors,
    passedSectionGate,
    matchedSectionMust,
    matchedSectionAvoid,
    matchedWeak,
    matchedContractMust,
    reasons,
  };
}

/** Minimale vorm van Unsplash search hit — past bij `unsplash-image-replace`. */
export type UnsplashSearchHit = {
  urls: { regular: string; small?: string; raw?: string };
  alt_description: string | null;
  description?: string | null;
};

export type PickUnsplashRelevanceParams = {
  themeContext: string;
  sectionId: string;
  sectionName: string;
  pageIntent: UnsplashPageIntent;
  designContract?: DesignGenerationContract | null;
  /** Rotatie binnen dezelfde query (dedup door generator). */
  pickOffset: number;
};

/**
 * Kiest de beste Unsplash-hit: eerst forbidden eruit, dan domain+sectie-gates (bij niche),
 * dan sorteren op score. Fallbacks loggen we alleen bij debug-flag.
 */
export function pickBestUnsplashResult(
  results: UnsplashSearchHit[],
  params: PickUnsplashRelevanceParams,
): { photo: UnsplashSearchHit; evaluation: ImageRelevanceEvaluation; gateFallback: boolean } | null {
  if (results.length === 0) return null;

  const nicheId = detectNicheBundle(params.themeContext);
  const niche = nicheBundleById(nicheId);
  const nicheActive = niche != null;

  const contractAvoid = buildContractAvoidList(params.designContract);
  const contractMustTokens = buildContractMustTokens(params.designContract);

  const sectionBucket = inferSectionBucket(params.sectionId, params.sectionName);

  const rows = results.map((photo, idx) => ({
    photo,
    idx,
    evaluation: evaluateUnsplashCandidate(photo.alt_description, photo.description ?? null, {
      niche,
      nicheActive,
      pageIntent: params.pageIntent,
      sectionBucket,
      contractAvoid,
      contractMustTokens,
    }),
  }));

  let pool = rows.filter((r) => !r.evaluation.forbiddenHit);
  let usedForbiddenFallback = false;
  if (pool.length === 0) {
    pool = rows;
    usedForbiddenFallback = true;
  }

  let gateFallback = usedForbiddenFallback;
  let gated = pool;

  if (nicheActive && params.pageIntent !== "contact") {
    const strict = pool.filter((r) => r.evaluation.passedDomainGate && r.evaluation.passedSectionGate);
    if (strict.length > 0) {
      gated = strict;
    } else {
      const partial = pool.filter(
        (r) => r.evaluation.passedDomainGate || r.evaluation.passedSectionGate,
      );
      if (partial.length > 0) {
        gated = partial;
        gateFallback = true;
      } else {
        gated = pool;
        gateFallback = true;
      }
    }
  }

  gated.sort((a, b) => {
    if (b.evaluation.score !== a.evaluation.score) return b.evaluation.score - a.evaluation.score;
    return a.idx - b.idx;
  });

  const mod = ((params.pickOffset % gated.length) + gated.length) % gated.length;
  const chosen = gated[mod]!;

  if (process.env.UNSPLASH_RELEVANCE_DEBUG === "1") {
    console.log("[unsplash-relevance]", {
      sectionBucket,
      nicheActive,
      nicheId,
      gateFallback,
      score: chosen.evaluation.score,
      reasons: chosen.evaluation.reasons.slice(0, 12),
      passedDomain: chosen.evaluation.passedDomainGate,
      passedSection: chosen.evaluation.passedSectionGate,
    });
  } else if (gateFallback && nicheActive) {
    console.warn(
      `[unsplash-relevance] Gate fallback (${nicheId}) section=${sectionBucket} — geen perfecte match in API-set.`,
    );
  }

  return { photo: chosen.photo, evaluation: chosen.evaluation, gateFallback };
}

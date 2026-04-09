import { getEffectiveHeroExpression } from "@/lib/ai/above-fold-archetypes";
import {
  isCinematicMultimediaBriefing,
  isImmersiveDestinationBriefing,
} from "@/lib/ai/build-cinematic-multimedia-prompt-block";
import type { PageCompositionBias } from "@/lib/ai/page-composition-bias";
import type { DensityProfile, SiteExperienceModel, SiteIntent } from "@/lib/ai/site-experience-model";
import {
  PAGE_COMPOSITION_ARCHETYPE_VALUES,
  type CompositionPlan,
  type PageCompositionArchetype,
  finalizeCompositionPlan,
  getDefaultLayoutDNAForArchetype,
} from "@/lib/ai/composition-plan-model";
import { enrichBriefZonesToRich } from "@/lib/ai/composition-zone-enrich";

/** Harde bovengrens marketing-secties in `_site_config.sections` (hero + body + footer). */
export const MAX_SITE_CONFIG_SECTIONS = 5;

export {
  PAGE_COMPOSITION_ARCHETYPE_VALUES,
  getCompositionPlanMetrics,
  getZoneContrast,
  validateCompositionPlan,
  repairCompositionPlan,
  finalizeCompositionPlan,
  setZoneWidthMode,
  setZoneAlignment,
  swapZonePreferredPattern,
  getDefaultLayoutDNAForArchetype,
} from "@/lib/ai/composition-plan-model";
export type {
  CompositionPlan,
  PageCompositionArchetype,
  RichCompositionZone,
  PatternFamily,
  ZonePattern,
  CompositionQualityReport,
  CompositionIssue,
  CompositionPlanMetrics,
  ZoneContrastVector,
  LayoutDNA,
} from "@/lib/ai/composition-plan-model";

export type HomepagePlan = {
  experienceModel: SiteExperienceModel;
  /** Gespiegeld uit intent — handig voor validators / scoring. */
  densityProfile: DensityProfile;
  /** Macro-compositie + zones; bepaalt onder meer layout-archetype-pools vóór sectie-mapping. */
  compositionPlan: CompositionPlan;
  navigationModel: {
    hasUtilityBar: boolean;
    hasPromoBar: boolean;
    hasSearch: boolean;
    searchPriority: "none" | "medium" | "high";
    menuStyle: "simple" | "multi_category" | "portal";
  };
  sectionSequence: Array<{
    id: string;
    type: string;
    purpose: string;
    priority: "primary" | "secondary" | "supporting";
    density: "low" | "medium" | "high";
  }>;
  trustModel: {
    style: SiteIntent["trustStyle"];
    positions: ("hero" | "features" | "footer" | "sticky")[];
  };
  rhythm: {
    band1: "spacious" | "compact" | "medium";
    band2: "spacious" | "compact" | "medium";
    band3: "spacious" | "compact" | "medium";
    band4: "spacious" | "compact" | "medium";
    band5: "spacious" | "compact" | "medium";
  };
};

function refineSectionSequenceForRhythm(
  seq: HomepagePlan["sectionSequence"],
  rhythm: PageCompositionBias["rhythmBias"],
): HomepagePlan["sectionSequence"] {
  const out = seq.map((r) => ({ ...r }));
  const moveById = (id: string, delta: number) => {
    const i = out.findIndex((s) => s.id === id);
    if (i < 0) return;
    const j = Math.max(0, Math.min(out.length - 1, i + delta));
    if (i === j) return;
    const [row] = out.splice(i, 1);
    out.splice(j, 0, row);
  };

  if (rhythm.mode === "tight_conversion") {
    for (const id of ["proof-strip", "trust-local", "trust-bar", "evidence"]) {
      moveById(id, -1);
    }
    for (const id of ["pricing", "cta", "join", "newsletter"]) {
      moveById(id, -1);
    }
  }

  if (rhythm.mode === "immersive_showcase") {
    for (const id of ["features", "services", "category-grid", "highlights"]) {
      moveById(id, 1);
    }
  }

  if (rhythm.mode === "editorial_breathing") {
    const tp = out.findIndex((s) => s.id.includes("testimonial") || s.id === "member-proof");
    const pr = out.findIndex((s) => s.id.includes("pricing"));
    if (tp >= 0 && pr === tp + 1) {
      moveById(out[pr]!.id, 1);
    }
  }

  if (rhythm.discourageEarlyPricing) {
    const pr = out.findIndex((s) => s.id.includes("pricing"));
    if (pr >= 0 && pr < 4) {
      moveById(out[pr]!.id, 1);
    }
  }

  return out;
}

/**
 * Tweede lichte pass: `experienceModel` + effectieve hero-expression (karakter) duwen sectievolgorde subtiel bij.
 * Alleen na `rhythmBias` — geen aparte parallelle resolver.
 */
function refineSectionSequenceForHeroCharacter(
  seq: HomepagePlan["sectionSequence"],
  intent: SiteIntent,
): HomepagePlan["sectionSequence"] {
  const out = seq.map((r) => ({ ...r }));
  const model = intent.experienceModel;
  const expr = getEffectiveHeroExpression(intent);
  const moveById = (id: string, delta: number) => {
    const i = out.findIndex((s) => s.id === id);
    if (i < 0) return;
    const j = Math.max(0, Math.min(out.length - 1, i + delta));
    if (i === j) return;
    const [row] = out.splice(i, 1);
    out.splice(j, 0, row);
  };

  const premiumEditorial =
    model === "premium_product" ||
    model === "brand_storytelling" ||
    model === "editorial_content_hub" ||
    expr === "editorial_calm" ||
    expr === "minimal_typographic";

  if (premiumEditorial) {
    const pr = out.findIndex((s) => s.id.includes("pricing"));
    if (pr >= 0 && pr < 5) moveById(out[pr]!.id, 1);
  }

  if (model === "ecommerce_home" || model === "search_first_catalog" || expr === "commerce_dense") {
    for (const id of ["category-grid", "featured-products", "shop-spotlight"]) {
      moveById(id, -1);
    }
  }

  if (model === "service_leadgen" || expr === "service_trust") {
    for (const id of ["trust-local", "trust-bar", "cta", "join"]) {
      moveById(id, -1);
    }
  }

  return out;
}

export function buildHomepagePlan(
  intent: SiteIntent,
  _userPrompt: string,
  rhythmRefinement?: PageCompositionBias["rhythmBias"],
): HomepagePlan {
  let sectionSequence = buildSectionSequence(intent, _userPrompt);
  if (rhythmRefinement) {
    sectionSequence = refineSectionSequenceForRhythm(sectionSequence, rhythmRefinement);
    sectionSequence = refineSectionSequenceForHeroCharacter(sectionSequence, intent);
  }
  const compositionPlan = buildCompositionPlan(intent, sectionSequence);

  return {
    experienceModel: intent.experienceModel,
    densityProfile: intent.densityProfile,
    compositionPlan,
    navigationModel: {
      hasUtilityBar: intent.navigationDepth !== "minimal",
      hasPromoBar: intent.experienceModel === "ecommerce_home",
      hasSearch: intent.searchImportance !== "none",
      searchPriority:
        intent.searchImportance === "primary"
          ? "high"
          : intent.searchImportance === "supporting"
            ? "medium"
            : "none",
      menuStyle:
        intent.navigationDepth === "category_rich"
          ? "multi_category"
          : intent.navigationDepth === "portal"
            ? "portal"
            : "simple",
    },
    sectionSequence,
    trustModel: {
      style: intent.trustStyle,
      positions:
        intent.trustStyle === "authority"
          ? ["hero", "features", "footer"]
          : intent.trustStyle === "social_proof_heavy"
            ? ["hero", "features", "footer"]
            : ["features", "footer"],
    },
    rhythm: buildRhythm(intent.densityProfile),
  };
}

type CompositionPlanBrief = {
  macroComposition: string;
  layoutArchetype: PageCompositionArchetype;
  visualTension: string;
  motionPersonality: string;
  compositionZones: Array<{ id: string; role: string }>;
};

function toFinalCompositionPlan(brief: CompositionPlanBrief): CompositionPlan {
  return finalizeCompositionPlan({
    macroComposition: brief.macroComposition,
    layoutArchetype: brief.layoutArchetype,
    visualTension: brief.visualTension,
    motionPersonality: brief.motionPersonality,
    compositionZones: enrichBriefZonesToRich(brief.compositionZones, brief.layoutArchetype),
    layoutDNA: getDefaultLayoutDNAForArchetype(brief.layoutArchetype),
  });
}

function buildCompositionPlan(
  intent: SiteIntent,
  _sectionSequence: HomepagePlan["sectionSequence"],
): CompositionPlan {
  const airy = intent.densityProfile === "airy";
  const dense = intent.densityProfile === "dense_commerce";

  const plans: Record<SiteExperienceModel, CompositionPlanBrief> = {
    ecommerce_home: {
      macroComposition:
        "Bezoeker moet snel producten en categorieën ontdekken; pagina voelt als levend vitrine-etage met duidelijke koopspanning, niet als statische brochure.",
      layoutArchetype: "commerce_discovery_stack",
      visualTension: dense
        ? "Boven: compacte commerce-banden (categorieën, raster); midden: piek in visuele druk; onder: iets meer lucht bij merkteaser en nieuwsbrief zodat de stack niet mat wordt."
        : "Afwisseling tussen drukke productzones en één bewust rustige band (editorial of USP) vóór de footer.",
      motionPersonality:
        "Zakelijke micro-interactie: zachte fade-up op hero en uitgelichte rijen; geen speelse bounce; focus op scanbaarheid.",
      compositionZones: [
        { id: "shell", role: "Navigatie + optionele utiliteitsbalk; altijd vindbare zoek- of ontdek-CTA." },
        { id: "discovery", role: "Hero of zoekzone die uitnodigt tot bladeren (categorie-chips, zoekveld of visuele ingang)." },
        { id: "commerce_core", role: "Categorieën en/of uitgelichte producten als hoofdspanning van de pagina." },
        { id: "trust_strip", role: "Korte USP- of vertrouwensband (retour, verzending, keurmerk) zonder hele sectie vol kaarten." },
        { id: "soft_close", role: "Optionele redactionele teaser of nieuwsbrief; lagere druk dan commerce_core." },
        { id: "footer", role: "Volledige navigatie, beleid, service — anker voor vertrouwen." },
      ],
    },
    search_first_catalog: {
      macroComposition:
        "Zoeken en filtermentaliteit staan centraal; de pagina is een ingang naar een groot assortiment, niet een lineaire verkoopstory.",
      layoutArchetype: "catalog_search_spine",
      visualTension:
        "Sterke verticale ‘rug’: zoek-hero en categorieën eerst strak; rastergebied mag dichter; trust en footer iets rustiger.",
      motionPersonality:
        "Minimaal: subtiele reveals op het zoekgebied en het eerste raster; verder statisch en voorspelbaar voor power users.",
      compositionZones: [
        { id: "wayfinding", role: "Nav + prominente zoek- of filterhint." },
        { id: "discovery_spine", role: "Primaire ontdekking: zoekhero, chips of facet-zichtbaarheid." },
        { id: "browse_grid", role: "Categorieën en resultaatachtige grids als hoofdinhoud." },
        { id: "credibility", role: "Vertrouwensband vóór footer." },
        { id: "footer", role: "Links, beleid, service." },
      ],
    },
    editorial_content_hub: {
      macroComposition:
        "Bezoeker leest en verdiept zich; hiërarchie volgt redactioneel ritme (hoofdverhaal → thema’s → meer leesvoer).",
      layoutArchetype: "editorial_wave",
      visualTension: airy
        ? "Grote adem tussen blokken; typografie en beeld dragen de spanning i.p.v. boxed cards."
        : "Golf: afwisselend ‘cover’-moment, dichtere topic-rail, weer open artikelzone.",
      motionPersonality:
        "Rustig scroll-gevoel: zachte stagger op artikelteasers; geen agressieve parallax.",
      compositionZones: [
        { id: "masthead", role: "Nav + zoek of topics als ingang." },
        { id: "cover", role: "Hoofdartikel of feature met maximale typografische spanning." },
        { id: "clusters", role: "Thema’s of tags als tweede laag navigatie." },
        { id: "rail", role: "Artikelrail of lijst — hogere informatiedichtheid." },
        { id: "subscribe", role: "Nieuwsbrief of membership-teaser." },
        { id: "footer", role: "Over, archief, links." },
      ],
    },
    saas_landing: {
      macroComposition:
        "Van sterke belofte naar vertrouwen en concreet aanbod, daarna prijs en afsluiting — zelfde conversielogica als een bestemming of experience-merk: één doorlopende, cinematische scroll (geen losse ‘software-productpagina’).",
      layoutArchetype: "saas_proof_ladder",
      visualTension:
        "Helder hoogtepunt in hero; daarna gecontroleerde escalatie (vertrouwen → beleving/aanbod → tickets of prijs); vermijd drie identieke kaartenlagen achter elkaar.",
      motionPersonality:
        "Strak maar premium: korte fade-up op proof en aanbodbanden; één duidelijk scroll-anker richting prijs/tickets.",
      compositionZones: [
        { id: "hero_value", role: "Kernbelofte + primaire CTA; dominant beeld of filmische scene waar passend." },
        { id: "social_proof", role: "Logo’s, cijfers of quotes dicht bij de belofte." },
        { id: "capability", role: "Aanbod, attracties of use-cases — editorial of beeldgedreven, niet verplicht drie icoon-tegels." },
        { id: "conversion", role: "Tickets, tarieven of sterke eind-CTA." },
        { id: "footer", role: "FAQ-light, links, juridisch." },
      ],
    },
    service_leadgen: {
      macroComposition:
        "Lokale of vakmatige dienst: vertrouwen en duidelijkheid eerst, daarna aanbod, dan concrete actie (bellen, plannen, offerte).",
      layoutArchetype: "service_trust_cta",
      visualTension:
        "Hero rustig en menselijk; middenzone iets dichter (diensten, reviews); CTA-band weer open en uitnodigend.",
      motionPersonality:
        "Betrouwbaar: lichte beweging op testimonials of teamfoto; verder ingetogen.",
      compositionZones: [
        { id: "entry", role: "Hero met lokale of vakmatige belofte." },
        { id: "offer", role: "Diensten of werkwijze." },
        { id: "trust_local", role: "Reviews, certificaten, regio." },
        { id: "action", role: "Offerte of afspraak — harde conversiezone." },
        { id: "reassure", role: "FAQ of bezwaren." },
        { id: "footer", role: "NAP, links, contact." },
      ],
    },
    premium_product: {
      macroComposition:
        "Één merk of product in de spotlight: tempo langzaam, veel witruimte, verhaal en detail vóór de koopknop.",
      layoutArchetype: "premium_breath",
      visualTension:
        "Lage tot middelmatige verticale druk; spanning uit materiaal, typografie en beeld — niet uit rasterdichtheid.",
      motionPersonality:
        "Zeer subtiel: bijna stilstaand; eventueel zachte parallax op één beeld.",
      compositionZones: [
        { id: "statement", role: "Minimale nav + emotionele hero." },
        { id: "narrative", role: "Craft, herkomst of merkwaarden." },
        { id: "product_focus", role: "Specificaties en detail zonder schreeuwerige boxes." },
        { id: "proof_soft", role: "Beperkte social proof." },
        { id: "purchase", role: "Rustige koop- of reserveringszone." },
        { id: "footer", role: "Juridisch, contact." },
      ],
    },
    health_authority_content: {
      macroComposition:
        "Medische of gezondheidscontent: autoriteit en bronnen eerst; claims ingetogen; structuur ondersteunt vertrouwen.",
      layoutArchetype: "health_authority_stack",
      visualTension:
        "Hero en pillars serieuze, rustige band; evidence en artikelen iets dichter maar geen ‘salesy’ contrastpieken.",
      motionPersonality:
        "Nauwelijks speels; functionele fade voor leesbaarheid.",
      compositionZones: [
        { id: "trust_hero", role: "Kopregel en subkop met vertrouwen, geen agressieve marketing." },
        { id: "pillars", role: "Thema’s of zorglijnen." },
        { id: "credentials", role: "Experts, bronnen, keurmerken." },
        { id: "depth", role: "Artikelen of diepgaande content." },
        { id: "clarify", role: "FAQ of disclaimers." },
        { id: "footer", role: "Contact, juridisch." },
      ],
    },
    hybrid_content_commerce: {
      macroComposition:
        "Twee sporen: inspiratie/lezen en winkel; bezoeker moet beide kunnen zien zonder chaos.",
      layoutArchetype: "hybrid_story_commerce",
      visualTension:
        "Afwissel tussen redactionele lucht en productdichtheid; geen twee losse sites in één zonder visuele hiërarchie.",
      motionPersonality:
        "Redactioneel licht op story-teaser; commerce strakker op shop-spotlight.",
      compositionZones: [
        { id: "dual_hero", role: "Gebundelde boodschap shop + merk." },
        { id: "editorial", role: "Verhaal of magazine-teaser." },
        { id: "commerce_spot", role: "Uitgelichte producten." },
        { id: "read_more", role: "Artikelrail als tweede spoor." },
        { id: "footer", role: "Volledige navigatie shop + content." },
      ],
    },
    brand_storytelling: {
      macroComposition:
        "Scrollend merkverhaal: hoofdstukken, emotie en waarden; conversie secundair en zacht.",
      layoutArchetype: "brand_chapter_scroll",
      visualTension:
        "Elk hoofdstuk mag een eigen ‘adem’ hebben; spanning door beeldvulling en type-scale, niet door herhaalde cards.",
      motionPersonality:
        "Cinematisch licht: zachte reveals per hoofdstuk; geen harde spring-animaties.",
      compositionZones: [
        { id: "hook", role: "Emotionele opening." },
        { id: "chapters", role: "Opeenvolgende verhaalblokken." },
        { id: "values_craft", role: "Waarden of maakproces." },
        { id: "soft_cta", role: "Lage druk: ontdekken of contact." },
        { id: "footer", role: "Links, legal." },
      ],
    },
    community_media: {
      macroComposition:
        "Leden en momentum centraal: wat er speelt, wie erbij hoort, waarom nu lid worden.",
      layoutArchetype: "community_momentum",
      visualTension:
        "Hero en highlights energiek; member-proof en content-rail drukker; join-zone duidelijk maar niet schreeuwerig.",
      motionPersonality:
        "Iets levendiger: stagger op highlights en member-avatars; beperkt tot boven de fold.",
      compositionZones: [
        { id: "pulse", role: "Hero met beweging of ‘what’s on’." },
        { id: "activity", role: "Highlights, events, voordelen." },
        { id: "belonging", role: "Social proof van leden." },
        { id: "stream", role: "Content- of UGC-rail." },
        { id: "join", role: "Aanmelden of lid worden." },
        { id: "footer", role: "Regels, links." },
      ],
    },
  };

  const brief =
    plans[intent.experienceModel] ?? {
      macroComposition:
        "Professionele one-page met duidelijke hiërarchie: belofte, onderbouwing, actie — als één samenhangende pagina gecomponeerd.",
      layoutArchetype: "default_professional",
      visualTension: airy
        ? "Royale witruimte; piekspanning in hero en één middelste band."
        : "Afwissel compact en medium zonder monotone card-stapel.",
      motionPersonality: "Ingetogen fades; geen afleidende effecten.",
      compositionZones: [
        { id: "hero", role: "Kernboodschap en navigatie." },
        { id: "body", role: "Voordelen, bewijs of aanbod (samenvoegen toegestaan)." },
        { id: "conversion", role: "Pricing, FAQ of CTA — wat bij de briefing past." },
        { id: "footer", role: "Afsluiting en links." },
      ],
    };

  return toFinalCompositionPlan(brief);
}

function buildSectionSequence(intent: SiteIntent, userPrompt = ""): HomepagePlan["sectionSequence"] {
  if (intent.experienceModel === "brand_storytelling") {
    const rows: HomepagePlan["sectionSequence"] = [
      { id: "nav", type: "navigation", purpose: "light", priority: "supporting", density: "low" },
      {
        id: "hero",
        type: "marketing",
        purpose: "sterke visuele opening — dominant beeld of video waar passend; geen slap effen vlak",
        priority: "primary",
        density: "low",
      },
      {
        id: "chapter-1",
        type: "content",
        purpose: "kort verhaal of merklading — editorial; geen icoon-featuregrid",
        priority: "primary",
        density: "medium",
      },
    ];
    if (isCinematicMultimediaBriefing(userPrompt)) {
      rows.push({
        id: "showreel",
        type: "media",
        purpose: "werk / stills / filmstrip — alleen bij expliciete multimedia- of showreel-briefing",
        priority: "primary",
        density: "medium",
      });
    }
    rows.push(
      { id: "cta-soft", type: "conversion", purpose: "low-pressure CTA", priority: "supporting", density: "low" },
      { id: "footer", type: "utility", purpose: "links", priority: "supporting", density: "low" },
    );
    return rows;
  }

  type SeqModel = Exclude<SiteExperienceModel, "brand_storytelling">;
  const sequences: Record<SeqModel, HomepagePlan["sectionSequence"]> = {
    ecommerce_home: [
      { id: "utility-bar", type: "utility", purpose: "shipping/returns", priority: "supporting", density: "low" },
      { id: "nav", type: "navigation", purpose: "category access", priority: "primary", density: "medium" },
      { id: "search-hero", type: "search", purpose: "product discovery", priority: "primary", density: "low" },
      { id: "category-grid", type: "commerce", purpose: "browse categories", priority: "primary", density: "high" },
      { id: "featured-products", type: "commerce", purpose: "bestsellers", priority: "primary", density: "high" },
      { id: "benefits-strip", type: "trust", purpose: "USPs", priority: "secondary", density: "low" },
      { id: "editorial-block", type: "content", purpose: "brand story", priority: "secondary", density: "medium" },
      { id: "newsletter", type: "conversion", purpose: "email capture", priority: "supporting", density: "low" },
      { id: "footer", type: "utility", purpose: "navigation & trust", priority: "supporting", density: "high" },
    ],
    search_first_catalog: [
      { id: "nav", type: "navigation", purpose: "categories", priority: "primary", density: "medium" },
      { id: "search-hero", type: "search", purpose: "primary discovery", priority: "primary", density: "low" },
      { id: "filters-hint", type: "utility", purpose: "facet mental model", priority: "supporting", density: "low" },
      { id: "category-grid", type: "commerce", purpose: "browse", priority: "primary", density: "high" },
      { id: "featured-products", type: "commerce", purpose: "curated picks", priority: "secondary", density: "high" },
      { id: "trust-bar", type: "trust", purpose: "credibility", priority: "secondary", density: "low" },
      { id: "footer", type: "utility", purpose: "links & policies", priority: "supporting", density: "medium" },
    ],
    editorial_content_hub: [
      { id: "nav", type: "navigation", purpose: "topic access", priority: "primary", density: "medium" },
      { id: "search-intro", type: "search", purpose: "discovery", priority: "primary", density: "low" },
      { id: "featured-article", type: "content", purpose: "hero story", priority: "primary", density: "low" },
      { id: "topic-clusters", type: "content", purpose: "category navigation", priority: "primary", density: "medium" },
      { id: "article-rail", type: "content", purpose: "recent posts", priority: "secondary", density: "high" },
      { id: "video-highlight", type: "media", purpose: "engagement", priority: "secondary", density: "medium" },
      { id: "newsletter", type: "conversion", purpose: "subscribe", priority: "supporting", density: "low" },
      { id: "footer", type: "utility", purpose: "about & links", priority: "supporting", density: "medium" },
    ],
    saas_landing: [
      { id: "nav", type: "navigation", purpose: "anchors", priority: "primary", density: "medium" },
      { id: "hero", type: "marketing", purpose: "kernbelofte — filmisch of full-bleed waar passend", priority: "primary", density: "low" },
      { id: "proof-strip", type: "trust", purpose: "vertrouwen", priority: "secondary", density: "low" },
      { id: "features", type: "marketing", purpose: "aanbod / attracties / uitkomsten — geen verplichte icoon-grid", priority: "primary", density: "medium" },
      { id: "product-visual", type: "media", purpose: "sfeer of showcase-beeld", priority: "primary", density: "low" },
      { id: "use-cases", type: "marketing", purpose: "bezoekersmomenten of scenario’s", priority: "secondary", density: "medium" },
      { id: "testimonials", type: "trust", purpose: "quotes", priority: "secondary", density: "medium" },
      { id: "pricing", type: "conversion", purpose: "tickets of tarieven", priority: "primary", density: "medium" },
      { id: "footer", type: "utility", purpose: "links", priority: "supporting", density: "low" },
    ],
    service_leadgen: [
      { id: "nav", type: "navigation", purpose: "anchors", priority: "primary", density: "low" },
      { id: "hero", type: "marketing", purpose: "local value prop", priority: "primary", density: "low" },
      { id: "services", type: "marketing", purpose: "what you offer", priority: "primary", density: "medium" },
      { id: "trust-local", type: "trust", purpose: "reviews & badges", priority: "primary", density: "medium" },
      { id: "process", type: "marketing", purpose: "how it works", priority: "secondary", density: "medium" },
      { id: "cta", type: "conversion", purpose: "book / contact", priority: "primary", density: "low" },
      { id: "faq", type: "utility", purpose: "objections", priority: "supporting", density: "medium" },
      { id: "footer", type: "utility", purpose: "NAP & links", priority: "supporting", density: "medium" },
    ],
    premium_product: [
      { id: "nav", type: "navigation", purpose: "minimal links", priority: "supporting", density: "low" },
      { id: "hero", type: "marketing", purpose: "product promise", priority: "primary", density: "low" },
      { id: "story", type: "content", purpose: "craft / origin", priority: "primary", density: "low" },
      { id: "features", type: "marketing", purpose: "product detail", priority: "primary", density: "medium" },
      { id: "testimonials", type: "trust", purpose: "social proof", priority: "secondary", density: "medium" },
      { id: "pricing", type: "conversion", purpose: "purchase path", priority: "primary", density: "low" },
      { id: "footer", type: "utility", purpose: "legal", priority: "supporting", density: "low" },
    ],
    health_authority_content: [
      { id: "nav", type: "navigation", purpose: "topics", priority: "primary", density: "medium" },
      { id: "hero", type: "marketing", purpose: "trust-first headline", priority: "primary", density: "low" },
      { id: "pillars", type: "content", purpose: "key themes", priority: "primary", density: "medium" },
      { id: "evidence", type: "trust", purpose: "credentials", priority: "primary", density: "medium" },
      { id: "articles", type: "content", purpose: "deep dives", priority: "secondary", density: "high" },
      { id: "faq", type: "utility", purpose: "medical disclaimers / FAQ", priority: "supporting", density: "medium" },
      { id: "footer", type: "utility", purpose: "contact & legal", priority: "supporting", density: "medium" },
    ],
    hybrid_content_commerce: [
      { id: "nav", type: "navigation", purpose: "shop + editorial", priority: "primary", density: "medium" },
      { id: "hero", type: "marketing", purpose: "split message", priority: "primary", density: "low" },
      { id: "story-teaser", type: "content", purpose: "brand/editorial", priority: "secondary", density: "medium" },
      { id: "shop-spotlight", type: "commerce", purpose: "featured SKUs", priority: "primary", density: "high" },
      { id: "article-rail", type: "content", purpose: "read & shop", priority: "secondary", density: "medium" },
      { id: "newsletter", type: "conversion", purpose: "list growth", priority: "supporting", density: "low" },
      { id: "footer", type: "utility", purpose: "full nav", priority: "supporting", density: "high" },
    ],
    community_media: [
      { id: "nav", type: "navigation", purpose: "discover", priority: "primary", density: "medium" },
      { id: "hero", type: "marketing", purpose: "movement", priority: "primary", density: "low" },
      { id: "highlights", type: "marketing", purpose: "what's on", priority: "primary", density: "medium" },
      { id: "member-proof", type: "trust", purpose: "community proof", priority: "secondary", density: "medium" },
      { id: "content-rail", type: "content", purpose: "UGC / posts", priority: "secondary", density: "high" },
      { id: "join", type: "conversion", purpose: "signup", priority: "primary", density: "low" },
      { id: "footer", type: "utility", purpose: "rules & links", priority: "supporting", density: "medium" },
    ],
  };

  const key = intent.experienceModel as SeqModel;
  let seq = sequences[key] ?? sequences.saas_landing;

  if (key === "premium_product" && isImmersiveDestinationBriefing(userPrompt)) {
    seq = seq.map((row) => {
      if (row.id === "hero") {
        return {
          ...row,
          purpose:
            "immersive bestemming — verplichte stille hero-video (full-bleed); eerste indruk = bewegend beeld; nav overlay op video",
        };
      }
      if (row.id === "features") {
        return {
          ...row,
          purpose:
            "beleving/attracties als editorial of grote beelden — doorlopend met hero; geen drie gelijke USP-kaarten als hele band",
        };
      }
      return row;
    });
  }

  return seq;
}

function buildRhythm(density: DensityProfile): HomepagePlan["rhythm"] {
  if (density === "airy") {
    return { band1: "spacious", band2: "spacious", band3: "spacious", band4: "spacious", band5: "spacious" };
  }
  if (density === "dense_commerce") {
    return { band1: "compact", band2: "compact", band3: "medium", band4: "compact", band5: "compact" };
  }
  return { band1: "spacious", band2: "compact", band3: "spacious", band4: "medium", band5: "compact" };
}

type SectionPriority = HomepagePlan["sectionSequence"][number]["priority"];

function priorityRank(p: SectionPriority): number {
  if (p === "primary") return 2;
  if (p === "secondary") return 1;
  return 0;
}

/**
 * Mapt homepage-planregels naar canonieke id's die `buildStudioPromptLayoutMaps` begrijpt.
 * Nav/search-shell rijen worden overgeslagen (zitten in hero/nav-blok).
 */
export function mapPlanSectionRowToCanonical(
  row: HomepagePlan["sectionSequence"][number],
): string | null {
  const id = row.id.toLowerCase();
  if (row.type === "navigation") return null;
  if (id === "nav") return null;
  if (id === "utility-bar" || id === "filters-hint") return null;
  if (id.startsWith("search-")) return null;

  if (id === "footer") return "footer";
  if (id === "hero") return "hero";
  /** Merkwaarden / filosofie — geen “features”-grid (was: marketing → features). */
  if (id === "values" || id.includes("values")) return "about";
  /** Werk / reel — apart van features; mapped naar portfolio-pool (visuele lead). */
  if (
    id === "showreel" ||
    id.includes("showreel") ||
    id === "filmstrip" ||
    id.includes("reel") ||
    id === "werk" ||
    id.includes("stills")
  ) {
    return "portfolio";
  }
  if (id.includes("faq")) return "faq";
  if (id.includes("pricing")) return "pricing";
  if (id.includes("newsletter")) return "cta";
  if (id.includes("testimonial") || id === "member-proof") return "testimonials";
  if (id.includes("trust")) return "trust";
  if (id.includes("cta") || id === "join") return "cta";
  if (
    id.includes("story") ||
    id.includes("chapter") ||
    id.startsWith("editorial") ||
    id.includes("article") ||
    id.includes("pillars") ||
    id.includes("evidence") ||
    id.includes("video-highlight") ||
    id === "story-teaser" ||
    id === "featured-article"
  ) {
    return "story";
  }
  if (id.includes("process") || id.includes("use-case") || id.includes("benefits")) return "features";
  if (row.type === "commerce") return "features";
  if (row.type === "trust") return "testimonials";
  if (row.type === "conversion" && !id.includes("newsletter")) return "cta";
  if (row.type === "utility" && id !== "footer") return null;
  if (row.type === "marketing" || row.type === "content" || row.type === "media") return "features";
  return "features";
}

function isCanonicalSectionCritical(canonical: string, intent: SiteIntent): boolean {
  if (canonical === "pricing" && intent.conversionModel === "direct_purchase") return true;
  if (canonical === "faq" && intent.experienceModel === "health_authority_content") return true;
  if (
    canonical === "pricing" &&
    (intent.experienceModel === "ecommerce_home" || intent.experienceModel === "search_first_catalog")
  ) {
    return true;
  }
  if (intent.experienceModel === "brand_storytelling" && canonical === "story") return true;
  return false;
}

/**
 * Leunt op `HomepagePlan.sectionSequence` (volgorde + prioriteit), niet op een vaste 6-sectie-template.
 * Resultaat: max {@link MAX_SITE_CONFIG_SECTIONS} id's, hero + footer afgedwongen, optionele secties vallen weg bij drukte.
 */
export function deriveLeanSectionsFromHomepagePlan(plan: HomepagePlan, intent: SiteIntent): string[] {
  type Pri = SectionPriority;
  const ordered: string[] = [];
  const bestPri = new Map<string, Pri>();

  for (const row of plan.sectionSequence) {
    const c = mapPlanSectionRowToCanonical(row);
    if (!c) continue;
    const prev = bestPri.get(c);
    if (prev === undefined || priorityRank(row.priority) > priorityRank(prev)) {
      bestPri.set(c, row.priority);
    }
    if (!ordered.includes(c)) ordered.push(c);
  }

  let ids = [...ordered];
  if (!ids.includes("hero")) ids.unshift("hero");
  ids = ids.filter((x) => x !== "footer");
  ids.push("footer");

  const optionalDropOrder = ["faq", "testimonials", "pricing", "trust", "portfolio", "about", "story"] as const;

  while (ids.length > MAX_SITE_CONFIG_SECTIONS) {
    const mids = ids.slice(1, -1);
    if (mids.length === 0) break;

    let drop: string | null = null;
    for (const o of optionalDropOrder) {
      if (mids.includes(o) && !isCanonicalSectionCritical(o, intent)) {
        drop = o;
        break;
      }
    }

    if (!drop) {
      const scored = mids.map((m) => ({
        m,
        r: priorityRank(bestPri.get(m) ?? "supporting"),
        opt: optionalDropOrder.indexOf(m as (typeof optionalDropOrder)[number]),
      }));
      scored.sort((a, b) => a.r - b.r || (a.opt === -1 ? 99 : a.opt) - (b.opt === -1 ? 99 : b.opt));
      drop =
        scored.find((s) => !isCanonicalSectionCritical(s.m, intent))?.m ??
        scored[0]?.m ??
        null;
    }

    if (!drop) break;
    const idx = ids.indexOf(drop);
    if (idx <= 0 || idx >= ids.length - 1) break;
    ids.splice(idx, 1);
  }

  if (ids.length < 3) {
    if (!ids.includes("features")) ids.splice(-1, 0, "features");
  }
  if (ids.length < 3) {
    if (!ids.includes("cta")) ids.splice(-1, 0, "cta");
  }

  return ids;
}

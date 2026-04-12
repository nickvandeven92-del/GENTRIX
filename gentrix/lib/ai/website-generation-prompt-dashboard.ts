import { buildWebsiteGenerationUserPrompt } from "@/lib/ai/generate-site-with-claude";
import { GENERATION_PACKAGE_LABELS, getGenerationPackagePromptBlock, STUDIO_GENERATION_PACKAGE } from "@/lib/ai/generation-packages";

/** Bestanden waar de generator-prompt uit bestaat (voor dashboard / documentatie). */
export const WEBSITE_PROMPT_SOURCE_FILES = [
  {
    label: "User-bericht (alle §’s, variatie, JSON-formaat)",
    path: "lib/ai/generate-site-with-claude.ts",
    description:
      "generateSiteWithClaude bouwt het user-bericht via buildWebsiteGenerationUserPrompt (o.a. STUDIO STRUCTUUR, variatie, packages — geen vaste Tailwind design-preset meer).",
  },
  {
    label: "Site-config (prompt + vision-merge)",
    path: "lib/ai/build-site-config.ts",
    description:
      "buildSiteConfig: runPromptInterpretationPipeline (score-signalen + optioneel Claude PromptInterpretation → merge) → personality, brand_style, primary_goal, target_audience, site_intent; homepage-plan + apply-site-intent; mergeExtractedDesignIntoSiteConfig voor vision.",
  },
  {
    label: "Interpretatiepipeline (centraal brein)",
    path: "lib/ai/interpret-prompt-pipeline.ts",
    description:
      "runPromptInterpretationPipeline — normalisatie, scorePromptSignals, merge met extract-prompt-interpretation-with-claude; resolve site intent + visuele mapping.",
  },
  {
    label: "Signaalgroepen (NL/EN, frasen)",
    path: "lib/ai/prompt-signal-groups.ts",
    description: "TOKENS_* + PHRASE_PATTERNS + NEGATION_PATTERNS voor score-gebaseerde heuristiek.",
  },
  {
    label: "Score prompt signalen",
    path: "lib/ai/score-prompt-signals.ts",
    description: "scorePromptSignals → HeuristicSignalProfile (geen first-match eindbeslissing).",
  },
  {
    label: "Branche-bias (alleen bij ambiguïteit)",
    path: "lib/ai/apply-industry-bias-if-ambiguous.ts",
    description:
      "applyIndustryVisualBiasIfAmbiguous + applyIndustryIntentBiasIfAmbiguous — subtiele industryHintId-duw (0.3–0.8 visueel; lichter op intent) alleen bij zwakke tokens of dichte top-2; geen harde mapping.",
  },
  {
    label: "Claude: PromptInterpretation JSON",
    path: "lib/ai/extract-prompt-interpretation-with-claude.ts",
    description: "EXTRACT_PROMPT_INTERPRETATION_WITH_CLAUDE — semantische laag vóór merge.",
  },
  {
    label: "Denklijn tijdens stream (admin UI)",
    path: "lib/ai/generate-design-rationale-with-claude.ts",
    description:
      "JSON met rationale_nl + designcontract; bij referentie-URL verplicht `referenceVisualAxes` (9 assen). Contract → user-prompt + zelfreview + Unsplash-context. NDJSON design_rationale. Uit: SKIP_DESIGN_RATIONALE=1.",
  },
  {
    label: "Studio prompt: archetypes + component-varianten (één bron)",
    path: "lib/ai/studio-prompt-layout-maps.ts",
    description:
      "buildStudioPromptLayoutMaps — personality × theme × experienceModel; optioneel homepagePlan.compositionPlan.layoutArchetype vernauwt hero/features/testimonial/pricing-pools vóór per-sectie pick; faq/footer varieren. (Geen aparte map-config wrappers meer.)",
  },
  {
    label: "Layout-archetypes prompttekst",
    path: "lib/ai/layout-archetypes-prompt.ts",
    description:
      "buildLayoutArchetypesPromptBlock — compositionPlan (macro) boven sectie-map; slots + nav/hero-regels + section rhythm + banned patterns; sectionOrder uit siteConfig.sections.",
  },
  {
    label: "Structuur-laag in de prompt",
    path: "lib/ai/studio-structure-layer.ts",
    description:
      "buildStudioStructurePromptBlock — personality, site intent + homepage plan, lovable examples, config, archetypes, contract.",
  },
  {
    label: "Design system contract (hard constraints)",
    path: "lib/ai/premium-design-system-contract.ts",
    description: "PREMIUM_DESIGN_SYSTEM_CONTRACT — preset-only spacing scale, variants, JSON output binding to §5.",
  },
  {
    label: "Vision-extract referentiebeeld",
    path: "lib/ai/extract-design-from-image.ts",
    description: "extractDesignFromImage — eerste kennisbank-screenshot; merge in config. Uitzetten: DISABLE_DESIGN_EXTRACT=1.",
  },
  {
    label: "Site studio (één productprompt)",
    path: "lib/ai/generation-packages.ts",
    description:
      "getGenerationPackagePromptBlock(options.preserveLayoutUpgrade) — §0B vrije vs upgrade-structuurregels + portaal-mock + briefing (geen tiers meer).",
  },
  {
    label: "Minimale prompt-modus (env / API)",
    path: "lib/ai/generate-site-with-claude.ts",
    description:
      "SITE_GENERATION_MINIMAL_PROMPT=1 of options.minimalPrompt — buildMinimalWebsiteGenerationUserPrompt: geen volledige branche-/stijl-/variatieblokken; wél sector-router + anti-template; MASTER_SITE_SYSTEM_PROMPT_MINIMAL + §3B–§5-contract.",
  },
  {
    label: "Compacte studio-run (alleen landing)",
    path: "lib/ai/generate-site-with-claude.ts",
    description:
      "SITE_GENERATION_LANDING_ONLY=1 of API `landing_page_only: true` / options.landingPageOnly — zelfde §3B–§5 maar zonder verplichte `marketingPages` + `contactSections` in één JSON (kortere output, minder timeout-risico).",
  },
  {
    label: "Site-generatie output-limiet (streaming)",
    path: "lib/ai/generate-site-with-claude.ts",
    description:
      "prepareGenerateSiteClaudeCall: vaste max_tokens (DEFAULT_MAX_OUTPUT_TOKENS) voor de hoofd-stream — ruim genoeg voor marketing multi-page + zware secties; geen aparte agency-toggle meer.",
  },
  {
    label: "System-bericht (optioneel)",
    path: "lib/data/ai-knowledge.ts",
    description:
      "Actieve rijen uit ai_knowledge (behalve “Claude activiteit”): tekst als system context; optionele reference_image_urls als vision-blokken in het user-bericht vóór de opdracht.",
  },
  {
    label: "API-route",
    path: "app/api/generate-site/route.ts",
    description: "Ontvangt formulierdata en roept generateSiteWithClaude aan.",
  },
  {
    label: "Output-schema (validatie)",
    path: "lib/ai/tailwind-sections-schema.ts",
    description: "Zod-schema voor config + sections na het Claude-antwoord.",
  },
  {
    label: "react_sections (alleen bestaande data)",
    path: "lib/site/react-site-schema.ts",
    description:
      "Zod voor oude react_sections JSON; studio genereert tailwind_sections. Publieke weergave ondersteunt beide.",
  },
] as const;

const SAMPLE_BUSINESS = "Voorbeeld Studio BV";
const SAMPLE_DESCRIPTION =
  "Lokale dienstverlener; deze tekst is alleen om te tonen hoe naam en context in het echte user-bericht verschijnen.";
const SAMPLE_RECENT = ["Bestaande Klant Noord", "Bestaande Klant Zuid"];

export function getSampleUserPromptForDashboard(): string {
  return buildWebsiteGenerationUserPrompt(SAMPLE_BUSINESS, SAMPLE_DESCRIPTION, [...SAMPLE_RECENT], undefined);
}

export function getUnifiedPackagePromptSnippetForDashboard(): {
  id: typeof STUDIO_GENERATION_PACKAGE;
  label: string;
  body: string;
} {
  return {
    id: STUDIO_GENERATION_PACKAGE,
    label: GENERATION_PACKAGE_LABELS[STUDIO_GENERATION_PACKAGE],
    body: getGenerationPackagePromptBlock(),
  };
}

export const PROMPT_DASHBOARD_SAMPLE_META = {
  businessName: SAMPLE_BUSINESS,
  description: SAMPLE_DESCRIPTION,
  recentClientNames: SAMPLE_RECENT,
} as const;

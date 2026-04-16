import { buildWebsiteGenerationUserPrompt } from "@/lib/ai/generate-site-with-claude";
import { GENERATION_PACKAGE_LABELS, getGenerationPackagePromptBlock, STUDIO_GENERATION_PACKAGE } from "@/lib/ai/generation-packages";

/**
 * Bronbestanden die de huidige site-generator vormen (admin prompt-pagina).
 *
 * De oude interpretatiepipeline (`build-site-config`, `score-prompt-signals`, …) staat onder
 * `lib/ai/_archive/` en is uitgesloten van TypeScript-build (`tsconfig` exclude) — geen onderdeel
 * van de actieve run.
 */
export const WEBSITE_PROMPT_SOURCE_FILES = [
  {
    label: "Site-generatie (user-bericht, stream, finalisatie)",
    path: "lib/ai/generate-site-with-claude.ts",
    description:
      "prepareGenerateSiteClaudeCall: kennis, referentiesite-fetch, branche-/sectie-keuze, buildWebsiteGenerationUserPrompt; generateDesignRationaleWithClaude; stream; finalizeGenerateSiteFromClaudeText; self-review + Unsplash; createGenerateSiteReadableStream voor NDJSON.",
  },
  {
    label: "System prompts (volledig vs minimal)",
    path: "lib/ai/master-site-system-prompt.ts",
    description:
      "MASTER_SITE_SYSTEM_PROMPT / _MINIMAL — gekozen via minimalPrompt of SITE_GENERATION_MINIMAL_PROMPT.",
  },
  {
    label: "Studio-blok (pakket / briefing in user-prompt)",
    path: "lib/ai/generation-packages.ts",
    description:
      "getGenerationPackagePromptBlock — vaste productprompt (§0B) + preserve/upgrade-hints.",
  },
  {
    label: "Alpine / micro-interactie-instructies",
    path: "lib/ai/interactive-alpine-prompt.ts",
    description:
      "getAlpineInteractivityPromptBlock + getStudioDefaultHeroVideoPromptBlock — Alpine-regels; video alleen met eigen URL.",
  },
  {
    label: "Denklijn + designcontract (voor bouw-prompt)",
    path: "lib/ai/generate-design-rationale-with-claude.ts",
    description:
      "JSON rationale_nl + contract; bij fout of SKIP_DESIGN_RATIONALE gaat generatie door zonder contractinjectie.",
  },
  {
    label: "Designcontract-schema (Zod)",
    path: "lib/ai/design-generation-contract.ts",
    description: "Bindende velden + referenceVisualAxes wanneer referentie-excerpt aanwezig is.",
  },
  {
    label: "Referentiesite voor prompt",
    path: "lib/ai/fetch-reference-site-for-prompt.ts",
    description: "HTML-excerpt voor stijl (zelfde bron voor Denklijn en bouw-prompt).",
  },
  {
    label: "Brancheprofielen en sectie-hints",
    path: "lib/ai/site-generation-industry-data.ts",
    description: "detectIndustry, combinedIndustryProbeText — input voor sectie-IDs en feedback JSON.",
  },
  {
    label: "JSON normalisatie en postprocessing",
    path: "lib/ai/generate-site-postprocess.ts",
    description:
      "postProcessClaudeTailwindPage / MarketingSite; ensureClaudeMarketingSiteJsonHasContactSections; upgrade-stable IDs.",
  },
  {
    label: "Output-schema en mapping naar secties",
    path: "lib/ai/tailwind-sections-schema.ts",
    description: "Zod voor Claude-JSON; mapClaudeOutputToSections / mapClaudeMarketingSiteOutputToSections.",
  },
  {
    label: "Marketing multi-page harde regels",
    path: "lib/ai/validate-marketing-site-output.ts",
    description: "validateMarketingSiteHardRules na schema-validatie.",
  },
  {
    label: "HTML-validatie (homepage-plan)",
    path: "lib/ai/validate-generated-page.ts",
    description: "validateGeneratedPageHtml — o.a. dev-check na generatie in stream-pad.",
  },
  {
    label: "Content claims (scan + rapport)",
    path: "lib/ai/content-claim-diagnostics.ts",
    description: "withContentClaimDiagnostics — buildContentClaimDiagnosticsReport op gegenereerde HTML.",
  },
  {
    label: "Authority-beleid (copy)",
    path: "lib/ai/content-authority-policy.ts",
    description: "buildContentAuthorityPolicyBlock — gebruikt in prompts en zelfreview.",
  },
  {
    label: "Optionele tweede LLM-pass (zelfreview)",
    path: "lib/ai/self-review-site-generation.ts",
    description:
      "applySelfReviewToGeneratedPage — standaard uit (ENABLE_SITE_SELF_REVIEW); DISABLE wint.",
  },
  {
    label: "Unsplash-vervanging",
    path: "lib/ai/unsplash-image-replace.ts",
    description: "replaceUnsplashImagesInSections na succesvolle JSON (key via env).",
  },
  {
    label: "NDJSON stream consumer (jobs)",
    path: "lib/ai/consume-generate-site-readable-stream.ts",
    description: "Leest createGenerateSiteReadableStream tot complete/error (geen browser-fetch).",
  },
  {
    label: "System-bericht uit AI-kennis",
    path: "lib/data/ai-knowledge.ts",
    description:
      "getKnowledgeContextForClaude — actieve rijen als system + optionele vision-blokken vóór de opdracht.",
  },
  {
    label: "API: synchrone generatie",
    path: "app/api/generate-site/route.ts",
    description: "POST → generateSiteWithClaude (niet-streaming).",
  },
  {
    label: "API: NDJSON-stream",
    path: "app/api/generate-site/stream/route.ts",
    description: "POST → createGenerateSiteReadableStream; maxDuration 300s voor lange runs.",
  },
  {
    label: "Legacy code (niet in TS-build)",
    path: "lib/ai/_archive/",
    description:
      "Oude pipeline (site-intent, prompt-scoring, build-site-config, …). Niet geïmporteerd door de actieve generator; map staat in tsconfig exclude.",
  },
  {
    label: "Output legacy vs studio",
    path: "lib/site/react-site-schema.ts",
    description: "Zod voor react_sections; studio levert tailwind_sections — weergave ondersteunt beide.",
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

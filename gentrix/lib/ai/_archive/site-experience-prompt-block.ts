import type { HomepagePlan } from "@/lib/ai/build-homepage-plan";
import { EXPERIENCE_MODEL_PROMPT_HINTS } from "@/lib/ai/experience-model-prompt-hints";
import type { SiteIntent } from "@/lib/ai/site-experience-model";
import type { ValidationIssue } from "@/lib/ai/validate-homepage-plan";

/** Interne id `saas_proof_ladder` = conversiestory; in prompts nooit als “SaaS-pagina” framen. */
const LAYOUT_ARCHETYPE_STORY_FOR_PROMPT: Partial<Record<string, string>> = {
  saas_proof_ladder:
    "Experience-conversiestory: belofte → vertrouwen → beleving/aanbod → prijs/tickets. Denk Lovable-achtige cinematische bestemming (full-bleed, typografie, organische secties), géén drie gelijke feature-kaarten als hele pagina.",
};

/** Compacte weergave: minder tokens, zelfde macro + zone-rollen; detailvelden staan impliciet in preset/archetypes. */
function compositionPlanForPrompt(cp: HomepagePlan["compositionPlan"]) {
  const layoutStory = LAYOUT_ARCHETYPE_STORY_FOR_PROMPT[cp.layoutArchetype];
  return {
    macroComposition: cp.macroComposition,
    layout_archetype: cp.layoutArchetype,
    ...(layoutStory ? { layout_story_for_model: layoutStory } : {}),
    visual_tension: cp.visualTension,
    motion_personality: cp.motionPersonality,
    composition_quality: cp.qualityReport
      ? {
          score: cp.qualityReport.score,
          fixes: cp.qualityReport.fixes.slice(0, 4),
        }
      : undefined,
    composition_zones: cp.compositionZones.map((z) => ({
      id: z.id,
      role: z.role,
      density: z.density,
      mediaPriority: z.mediaPriority,
      allowCards: z.allowCards,
      allowAsymmetricBalance: z.allowAsymmetricBalance,
    })),
  };
}

export function buildSiteExperiencePromptBlock(params: {
  intent: SiteIntent;
  plan: HomepagePlan;
  planIssues?: ValidationIssue[];
}): string {
  const hint = EXPERIENCE_MODEL_PROMPT_HINTS[params.intent.experienceModel];
  const issuesNote =
    params.planIssues && params.planIssues.length > 0
      ? `\n\n=== PLAN CHECK (intern; los op in HTML-keuzes) ===\n${JSON.stringify(params.planIssues, null, 2)}`
      : "";

  const cp = params.plan.compositionPlan;

  return `=== PAGINA COMPOSITIE (leidend) ===
Één doorlopende pagina: vertaal \`compositionPlan\` + zones naar scroll-HTML — niet “elke rol = identieke kaart”.

**Experience model:** \`${params.plan.experienceModel}\`
**Strategie-hint:** ${hint}

**compositionPlan (macro):**
${JSON.stringify(compositionPlanForPrompt(cp), null, 2)}

**Section-level hints** (ondergeschikt): mappen op \`_site_config.sections\` (vaak ≤5); meerdere rollen mogen in **één** rijke \`<section>\`.
${JSON.stringify(
  {
    navigationModel: params.plan.navigationModel,
    rhythm: params.plan.rhythm,
    sectionSequence: params.plan.sectionSequence.map((s) => ({
      id: s.id,
      type: s.type,
      purpose: s.purpose,
      priority: s.priority,
      density: s.density,
    })),
    recommendedPattern: params.intent.recommendedHomepagePattern,
    businessModel: params.intent.businessModel,
    contentStrategy: params.intent.contentStrategy,
    searchImportance: params.intent.searchImportance,
  },
  null,
  2,
)}
${issuesNote}

**Kern:**
- **Hero eerst:** eerste viewport = **merk-eerste indruk** — visueel gewicht + kop + primaire CTA; geen slap begin (alleen kleine kaarten zonder groot beeld) tenzij \`brand_storytelling\`/editorial expliciet zo kiest.
- Zones + \`visual_tension\` / \`motion_personality\` eerst; dan \`sectionSequence\` + \`_layout_archetypes\` → \`data-layout\`/\`data-slot\`.
- Kracht = beeld + typografie + preset + **contrast tussen banden** — composeer als **één doorlopende ervaring** (Lovable-achtig), niet als afvinklijst van gelijkvormige sectie-blokken.
- CTA duidelijk; geen extra sectie-id’s buiten \`_site_config.sections\`. Zoek hoog indien van toepassing; \`rhythm\` respecteren.
`;
}

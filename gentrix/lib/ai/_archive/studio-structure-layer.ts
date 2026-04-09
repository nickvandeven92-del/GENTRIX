import { buildAboveFoldStrategyPromptBlock } from "@/lib/ai/above-fold-strategy-prompt";
import type { HomepagePlan } from "@/lib/ai/build-homepage-plan";
import type { ExtractedDesignFromImage, SiteConfig } from "@/lib/ai/build-site-config";
import type { DesignPreset } from "@/lib/ai/design-presets";
import { formatPersonalityPromptBlock } from "@/lib/ai/design-personality";
import { buildLayoutArchetypesPromptBlock } from "@/lib/ai/layout-archetypes-prompt";
import { LOVABLE_EXAMPLES_COMPACT } from "@/lib/ai/lovable-examples";
import {
  LOVABLE20_VISUAL_PRIORITY,
  LOVABLE20_VISUAL_PRIORITY_MINIMAL,
} from "@/lib/ai/lovable20-visual-priority";
import { PREMIUM_DESIGN_SYSTEM_CONTRACT } from "@/lib/ai/premium-design-system-contract";
import type { ThemeMode } from "@/lib/ai/design-presets";
import { buildSiteExperiencePromptBlock } from "@/lib/ai/site-experience-prompt-block";
import type { ResolverConfidenceLayoutOptions } from "@/lib/ai/apply-resolver-confidence-to-layout-options";
import type { CompositionConflictDecision } from "@/lib/ai/resolve-composition-plan";
import type { SiteIntent } from "@/lib/ai/site-experience-model";
import type { ValidationIssue } from "@/lib/ai/validate-homepage-plan";
import type { LayoutArchetype } from "@/types/layoutArchetypes";

/** Voorkomt witte/grijze “tussenband” op verder donkere luxe-sites (korte prompts). */
function buildDarkThemeCohesionBlock(themeMode: ThemeMode): string {
  if (themeMode !== "dark" && themeMode !== "mixed") return "";
  return `
=== Donkere pagina — samenhang (richting) ===
- Houd **één warm-donkere wereld**; vermijd brede kille grijs- of witvlakken tussen hoofdstukken — verschuif met preset \`section\`/\`sectionAlt\`, gradient of tint, niet met een halve pagina template-grijs.
- Geen lege placeholder-vierkanten voor iconen; \`data-lucide\` of typografische accenten zijn genoeg.
`.trim();
}

function clipPresetSnippet(s: string, max: number): string {
  const t = s.trim();
  return t.length <= max ? t : `${t.slice(0, max)}…`;
}

/** Korte herhaling vóór het volledige JSON: modellen volgen dit vaker dan een enorme nested blob alleen. */
export function buildDesignPresetPromptDigest(p: DesignPreset): string {
  return `=== PRESET DIGEST (toepassen — ook als “creatieve” keuzes) ===
- **themeMode:** ${p.themeMode}
- **surfaces:** page \`${clipPresetSnippet(p.surfaces.page, 90)}\` · section \`${clipPresetSnippet(p.surfaces.section, 90)}\` · sectionAlt \`${clipPresetSnippet(p.surfaces.sectionAlt, 90)}\`
- **card:** \`${clipPresetSnippet(p.surfaces.card, 130)}\` — focaal gebruiken; open/grensloze secties zijn oké.
- **typography:** heading vs body = vaak **twee families** (zie volledige \`_design_preset.typography\` in JSON) — niet alles één sans.
- **buttons.primary:** \`${clipPresetSnippet(p.buttons.primary, 140)}\`
- **effects.gradient:** \`${clipPresetSnippet(p.effects.gradient, 120)}\`
- **effects.shadow / glow:** \`${clipPresetSnippet(p.effects.shadow, 100)}\` · \`${clipPresetSnippet(p.effects.glow, 100)}\`
- **navigation.wrapper:** \`${clipPresetSnippet(p.navigation.wrapper, 130)}\` — op de **primaire** \`<header>\`: **volledige string**, incl. \`sticky top-0\` (Lovable-standaard).
`;
}

/**
 * Prompt-blok: structuur + presets + component-mapping + strikt designcontract (naast kennisbank + §0A).
 */
export function buildStudioStructurePromptBlock(params: {
  siteConfig: SiteConfig;
  components: Record<string, string>;
  layoutArchetypes: Record<string, LayoutArchetype>;
  designPreset: DesignPreset;
  extractedFromImage?: ExtractedDesignFromImage | null;
  siteIntent: SiteIntent;
  homepagePlan: HomepagePlan;
  homepagePlanIssues?: ValidationIssue[];
  layoutOptions?: ResolverConfidenceLayoutOptions;
  compositionConflictsResolved?: string[];
  compositionConflictDecisions?: CompositionConflictDecision[];
  /** Minder Lovable-voorbeelden + korte visuele north-star (env SITE_GENERATION_MINIMAL_PROMPT). */
  minimalVisualGuidance?: boolean;
}): string {
  const extractNote = params.extractedFromImage
    ? `

=== _vision_extract (samenvatting referentiebeeld; interpreted, not copied) ===
${JSON.stringify(params.extractedFromImage, null, 2)}
`
    : "";

  const layoutBlock = buildLayoutArchetypesPromptBlock(params.layoutArchetypes, {
    sectionOrder: params.siteConfig.sections,
    compositionPlan: params.homepagePlan.compositionPlan,
  });

  const experienceBlock = buildSiteExperiencePromptBlock({
    intent: params.siteIntent,
    plan: params.homepagePlan,
    planIssues: params.homepagePlanIssues,
  });

  const aboveFoldStrategyBlock = buildAboveFoldStrategyPromptBlock({
    siteIntent: params.siteIntent,
    siteConfig: params.siteConfig,
    layoutOptions: params.layoutOptions,
    conflictsResolved: params.compositionConflictsResolved,
    conflictDecisions: params.compositionConflictDecisions,
  });

  const darkCohesionBlock = buildDarkThemeCohesionBlock(params.designPreset.themeMode);
  const darkCohesionSection = darkCohesionBlock ? `\n---\n\n${darkCohesionBlock}\n` : "";

  const minimal = Boolean(params.minimalVisualGuidance);
  const visualBlock = minimal ? LOVABLE20_VISUAL_PRIORITY_MINIMAL : LOVABLE20_VISUAL_PRIORITY;
  const examplesBlock = minimal ? "" : `${LOVABLE_EXAMPLES_COMPACT}\n\n`;

  return `${formatPersonalityPromptBlock(params.siteConfig.personality)}

${experienceBlock}

${examplesBlock}${visualBlock}

=== STUDIO STRUCTUUR (inputs) ===

_site_config (JSON):
${JSON.stringify(params.siteConfig, null, 2)}

=== CREATIVE OVERRIDE (geen invul-template) ===
- **Hiërarchie:** \`compositionPlan\` → zones/spanning; \`_layout_archetypes\` / \`_component_variants\` = sectie-vertaling (geen parallelle checklist). SaaS-tegelgevoel? Herijk beeld + type + **framing** (hairline, scherp vs zacht hoeken, overlap) — nog steeds exacte **preset**-strings op de wrappers die je kiest.
- Archetypes = springplank; mag afwijken als het merk sterker wordt. \`_site_config.sections\` kort houden; rollen mogen in **één** rijke sectie.
- **Portfolio:** alleen als \`portfolio\` (of afgesproken id) in \`_site_config.sections\` staat; anders werk in \`hero\` / \`story\`.

${layoutBlock}

${aboveFoldStrategyBlock}

_component_variants (sectie-id → benoemd patroon):
${JSON.stringify(params.components, null, 2)}

${buildDesignPresetPromptDigest(params.designPreset)}
_design_preset (geneste utility-snippets — layout, typography, buttons, surfaces, navigation, effects, sections, colors):
${JSON.stringify(params.designPreset, null, 2)}
${extractNote}
${darkCohesionSection}
---

${PREMIUM_DESIGN_SYSTEM_CONTRACT}`;
}

/**
 * Bij **upgrade / behoud lay-out** wordt geen volledige studio-JSON (preset + lovable) gedupliceerd,
 * maar de **composer** (macro-compositie + archetype-map) blijft zichtbaar — anders krijgt het model
 * geen `compositionPlan` en vallen alle sites terug op dezelfde SaaS-skeleton in §3.
 * Bestaande sectie-html komt uit de bron-JSON; dit blok stuurt vooral **nieuwe** secties en toon.
 */
export function buildStudioStructurePromptBlockForUpgrade(params: {
  siteConfig: SiteConfig;
  components: Record<string, string>;
  layoutArchetypes: Record<string, LayoutArchetype>;
  siteIntent: SiteIntent;
  homepagePlan: HomepagePlan;
  homepagePlanIssues?: ValidationIssue[];
  layoutOptions?: ResolverConfidenceLayoutOptions;
  compositionConflictsResolved?: string[];
  compositionConflictDecisions?: CompositionConflictDecision[];
  minimalVisualGuidance?: boolean;
}): string {
  const layoutBlock = buildLayoutArchetypesPromptBlock(params.layoutArchetypes, {
    sectionOrder: params.siteConfig.sections,
    compositionPlan: params.homepagePlan.compositionPlan,
  });
  const experienceBlock = buildSiteExperiencePromptBlock({
    intent: params.siteIntent,
    plan: params.homepagePlan,
    planIssues: params.homepagePlanIssues,
  });

  const aboveFoldStrategyBlock = buildAboveFoldStrategyPromptBlock({
    siteIntent: params.siteIntent,
    siteConfig: params.siteConfig,
    layoutOptions: params.layoutOptions,
    conflictsResolved: params.compositionConflictsResolved,
    conflictDecisions: params.compositionConflictDecisions,
  });

  const visualBlock = params.minimalVisualGuidance
    ? LOVABLE20_VISUAL_PRIORITY_MINIMAL
    : LOVABLE20_VISUAL_PRIORITY;

  return `=== UPGRADE — STUDIO COMPOSER (macro + sectie-archetypes) ===
**Belangrijk:** Secties die al in de bron-JSON staan: **html ongewijzigd** volgens upgrade-regels in §1.
Gebruik **compositionPlan** en \`_layout_archetypes\` hieronder om **nieuwe** secties vorm te geven en om te voorkomen dat elke run dezelfde generieke indeling kiest.

${experienceBlock}

${visualBlock}

${layoutBlock}

${aboveFoldStrategyBlock}

_component_variants (sectie-id → patroonnaam; voor nieuwe markup waar passend):
${JSON.stringify(params.components, null, 2)}
`;
}

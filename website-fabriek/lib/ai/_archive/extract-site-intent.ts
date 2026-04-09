import { ensureSiteIntentAboveFoldFields } from "@/lib/ai/ensure-site-intent-above-fold";
import { interpretPromptHeuristicOnly } from "@/lib/ai/interpret-prompt-heuristic";
import { preparePromptForInterpretation } from "@/lib/ai/prompt-normalization";
import { resolveSiteIntentFromInterpretation } from "@/lib/ai/resolve-site-intent-from-interpretation";
import type { SiteIntent } from "@/lib/ai/site-experience-model";

export { experienceModelLayoutGroup } from "@/lib/ai/above-fold-archetypes";

/**
 * Heuristische site-intent **zonder** Claude — zelfde pad als `runPromptInterpretationPipeline`
 * (normalisatie → `interpretPromptHeuristicOnly` → `resolveSiteIntentFromInterpretation`).
 */
export function extractSiteIntentFromPrompt(userPrompt: string): SiteIntent {
  const { normalized } = preparePromptForInterpretation(userPrompt);
  const { interpretation, profile } = interpretPromptHeuristicOnly(normalized);
  return ensureSiteIntentAboveFoldFields(
    resolveSiteIntentFromInterpretation(interpretation, normalized, profile),
    { interpretation, profile },
  );
}

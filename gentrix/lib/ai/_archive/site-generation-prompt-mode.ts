/**
 * Minimale site-generatie prompt: minder herhaling en “inspiratie”-blokken,zelfde harde output-regels.
 *
 * Zet in `.env.local`: SITE_GENERATION_MINIMAL_PROMPT=1
 */
export function isMinimalSiteGenerationPrompt(): boolean {
  const v = process.env.SITE_GENERATION_MINIMAL_PROMPT?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

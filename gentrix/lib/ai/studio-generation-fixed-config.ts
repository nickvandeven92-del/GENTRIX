/**
 * Vaste studio-instellingen voor **site-generatie** (modellen, tokens; self-review zie `STUDIO_SELF_REVIEW`).
 *
 * Geheimen en infrastructuur blijven via omgeving o.a.:
 * - `ANTHROPIC_API_KEY`
 * - optioneel `GOOGLE_AI_STUDIO_API` (of `GEMINI_API_KEY`) + Supabase voor AI-hero; fallback `OPENAI_API_KEY` (zie `.env.example`)
 * - `STUDIO_SELF_REVIEW=1` (optioneel) — tweede LLM-pass na generatie; zie `selfReviewEnabled` hieronder.
 * - database / Supabase
 */
function readSelfReviewEnabledFromEnv(): boolean {
  return process.env.STUDIO_SELF_REVIEW === "1";
}

export const STUDIO_SITE_GENERATION = {
  generateModel: "claude-sonnet-4-6",
  supportModel: "claude-haiku-4-5-20251001",
  /**
   * Claude `max_tokens` voor de hoofd-stream.
   *
   * Multipage (`marketingPages` + landing + `contactSections`) levert één groot JSON-object met veel
   * Tailwind-HTML; ~20k tokens was in de praktijk te weinig → `max_tokens`-stop halverwege → gebroken JSON.
   * Nieuwere Sonnet-modellen ondersteunen veel hogere output; streaming omzeilt de non-stream SDK-timeout.
   */
  maxOutputTokens: 64_000,
  briefingVisionEnabled: true,
  /**
   * Tweede LLM-pass (HTML-QA, hero, nav). Zet `STUDIO_SELF_REVIEW=1` in `.env.local` (betaalde/kwaliteitsflows);
   * standaard uit: geen dubbele Sonnet-kosten op previews.
   * Model: `selfReviewModel` (Sonnet; Haiku is te zwak voor visuele HTML-QA-JSON).
   */
  get selfReviewEnabled(): boolean {
    return readSelfReviewEnabledFromEnv();
  },
  selfReviewModel: "claude-sonnet-4-6" as const,
} as const;

/**
 * Vaste studio-instellingen voor **site-generatie** (één bron van waarheid, geen env-schakelaars).
 *
 * Geheimen en infrastructuur blijven via omgeving o.a.:
 * - `ANTHROPIC_API_KEY`
 * - optioneel `GOOGLE_AI_STUDIO_API` (of `GEMINI_API_KEY`) + Supabase voor AI-hero; fallback `OPENAI_API_KEY` (zie `.env.example`)
 * - database / Supabase
 */
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
  /** Standaard geen minimale prompt; `minimalPrompt: true` in de API-request wint. */
  minimalPromptDefault: false,
  briefingVisionEnabled: true,
  /** Kleine JSON-planfase vóór HTML: copy-budget + CTA; sectie-id's blijven server-side vast. */
  compositionPlanEnabled: true,
  selfReviewEnabled: false,
  /**
   * Site-studio: sectie-voor-sectie generatie + merge + finale check (meerdere POST’s, geen NDJSON-stream).
   * Vereist migratie `site_generation_chunk_sessions`. Zet op `false` om terug te vallen op één NDJSON-stream.
   */
  siteGenerationChunkedEnabled: true,
} as const;

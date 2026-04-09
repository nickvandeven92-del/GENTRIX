/**
 * Leest ANTHROPIC_API_KEY robuust (trim; lege string na trim telt als ontbrekend).
 */
export function getAnthropicApiKey(): string | undefined {
  const raw = process.env.ANTHROPIC_API_KEY;
  if (raw == null) return undefined;
  const t = raw.trim();
  return t.length > 0 ? t : undefined;
}

/** Korte uitleg voor foutmeldingen als de key niet geladen wordt. */
export const ANTHROPIC_KEY_MISSING_USER_HINT =
  "Controleer: .env.local staat in de projectroot website-fabriek (naast package.json), regel exact ANTHROPIC_API_KEY=... zonder # ervoor, sla op en herstart npm run dev. Open in Cursor de map website-fabriek als workspace, niet alleen Documents. Op Vercel/hosting: zet de variabele in het hosting-dashboard.";

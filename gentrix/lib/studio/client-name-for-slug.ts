import { slugify } from "@/lib/slug";
import { deriveStudioBusinessNameFromBriefing } from "@/lib/studio/derive-studio-business-name";
import { isStudioUndecidedBrandName } from "@/lib/studio/studio-brand-sentinel";

/**
 * Zinnen die duidelijk een briefing/instructie zijn (niet de bedrijfsnaam).
 * Stopt het meenemen van lange prompts in de URL-slug.
 */
const INSTRUCTION_SENTENCE_START =
  /^(voeg|zet|maak|gebruik|wijzig|pas|breng|integreer|plaats|update|verwijder|toon|schrijf|zorg|upload|download|verwerk|houd|geef|werk|voer|stel|kies|vermeld|noteer|verplaats|kopieer|vervang|check|controleer|implementeer)\b/i;

function stripInstructionTailSentences(text: string): string {
  const t = text.trim();
  if (!t) return t;
  const parts = t.split(/(?<=[.!?])\s+/);
  const kept: string[] = [];
  for (const p of parts) {
    const seg = p.trim();
    if (!seg) continue;
    if (INSTRUCTION_SENTENCE_START.test(seg)) break;
    kept.push(seg);
  }
  const joined = kept.join(" ").trim();
  return joined || t;
}

/**
 * Veel studio-prompts: "MoSham kapper in Vught …" — voor de slug alleen het merk vóór het beroep.
 */
function extractBrandBeforeProfessionHint(text: string): string {
  const t = text.trim();
  if (!t) return t;
  const m = t.match(/^(.+?)\s+(?:kapper|kapsalon|barbershop|barber)\b/i);
  if (m?.[1]) {
    const part = m[1].trim();
    if (part.length >= 2) return part;
  }
  return t;
}

/**
 * Afgeleide URL-slug uit het klantnaamveld, ook als daar een lange briefing in staat.
 * Combineert dezelfde signalen als de site-studio (`deriveStudioBusinessNameFromBriefing`)
 * met eenvoudige heuristieken voor typische kapper-/promptregels.
 */
export function slugifyClientNameForSubfolder(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "";

  let source = deriveStudioBusinessNameFromBriefing(trimmed);
  if (!source || isStudioUndecidedBrandName(source)) {
    const stripped = stripInstructionTailSentences(trimmed);
    source = extractBrandBeforeProfessionHint(stripped);
  }
  return slugify(source);
}

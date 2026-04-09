/**
 * Lichte copy-nudge — minder micromanagement dan voorheen; CONTENT AUTHORITY blijft leidend voor feiten.
 */

import type { DesignPersonality } from "@/lib/ai/design-personality";

function fnv1aHash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const THIN_BRIEF_THRESHOLD = 120;

const HOOK_HINTS = [
  "Hero: liever **uitkomst of spanning** dan een begroeting als openingszin.",
  "Hero: mag **contrast** (“niet X, wel Y”) als het past bij de branche.",
  "Subkop of eyebrow: mag **één scherpe vraag** — beantwoord die in de body.",
  "Mag **herkenbaar scenario** schetsen zonder valse cijfers (gebruik “vaak/meestal” zonder data).",
] as const;

const PERSONALITY_ONE_LINERS: Record<DesignPersonality, string> = {
  bold_industrial: "Toon: direct, kort.",
  elegant_luxury: "Toon: ingehouden, precies.",
  playful_creative: "Toon: warm, volwassen.",
  minimal_tech: "Toon: helder, weinig opsmuk.",
  editorial_art: "Toon: magazine-ritme.",
  trust_conversion: "Toon: concreet; geen holle #1 zonder onderbouwing in de briefing.",
};

export type AntiGenericCopyContext = {
  personality?: DesignPersonality;
  targetAudience?: string;
  primaryGoal?: string;
  brandStyle?: string;
};

export type BuildAntiGenericCopyPromptInput = {
  businessName: string;
  description: string;
  recentClientNames: string[];
  varianceNonce?: string;
  /** Eén regel i.p.v. hook-roter + personality-regels. */
  minimal?: boolean;
} & AntiGenericCopyContext;

export function buildAntiGenericCopyPromptBlock(input: BuildAntiGenericCopyPromptInput): string {
  if (input.minimal) {
    return `=== COPY (compact) ===
- Sterke, eerlijke NL-copy; geen “Welkom bij …” als vaste opener; varieer CTA’s. Feiten alleen volgens CONTENT AUTHORITY.
`;
  }

  const salt = `${input.businessName.trim()}\n${input.description.trim().slice(0, 200)}\n${input.recentClientNames.join(",")}\n${input.varianceNonce ?? ""}`;
  const h = fnv1aHash(salt);
  const hook = HOOK_HINTS[h % HOOK_HINTS.length]!;

  const thinBrief =
    input.description.trim().length < THIN_BRIEF_THRESHOLD
      ? `\nKorte briefing: vul **plausibel** aan (werkwoorden, aanpak) — **geen** verzonnen namen, awards, harde stats.`
      : "";

  const extra: string[] = [];
  if (input.personality != null) {
    extra.push(PERSONALITY_ONE_LINERS[input.personality]);
  }
  if (input.targetAudience?.trim()) {
    extra.push(`Doelgroep: ${input.targetAudience.trim().replace(/"/g, "'").slice(0, 120)}`);
  }
  if (input.primaryGoal?.trim()) {
    extra.push(`Conversie: ${input.primaryGoal.trim().replace(/_/g, " ")}`);
  }
  if (input.brandStyle?.trim()) {
    extra.push(`Preset: ${input.brandStyle.trim().replace(/`/g, "'").slice(0, 80)}`);
  }

  return `=== COPY (vrij, maar eerlijk) ===
- ${hook}
- Vermijd “Welkom bij …” als eerste zin; varieer CTA-teksten (geen eindeloos “Meer informatie” als hoofdknop).
- ${extra.length ? `${extra.join(" · ")}\n- ` : ""}Alle **feiten** volgens CONTENT AUTHORITY.${thinBrief}`;
}

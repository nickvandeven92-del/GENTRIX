import type { CompactnessProfile } from "@/types/pageCompactness";

/**
 * Paragraaf inkorten: bij voorkeur op zin-grens, anders woord-grens + ellipsis.
 */
export function compressText(text: string, c: CompactnessProfile): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean || clean.length <= c.maxParagraphChars) return clean;

  const sliced = clean.slice(0, c.maxParagraphChars);
  const lastPunctuation = Math.max(
    sliced.lastIndexOf(". "),
    sliced.lastIndexOf("! "),
    sliced.lastIndexOf("? "),
  );

  if (lastPunctuation > 80) {
    return sliced.slice(0, lastPunctuation + 1).trim();
  }

  const lastSpace = sliced.lastIndexOf(" ");
  return `${sliced.slice(0, lastSpace > 0 ? lastSpace : c.maxParagraphChars).trim()}…`;
}

export function compressCopyBlock(
  input: { title?: string; body?: string; bullets?: string[] },
  c: CompactnessProfile,
): { title?: string; body?: string; bullets?: string[] } {
  return {
    title: input.title?.trim(),
    body: input.body ? compressText(input.body, c) : undefined,
    bullets: input.bullets
      ?.map((bullet) => bullet.trim())
      .filter(Boolean)
      .slice(0, c.maxBulletsPerCard),
  };
}

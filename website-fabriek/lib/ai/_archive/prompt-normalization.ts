/**
 * Fase 1: prompt opschonen zonder betekenis te verliezen.
 * Geen semantiek — alleen robuustheid voor downstream matching.
 */

const MULTISPACE = /\s+/g;
const SOFT_PUNCT = /[\u2018\u2019\u201C\u201D]/g;

/** Vereenvoudigt accenten voor matching (é ≠ e in indexOf-loops). */
export function foldAccents(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "");
}

export function normalizePrompt(raw: string): string {
  let t = raw.trim();
  if (!t) return "";
  t = t.replace(SOFT_PUNCT, "'");
  t = foldAccents(t).toLowerCase();
  t = t.replace(MULTISPACE, " ");
  return t;
}

/** Originele prompt + genormaliseerde variant voor frasen die op casing rusten. */
export function preparePromptForInterpretation(raw: string): {
  original: string;
  normalized: string;
  folded: string;
} {
  const original = raw.trim();
  const normalized = normalizePrompt(original);
  return {
    original,
    normalized,
    folded: normalized,
  };
}

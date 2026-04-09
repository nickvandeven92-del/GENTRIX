const LAYOUT_ONLY = /^\s*(grid|flex|columns?|rows?|spacing|padding|margin|stack|responsive|mobile|desktop|layout|center|align|gap)\b/i;

const VAGUE_PHRASES =
  /\b(better|improve|make it (nice|better|pop)|more professional|engaging|compelling|stronger|cleaner|modernize|update|fix it|good copy)\b/i;

const AI_FILLER =
  /\b(as an ai|leverage|delve|robust solution|cutting-?edge|synergy|best-?in-?class|world-?class|unlock|elevate your)\b/i;

const BOILERPLATE = /\b(lorem ipsum|placeholder|todo|tbd|xxx)\b/i;

function normalizeWords(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

/** Jaccard-achtige overlap op woorden (0–1). */
function wordSetOverlap(a: string, b: string): number {
  const wa = new Set(normalizeWords(a));
  const wb = new Set(normalizeWords(b));
  if (wa.size === 0 || wb.size === 0) return 0;
  let inter = 0;
  for (const w of wa) {
    if (wb.has(w)) inter++;
  }
  const union = wa.size + wb.size - inter;
  return union === 0 ? 0 : inter / union;
}

export type CopyIntentLintCode =
  | "copyIntent.layout_only"
  | "copyIntent.vague"
  | "copyIntent.ai_filler"
  | "copyIntent.boilerplate"
  | "copyIntent.redundant_section_name";

export function analyzeCopyIntent(
  copyIntent: string,
  sectionName: string,
): { code: CopyIntentLintCode; message: string } | null {
  const t = copyIntent.trim();
  if (t.length < 4) return null;

  if (LAYOUT_ONLY.test(t)) {
    return {
      code: "copyIntent.layout_only",
      message: "copyIntent beschrijft vooral layout/structuur, geen inhoudelijke copyrichting.",
    };
  }
  if (VAGUE_PHRASES.test(t)) {
    return {
      code: "copyIntent.vague",
      message: "copyIntent is vaag (verbeter/algemeen) — specificeer doel, toon of boodschap.",
    };
  }
  if (AI_FILLER.test(t)) {
    return {
      code: "copyIntent.ai_filler",
      message: "copyIntent bevat generieke AI-/marketingjargon; formuleer concreet voor deze sectie.",
    };
  }
  if (BOILERPLATE.test(t)) {
    return {
      code: "copyIntent.boilerplate",
      message: "copyIntent lijkt placeholder-tekst.",
    };
  }
  if (wordSetOverlap(t, sectionName) >= 0.72) {
    return {
      code: "copyIntent.redundant_section_name",
      message: "copyIntent overlapt sterk met sectionName — voeg richting toe (doel, publiek, toon).",
    };
  }
  return null;
}

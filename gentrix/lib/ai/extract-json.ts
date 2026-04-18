import { jsonrepair } from "jsonrepair";

/**
 * Snijdt vanaf `start` (eerste `{`) het JSON-object af op de bijbehorende sluitende `}`,
 * rekening houdend met strings en escapes — anders pakt `lastIndexOf("}")` een `}` in `html`-velden.
 */
function sliceBalancedJsonObject(text: string, start: number): string | null {
  if (start < 0 || start >= text.length || text[start] !== "{") return null;

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < text.length; i++) {
    const c = text[i];

    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (c === "\\") {
        escape = true;
        continue;
      }
      if (c === '"') {
        inString = false;
      }
      continue;
    }

    if (c === '"') {
      inString = true;
      continue;
    }

    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }

  return null;
}

function extractFromMarkdownFences(text: string): string | null {
  const re = /```(?:json)?\s*([\s\S]*?)```/gi;
  const blocks: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    blocks.push(m[1].trim());
  }
  // Laatste fence eerst: modellen zetten vaak een voorbeeld vóór de echte JSON.
  for (let i = blocks.length - 1; i >= 0; i--) {
    const inner = blocks[i];
    const open = inner.indexOf("{");
    const balanced = sliceBalancedJsonObject(inner, open);
    if (balanced) return balanced;
  }
  return null;
}

/**
 * Haalt één JSON-object uit model-output (fences overal in tekst, of eerste `{` … balans-sluiting).
 */
export function extractJsonObjectString(text: string): string {
  const trimmed = text.trim().replace(/^\uFEFF/, "");

  const fenced = extractFromMarkdownFences(trimmed);
  if (fenced) return fenced;

  const start = trimmed.indexOf("{");
  const balanced = sliceBalancedJsonObject(trimmed, start);
  if (balanced) return balanced;

  /**
   * Geen `lastIndexOf("}")`-slice: bij site-JSON staan talloze `}` in HTML-strings; dat leverde
   * syntactisch onzinfragmenten + misleidende parse-fouten op terwijl de stream wél lang was.
   */
  if (start !== -1) return trimmed.slice(start);
  return trimmed;
}

/**
 * Probeert JSON uit modeltekst te parsen: extractie, strikte parse, daarna `jsonrepair` bij fouten
 * (trailing comma's, smart quotes, ontsnapte newlines in strings, enz.).
 */
export function parseModelJsonObject(fullText: string): { ok: true; value: unknown } | { ok: false } {
  const extracted = extractJsonObjectString(fullText);
  try {
    return { ok: true, value: JSON.parse(extracted) };
  } catch {
    try {
      const repaired = jsonrepair(extracted);
      return { ok: true, value: JSON.parse(repaired) };
    } catch {
      return { ok: false };
    }
  }
}

/**
 * Haalt een JSON-array uit model-output (fenced block of eerste `[` … balans-sluiting).
 */
export function extractJsonArrayString(text: string): string {
  const trimmed = text.trim().replace(/^\uFEFF/, "");

  const fenceMatch = trimmed.match(/```(?:json)?\s*\r?\n?([\s\S]*?)\r?\n?```$/);
  if (fenceMatch?.[1]) {
    const inner = fenceMatch[1].trim();
    const arr = sliceBalancedArray(inner, inner.indexOf("["));
    if (arr) return arr;
  }

  const multiFence = /```(?:json)?\s*([\s\S]*?)```/gi;
  let m: RegExpExecArray | null;
  while ((m = multiFence.exec(trimmed)) !== null) {
    const inner = m[1].trim();
    const open = inner.indexOf("[");
    const balanced = sliceBalancedArray(inner, open);
    if (balanced) return balanced;
  }

  const start = trimmed.indexOf("[");
  const balanced = sliceBalancedArray(trimmed, start);
  if (balanced) return balanced;

  const end = trimmed.lastIndexOf("]");
  if (start !== -1 && end > start) {
    return trimmed.slice(start, end + 1);
  }
  return trimmed;
}

function sliceBalancedArray(text: string, start: number): string | null {
  if (start < 0 || start >= text.length || text[start] !== "[") return null;

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < text.length; i++) {
    const c = text[i];

    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (c === "\\") {
        escape = true;
        continue;
      }
      if (c === '"') {
        inString = false;
      }
      continue;
    }

    if (c === '"') {
      inString = true;
      continue;
    }

    if (c === "[") depth++;
    else if (c === "]") {
      depth--;
      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }

  return null;
}

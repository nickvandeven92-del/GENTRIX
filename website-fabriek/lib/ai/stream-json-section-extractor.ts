import { tailwindPageConfigSchema, type TailwindPageConfig } from "@/lib/ai/tailwind-sections-schema";

/**
 * Probeert complete objecten uit de `sections`-array te lezen terwijl Claude nog streamt.
 * Werkt alleen betrouwbaar zolang JSON-stringregels correct ge-escaped zijn (standaard model-output).
 *
 * Geen regex op ruwe `"html": "..."` — geneste aanhalingstekens en escapes in Tailwind-markup
 * breken daarbij snel; we slicen eerst complete `{...}` objecten en gebruiken `JSON.parse`.
 */

export type StreamingTailwindSection = {
  id: string;
  html: string;
  sectionName?: string;
};

/** Eén JSON-waarde (object of array) vanaf `start` ({ of [). */
export function extractNextJsonValue(s: string, start: number): { end: number; text: string } | null {
  let i = start;
  while (i < s.length && /\s/.test(s[i])) i++;
  if (i >= s.length) return null;
  const c0 = s[i];
  if (c0 !== "{" && c0 !== "[") return null;

  const stack: string[] = [c0 === "{" ? "}" : "]"];
  let inString = false;
  let escape = false;
  const begin = i;
  i++;

  while (i < s.length) {
    const c = s[i];
    if (escape) {
      escape = false;
      i++;
      continue;
    }
    if (inString) {
      if (c === "\\") escape = true;
      else if (c === '"') inString = false;
      i++;
      continue;
    }
    if (c === '"') {
      inString = true;
      i++;
      continue;
    }
    if (c === "{") stack.push("}");
    else if (c === "[") stack.push("]");
    else if (c === "}" || c === "]") {
      const want = stack.pop();
      if (!want || c !== want) return null;
      if (stack.length === 0) {
        return { end: i + 1, text: s.slice(begin, i + 1) };
      }
    }
    i++;
  }

  return null;
}

/**
 * Zoekt `"sections":[` en parse daar complete top-level objecten uit.
 * `sentIds` voorkomt dubbele emits bij herhaalde scans.
 */
export function tryExtractCompletedSections(
  buffer: string,
  sentIds: Set<string>,
): { newSections: StreamingTailwindSection[] } {
  const newSections: StreamingTailwindSection[] = [];
  const re = /"sections"\s*:\s*\[/;
  const m = re.exec(buffer);
  if (!m) return { newSections };

  let pos = m.index + m[0].length;

  while (pos < buffer.length) {
    while (pos < buffer.length && /[\s,\n\r]/.test(buffer[pos])) pos++;
    if (pos >= buffer.length) break;
    if (buffer[pos] === "]") break;

    const ex = extractNextJsonValue(buffer, pos);
    if (!ex) break;

    try {
      const obj = JSON.parse(ex.text) as Record<string, unknown>;
      const id = typeof obj.id === "string" ? obj.id : null;
      const html = typeof obj.html === "string" ? obj.html : null;
      if (id && html && !sentIds.has(id)) {
        sentIds.add(id);
        const section: StreamingTailwindSection = { id, html };
        if (typeof obj.sectionName === "string") section.sectionName = obj.sectionName;
        newSections.push(section);
      }
    } catch {
      /* onvolledig of geen sectie-object */
    }
    pos = ex.end;
  }

  return { newSections };
}

/**
 * Parse `config` uit de stream-buffer zodra het object compleet is.
 * Zoekt alleen vóór `"sections":[` om te voorkomen dat `"config":` in sectie-HTML per ongeluk matcht.
 */
export function tryExtractStreamingTailwindConfig(buffer: string): TailwindPageConfig | null {
  const sectionsMatch = buffer.match(/"sections"\s*:\s*\[/);
  const prefix =
    sectionsMatch && sectionsMatch.index != null ? buffer.slice(0, sectionsMatch.index) : buffer;
  const m = /"config"\s*:\s*/.exec(prefix);
  if (!m) return null;
  const start = m.index + m[0].length;
  const ex = extractNextJsonValue(buffer, start);
  if (!ex) return null;
  try {
    const obj = JSON.parse(ex.text) as unknown;
    const parsed = tailwindPageConfigSchema.safeParse(obj);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

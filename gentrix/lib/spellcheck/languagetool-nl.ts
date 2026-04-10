import { extractPlainTextFromHtml } from "@/lib/spellcheck/extract-plain-text-from-html";

const LT_DEFAULT_BASE = "https://api.languagetool.org/v2";
/** Ruim onder de gangbare limieten van de publieke LanguageTool-API. */
const MAX_CHUNK_CHARS = 12_000;

type LtReplacement = { value: string };
type LtMatch = {
  offset: number;
  length: number;
  message: string;
  shortMessage?: string;
  replacements?: LtReplacement[];
  context?: { text: string; offset: number };
  rule?: { id?: string; description?: string };
};

type LtCheckResponse = { matches?: LtMatch[] };

export type DutchSpellIssue = {
  sectionId: string;
  message: string;
  offsetInChunk: number;
  length: number;
  suggestion: string | null;
  highlightedSnippet: string;
};

function getLtBaseUrl(): string {
  const raw = process.env.LANGUAGETOOL_API_URL?.trim();
  if (!raw || !raw.startsWith("http")) {
    return LT_DEFAULT_BASE;
  }
  let u = raw.replace(/\/$/, "");
  if (u.endsWith("/check")) {
    u = u.slice(0, -"/check".length);
  }
  return u;
}

function chunkPlainText(plain: string): string[] {
  if (plain.length <= MAX_CHUNK_CHARS) {
    return plain.length > 0 ? [plain] : [];
  }
  const chunks: string[] = [];
  let start = 0;
  while (start < plain.length) {
    let end = Math.min(start + MAX_CHUNK_CHARS, plain.length);
    if (end < plain.length) {
      const lastSpace = plain.lastIndexOf(" ", end);
      if (lastSpace > start + 2000) {
        end = lastSpace;
      }
    }
    const slice = plain.slice(start, end).trim();
    if (slice.length > 0) {
      chunks.push(slice);
    }
    start = end;
  }
  return chunks;
}

async function callLanguageTool(text: string): Promise<LtMatch[]> {
  const endpoint = `${getLtBaseUrl()}/check`;
  const body = new URLSearchParams();
  body.set("text", text);
  body.set("language", "nl");

  const user = process.env.LANGUAGETOOL_USERNAME?.trim();
  const key = process.env.LANGUAGETOOL_API_KEY?.trim();
  if (user && key) {
    body.set("username", user);
    body.set("apiKey", key);
  }

  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 25_000);
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      signal: ac.signal,
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`LanguageTool HTTP ${res.status}${errText ? `: ${errText.slice(0, 200)}` : ""}`);
    }
    const json = (await res.json()) as LtCheckResponse;
    return json.matches ?? [];
  } finally {
    clearTimeout(t);
  }
}

function buildSnippet(chunk: string, offset: number, length: number): string {
  const pad = 40;
  const from = Math.max(0, offset - pad);
  const to = Math.min(chunk.length, offset + length + pad);
  const slice = chunk.slice(from, to);
  const rel = offset - from;
  const before = slice.slice(0, rel);
  const word = slice.slice(rel, rel + length);
  const after = slice.slice(rel + length);
  return `${before}【${word}】${after}`;
}

/**
 * Controleert zichtbare tekst per sectie via LanguageTool (nl).
 * Wijzigt geen HTML; alleen een lijst met suggesties.
 */
export async function checkDutchSpellingForSectionHtml(
  sections: { id: string; html: string }[],
): Promise<DutchSpellIssue[]> {
  const issues: DutchSpellIssue[] = [];

  for (const { id, html } of sections) {
    const plain = extractPlainTextFromHtml(html);
    const chunks = chunkPlainText(plain);
    for (const chunk of chunks) {
      const matches = await callLanguageTool(chunk);
      for (const m of matches) {
        const first = m.replacements?.[0]?.value ?? null;
        issues.push({
          sectionId: id,
          message: m.message,
          offsetInChunk: m.offset,
          length: m.length,
          suggestion: first,
          highlightedSnippet: buildSnippet(chunk, m.offset, m.length),
        });
      }
    }
  }

  return issues;
}

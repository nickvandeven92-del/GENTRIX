import type { GenerateSiteStreamNdjsonEvent } from "@/lib/ai/generate-site-with-claude";

export type { GenerateSiteStreamNdjsonEvent };

/** @deprecated Gebruik NDJSON; alleen voor backwards-compat parsing. */
export type GenerateSiteSseEvent =
  | { type: "delta"; text: string }
  | { type: "complete"; outputFormat: "tailwind_sections"; data: import("@/lib/ai/tailwind-sections-schema").GeneratedTailwindPage }
  | { type: "complete"; outputFormat: "react_sections"; data: import("@/lib/site/react-site-schema").ReactSiteDocument }
  | { type: "error"; error: string; rawText?: string };

export function encodeGenerateSiteNdjsonLine(event: GenerateSiteStreamNdjsonEvent): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(event)}\n`);
}

/**
 * Verwerkt binnenkomende stream-bytes als NDJSON (regel = één JSON-object).
 * Onvolledige laatste regel blijft in buffer.
 */
export function consumeGenerateSiteNdjsonBuffer(
  buffer: string,
  chunk: string,
  onEvent: (e: GenerateSiteStreamNdjsonEvent) => void,
): string {
  let next = buffer + chunk;
  const lines = next.split("\n");
  const rest = lines.pop() ?? "";
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    try {
      onEvent(JSON.parse(t) as GenerateSiteStreamNdjsonEvent);
    } catch {
      /* negeer */
    }
  }
  return rest;
}

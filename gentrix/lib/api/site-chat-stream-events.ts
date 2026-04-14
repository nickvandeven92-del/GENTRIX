import type { SiteChatStreamNdjsonEvent } from "@/lib/ai/site-chat-with-claude";

export type { SiteChatStreamNdjsonEvent };

/**
 * Verwerkt binnenkomende stream-bytes als NDJSON (regel = één JSON-object).
 * Onvolledige laatste regel blijft in buffer.
 */
export function consumeSiteChatNdjsonBuffer(
  buffer: string,
  chunk: string,
  onEvent: (e: SiteChatStreamNdjsonEvent) => void,
): string {
  const next = buffer + chunk;
  const lines = next.split("\n");
  const rest = lines.pop() ?? "";
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    try {
      onEvent(JSON.parse(t) as SiteChatStreamNdjsonEvent);
    } catch {
      /* negeer */
    }
  }
  return rest;
}

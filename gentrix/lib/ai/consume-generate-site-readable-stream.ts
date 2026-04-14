import type { GeneratedTailwindPage } from "@/lib/ai/tailwind-sections-schema";
import { consumeGenerateSiteNdjsonBuffer } from "@/lib/api/generate-site-stream-events";
import type { GenerateSiteStreamNdjsonEvent } from "@/lib/ai/generate-site-with-claude";

export type ConsumeGenerateSiteStreamResult =
  | { ok: true; data: GeneratedTailwindPage }
  | { ok: false; error: string; rawText?: string };

/**
 * Leest de NDJSON-stream van `createGenerateSiteReadableStream` tot `complete` of `error`.
 * Gebruikt door async jobs (geen lange HTTP-response naar de browser).
 */
export async function consumeGenerateSiteReadableStream(
  stream: ReadableStream<Uint8Array>,
  onEvent?: (e: GenerateSiteStreamNdjsonEvent) => void,
): Promise<ConsumeGenerateSiteStreamResult> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let completed: GeneratedTailwindPage | null = null;
  let lastError: { error: string; rawText?: string } | undefined;

  const handle = (ev: GenerateSiteStreamNdjsonEvent) => {
    onEvent?.(ev);
    if (ev.type === "complete" && ev.outputFormat === "tailwind_sections") {
      completed = ev.data;
    }
    if (ev.type === "error") {
      lastError = { error: ev.message, rawText: ev.rawText };
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer = consumeGenerateSiteNdjsonBuffer(buffer, decoder.decode(value, { stream: true }), handle);
    }
    if (buffer.trim()) {
      buffer = consumeGenerateSiteNdjsonBuffer(buffer, "\n", handle);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }

  if (completed != null) {
    return { ok: true, data: completed };
  }
  if (lastError != null) {
    return { ok: false, error: lastError.error, rawText: lastError.rawText };
  }
  return { ok: false, error: "Stream eindigde zonder complete of error." };
}

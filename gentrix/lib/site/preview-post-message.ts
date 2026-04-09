/** Moet gelijk lopen aan het script in buildTailwindIframeSrcDoc. */
export const STUDIO_PREVIEW_POST_MESSAGE_SOURCE = "studio-tailwind-preview" as const;

export type StudioPreviewPostMessage =
  | { source: typeof STUDIO_PREVIEW_POST_MESSAGE_SOURCE; type: "studio-preview-ready" }
  | { source: typeof STUDIO_PREVIEW_POST_MESSAGE_SOURCE; type: "studio-preview-height"; height: number };

export function isStudioPreviewPostMessage(data: unknown): data is StudioPreviewPostMessage {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  if (d.source !== STUDIO_PREVIEW_POST_MESSAGE_SOURCE || typeof d.type !== "string") return false;
  if (d.type === "studio-preview-ready") return true;
  if (d.type === "studio-preview-height") {
    return typeof d.height === "number" && Number.isFinite(d.height) && d.height > 0;
  }
  return false;
}

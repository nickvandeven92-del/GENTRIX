/** Moet gelijk lopen aan `GENTRIX_IFRAME_ANALYTICS_SCRIPT` in `tailwind-page-html.ts`. */
export const GENTRIX_IFRAME_ANALYTICS_SOURCE = "gentrix-iframe-analytics" as const;

export type GentrixIframeToParentMessage =
  | { source: typeof GENTRIX_IFRAME_ANALYTICS_SOURCE; type: "gentrix_iframe_ready"; page_path: string }
  | {
      source: typeof GENTRIX_IFRAME_ANALYTICS_SOURCE;
      type: "gentrix_site_scroll";
      /** 25, 50, 75, 100 */
      depth_pct: 25 | 50 | 75 | 100;
      page_path: string;
    };

export function isGentrixIframeToParentMessage(data: unknown): data is GentrixIframeToParentMessage {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  if (d.source !== GENTRIX_IFRAME_ANALYTICS_SOURCE) return false;
  if (d.type === "gentrix_iframe_ready")
    return typeof d.page_path === "string" && d.page_path.length > 0;
  if (d.type === "gentrix_site_scroll") {
    const dp = d.depth_pct;
    if (dp !== 25 && dp !== 50 && dp !== 75 && dp !== 100) return false;
    return typeof d.page_path === "string" && d.page_path.length > 0;
  }
  return false;
}

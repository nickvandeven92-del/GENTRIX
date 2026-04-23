"use client";

import { useEffect } from "react";
import { isGentrixAnalyticsEnabled, trackGentrixEvent } from "@/lib/analytics/gentrix-analytics";
import { isGentrixIframeToParentMessage } from "@/lib/analytics/iframe-messages";

/**
 * Vangt postMessage uit de tailwind-`srcDoc`-iframe (portaal site-preview) en stuurt PostHog-events.
 */
export function GentrixIframeAnalyticsListener() {
  useEffect(() => {
    if (!isGentrixAnalyticsEnabled() || typeof window === "undefined") return;
    const onMessage = (ev: MessageEvent) => {
      if (ev.origin !== window.location.origin && ev.origin !== "null") return;
      if (!isGentrixIframeToParentMessage(ev.data)) return;
      const d = ev.data;
      if (d.type === "gentrix_iframe_ready") {
        trackGentrixEvent("client_portal_preview_ready", { path: d.page_path });
        return;
      }
      if (d.type === "gentrix_site_scroll") {
        trackGentrixEvent("site_scroll_depth", {
          depth_pct: d.depth_pct,
          path: d.page_path,
        });
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return null;
}

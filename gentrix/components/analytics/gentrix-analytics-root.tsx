"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import {
  captureGentrixPageview,
  initGentrixAnalytics,
  isGentrixAnalyticsEnabled,
  inferGentrixContextFromPath,
  setGentrixPageContext,
} from "@/lib/analytics/gentrix-analytics";

/**
 * PostHog + route-context. Draait in `app/layout`; specifiekere context (bijv. /site) zet
 * children eerder via `setGentrixPageContext` in effects (React: diepe effects vóór voorouders).
 */
export function GentrixAnalyticsRoot() {
  const pathname = usePathname();
  const search = useSearchParams();
  const prev = useRef<string | null>(null);

  useEffect(() => {
    if (!isGentrixAnalyticsEnabled()) return;
    initGentrixAnalytics();
  }, []);

  const path = pathname ?? "/";
  const s = search?.toString() ?? "";
  const pathWithSearch = s ? `${path}?${s}` : path;

  useEffect(() => {
    if (!isGentrixAnalyticsEnabled()) return;
    const p = path || "/";
    const canInferRoute =
      p === "/admin" || p.startsWith("/admin/") || (p !== "/site" && !p.startsWith("/site/") && p !== "/portal" && !p.startsWith("/portal/"));
    if (canInferRoute) {
      setGentrixPageContext(inferGentrixContextFromPath(p, s ? `?${s}` : ""));
    }
    const id = pathWithSearch;
    if (prev.current === id) return;
    prev.current = id;
    queueMicrotask(() => {
      captureGentrixPageview(pathWithSearch);
    });
  }, [path, s, pathWithSearch]);

  return null;
}

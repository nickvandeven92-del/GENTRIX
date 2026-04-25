"use client";

import { useLayoutEffect, useState, useSyncExternalStore, type RefObject } from "react";

/** Gelijk aan Tailwind `lg:` — zie `TailwindSectionsPreview`. */
export const STUDIO_PREVIEW_DESKTOP_MQ = "(min-width: 1024px)";
export const STUDIO_PREVIEW_AUTO_PANEL_LG_PX = 1024;

function subscribeStudioPreviewDesktopMq(onChange: () => void) {
  if (typeof window === "undefined") return () => {};
  const mq = window.matchMedia(STUDIO_PREVIEW_DESKTOP_MQ);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

function getStudioPreviewDesktopSnapshot(): boolean {
  return typeof window !== "undefined" && window.matchMedia(STUDIO_PREVIEW_DESKTOP_MQ).matches;
}

/**
 * Zelfde breakpoint-keuze als `TailwindSectionsPreview` (auto / mobiel / desktop-knop).
 * `panelRef`: element waarvan de breedte telt (preview-paneel / container).
 */
export function useStudioTailwindPreviewViewportModes(
  viewportMode: "auto" | "mobile" | "desktop",
  panelRef: RefObject<HTMLDivElement | null>,
): {
  previewPanelWidthPx: number | null;
  previewMatchParentWindowBreakpoints: boolean;
  studioMobileEditorFrame: boolean;
} {
  const [previewPanelWidthPx, setPreviewPanelWidthPx] = useState<number | null>(null);

  const parentWindowDesktop = useSyncExternalStore(
    subscribeStudioPreviewDesktopMq,
    getStudioPreviewDesktopSnapshot,
    () => false,
  );

  useLayoutEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const apply = () => {
      const w = el.getBoundingClientRect().width;
      if (Number.isFinite(w)) setPreviewPanelWidthPx(Math.round(w));
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, [viewportMode, panelRef]);

  const previewMatchParentWindowBreakpoints = viewportMode === "desktop";
  const autoPanelIsLg =
    previewPanelWidthPx != null ? previewPanelWidthPx >= STUDIO_PREVIEW_AUTO_PANEL_LG_PX : parentWindowDesktop;
  const studioMobileEditorFrame =
    viewportMode === "mobile" || (viewportMode === "auto" && !autoPanelIsLg);

  return {
    previewPanelWidthPx,
    previewMatchParentWindowBreakpoints,
    studioMobileEditorFrame,
  };
}

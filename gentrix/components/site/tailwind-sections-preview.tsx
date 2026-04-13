"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { TailwindPageConfig, TailwindSection } from "@/lib/ai/tailwind-sections-schema";
import type { GeneratedLogoSet } from "@/types/logo";
import {
  composePublicMarketingTailwindSections,
  type ComposePublicMarketingPlan,
} from "@/lib/site/public-site-composition";
import { isStudioPreviewPostMessage } from "@/lib/site/preview-post-message";
import { PublishedTailwindNavBridge } from "@/components/site/published-tailwind-nav-bridge";
import { buildTailwindIframeSrcDoc } from "@/lib/site/tailwind-page-html";
import { cn } from "@/lib/utils";

const STUDIO_PREVIEW_DESKTOP_MQ = "(min-width: 768px)";

function subscribeStudioPreviewDesktopMq(onChange: () => void) {
  if (typeof window === "undefined") return () => {};
  const mq = window.matchMedia(STUDIO_PREVIEW_DESKTOP_MQ);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

function getStudioPreviewDesktopSnapshot(): boolean {
  return typeof window !== "undefined" && window.matchMedia(STUDIO_PREVIEW_DESKTOP_MQ).matches;
}

export { buildTailwindIframeSrcDoc } from "@/lib/site/tailwind-page-html";

/** Agent-debug: iframe klikken → NDJSON ingest (alleen development). */
const ENABLE_STUDIO_PREVIEW_CLICK_DEBUG = process.env.NODE_ENV === "development";

type TailwindSectionsPreviewProps = {
  sections: TailwindSection[];
  pageConfig?: TailwindPageConfig | null;
  title?: string;
  className?: string;
  frameClassName?: string;
  /** Stuurt `studio-preview-ready` + `studio-preview-height` naar parent (postMessage). */
  previewPostMessageBridge?: boolean;
  /** Past iframe-hoogte aan op basis van documenthoogte uit de iframe (met cap). */
  autoResizeFromPostMessage?: boolean;
  /**
   * `panel` (standaard): iframe-hoogte max. paneel / ~82vh — je scrollt **in** de iframe.
   * `full`: iframe = gemeten documenthoogte (tot `maxMeasuredHeight`) — je scrollt **rond** de iframe (bijv. editorkolom).
   */
  documentHeightMode?: "panel" | "full";
  /** Max. hoogte (px) na meting — voorkomt extreem lange preview bij `min-h-screen`-stacking in HTML. */
  maxMeasuredHeight?: number;
  /** Eigen CSS/JS; iframe gebruikt sandbox zonder same-origin. */
  userCss?: string;
  userJs?: string;
  logoSet?: GeneratedLogoSet | null;
  /** Portaal-links (`__STUDIO_PORTAL_PATH__`) gelijk aan live. */
  publishedSlug?: string;
  /** Concept: interne `/site/{slug}/…`-navigatie behoudt `?token=` (zelfde routes als live). */
  draftPublicPreviewToken?: string | null;
  /** Zelfde filtering als `/site/[slug]` — booking/shop alleen als module aan staat. */
  appointmentsEnabled?: boolean;
  webshopEnabled?: boolean;
  /** Optioneel: snapshot-volgorde + Site IR (editor/live-parity); geen layout-presets. */
  composePlan?: ComposePublicMarketingPlan | null;
  /**
   * Studio-editor: viewport / breakpoints in de iframe.
   * - `auto`: sluit aan op browservenster (≥768px → vaste desktop-viewport in iframe).
   * - `mobile`: smalle telefoonbreedte + `device-width` (mobiele Tailwind-breakpoints).
   * - `desktop`: brede layout ongeacht paneelbreedte.
   */
  viewportMode?: "auto" | "mobile" | "desktop";
};

export function TailwindSectionsPreview({
  sections,
  pageConfig,
  title = "Website preview",
  className,
  frameClassName,
  previewPostMessageBridge = true,
  autoResizeFromPostMessage = false,
  documentHeightMode = "panel",
  maxMeasuredHeight = 2400,
  userCss,
  userJs,
  logoSet,
  publishedSlug,
  draftPublicPreviewToken,
  appointmentsEnabled = true,
  webshopEnabled = true,
  composePlan = null,
  viewportMode = "auto",
}: TailwindSectionsPreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [measuredHeight, setMeasuredHeight] = useState<number | null>(null);
  const [panelClipPx, setPanelClipPx] = useState<number | null>(null);

  const parentWindowDesktop = useSyncExternalStore(
    subscribeStudioPreviewDesktopMq,
    getStudioPreviewDesktopSnapshot,
    () => false,
  );

  const previewMatchParentWindowBreakpoints =
    viewportMode === "desktop" || (viewportMode === "auto" && parentWindowDesktop);

  /** Mobiel-knop, of Autom. op smal browservenster: zelfde nav-polish in iframe als `studioMobileEditorFrame`. */
  const studioMobileEditorFrame =
    viewportMode === "mobile" || (viewportMode === "auto" && !parentWindowDesktop);

  const previewSections = useMemo(
    () =>
      composePublicMarketingTailwindSections(
        sections,
        {
          appointmentsEnabled,
          webshopEnabled,
        },
        composePlan ?? undefined,
      ),
    [sections, appointmentsEnabled, webshopEnabled, composePlan],
  );

  const srcDoc = useMemo(
    () =>
      buildTailwindIframeSrcDoc(previewSections, pageConfig, {
        previewPostMessageBridge,
        userCss,
        userJs,
        logoSet,
        publishedSlug: publishedSlug?.trim(),
        draftPublicPreviewToken: draftPublicPreviewToken?.trim() || undefined,
        appointmentsEnabled,
        webshopEnabled,
        previewMatchParentWindowBreakpoints,
        studioMobileEditorFrame,
        studioPreviewClickDebug: ENABLE_STUDIO_PREVIEW_CLICK_DEBUG,
      }),
    [
      previewSections,
      pageConfig,
      previewPostMessageBridge,
      userCss,
      userJs,
      logoSet,
      publishedSlug,
      draftPublicPreviewToken,
      appointmentsEnabled,
      webshopEnabled,
      previewMatchParentWindowBreakpoints,
      studioMobileEditorFrame,
    ],
  );

  // #region agent log
  useEffect(() => {
    const da = (srcDoc.match(/data-animation="/g) ?? []).length;
    const aos = (srcDoc.match(/data-aos="/g) ?? []).length;
    const hasRevealScript = srcDoc.includes('querySelectorAll("[data-animation]"');
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;
    void fetch("http://127.0.0.1:7380/ingest/00ec8e83-ff50-4a98-8102-2ae76b9c5e1c", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "06cb80" },
      body: JSON.stringify({
        sessionId: "06cb80",
        runId: "preview-srcdoc",
        hypothesisId: "H1-H4-H5",
        location: "tailwind-sections-preview.tsx:srcDoc",
        message: "preview iframe srcdoc motion signals",
        data: {
          dataAnimationAttrCount: da,
          dataAosAttrCount: aos,
          hasRevealScript,
          prefersReducedMotion: reduced,
          srcDocLen: srcDoc.length,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
  }, [srcDoc]);
  // #endregion

  useEffect(() => {
    queueMicrotask(() => setMeasuredHeight(null));
  }, [srcDoc]);

  useLayoutEffect(() => {
    if (!autoResizeFromPostMessage || documentHeightMode === "full") {
      queueMicrotask(() => setPanelClipPx(null));
      return;
    }
    const el = containerRef.current;
    if (!el) return;
    const apply = () => {
      const h = el.clientHeight;
      setPanelClipPx(h > 0 ? h : null);
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, [autoResizeFromPostMessage, documentHeightMode, srcDoc]);

  useEffect(() => {
    if (!previewPostMessageBridge || !autoResizeFromPostMessage) return;

    const onMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      if (!isStudioPreviewPostMessage(event.data)) return;
      if (event.data.type === "studio-preview-height") {
        const h = Math.min(Math.max(event.data.height, 320), maxMeasuredHeight);
        setMeasuredHeight(h);
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [previewPostMessageBridge, autoResizeFromPostMessage, maxMeasuredHeight, srcDoc]);

  // #region agent log
  useEffect(() => {
    if (!previewPostMessageBridge || !ENABLE_STUDIO_PREVIEW_CLICK_DEBUG) return;
    const onMsg = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      const d = event.data as Record<string, unknown> | null;
      if (!d || d.source !== "studio-tailwind-preview" || d.type !== "studio-debug-click") return;
      void fetch("http://127.0.0.1:7380/ingest/00ec8e83-ff50-4a98-8102-2ae76b9c5e1c", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "c94dd3" },
        body: JSON.stringify({
          sessionId: "c94dd3",
          hypothesisId: "H2-H4",
          location: "tailwind-sections-preview.tsx:iframe-click",
          message: "iframe studio-debug-click",
          data: d,
          timestamp: Date.now(),
        }),
      }).catch(() => {});
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [previewPostMessageBridge, srcDoc]);
  // #endregion

  // #region agent log
  useEffect(() => {
    if (!ENABLE_STUDIO_PREVIEW_CLICK_DEBUG) return;
    const el = containerRef.current;
    if (!el) return;
    const onPd = (e: PointerEvent) => {
      const top = document.elementFromPoint(e.clientX, e.clientY);
      const ifr = iframeRef.current;
      const hitIframe = !!(ifr && top && (top === ifr || ifr.contains(top as Node)));
      void fetch("http://127.0.0.1:7380/ingest/00ec8e83-ff50-4a98-8102-2ae76b9c5e1c", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "c94dd3" },
        body: JSON.stringify({
          sessionId: "c94dd3",
          hypothesisId: "H1",
          location: "tailwind-sections-preview.tsx:pointerdown",
          message: "preview container elementFromPoint",
          data: {
            topTag: top?.nodeName,
            topClass: top && "className" in top ? String((top as HTMLElement).className).slice(0, 120) : "",
            hitIframe,
            viewportMode,
            studioMobileEditorFrame,
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
    };
    el.addEventListener("pointerdown", onPd, true);
    return () => el.removeEventListener("pointerdown", onPd, true);
  }, [srcDoc, viewportMode, studioMobileEditorFrame]);
  // #endregion

  const autoResizeHeightPx =
    autoResizeFromPostMessage && measuredHeight != null
      ? documentHeightMode === "full"
        ? Math.min(Math.max(measuredHeight, 320), maxMeasuredHeight)
        : Math.min(
            measuredHeight,
            maxMeasuredHeight,
            panelClipPx != null && panelClipPx > 0
              ? panelClipPx
              : typeof window !== "undefined"
                ? Math.round(window.innerHeight * 0.82)
                : 920,
          )
      : null;

  const iframe = (
    <iframe
      ref={iframeRef}
      title={title}
      className={cn("w-full border-0 bg-white", frameClassName ?? "h-[min(72vh,800px)]")}
      sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
      srcDoc={srcDoc}
      style={autoResizeHeightPx != null ? { height: `${Math.round(autoResizeHeightPx)}px` } : undefined}
    />
  );

  return (
    <PublishedTailwindNavBridge>
      <div
        ref={containerRef}
        className={cn(
          "flex flex-col rounded-b-xl bg-white",
          documentHeightMode === "full" ? "overflow-visible" : "min-h-0 overflow-hidden",
          viewportMode === "mobile" && documentHeightMode !== "full" && "overflow-y-auto",
          className,
        )}
      >
        {viewportMode === "mobile" ? (
          <div className="flex min-h-0 flex-1 justify-center overflow-y-auto bg-zinc-200/70 px-2 py-3 dark:bg-zinc-950/90">
            <div className="flex w-full max-w-[390px] flex-col overflow-hidden rounded-2xl border border-zinc-300 bg-white shadow-lg ring-1 ring-black/5 dark:border-zinc-600 dark:bg-zinc-950 dark:ring-white/10">
              {iframe}
            </div>
          </div>
        ) : (
          iframe
        )}
      </div>
    </PublishedTailwindNavBridge>
  );
}

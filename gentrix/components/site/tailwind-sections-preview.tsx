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

/** Gelijk aan Tailwind `lg:` (1024px) — veel sites gebruiken `lg:hidden` voor hamburger; 768px gaf “menu vast” bij smal venster. */
const STUDIO_PREVIEW_DESKTOP_MQ = "(min-width: 1024px)";

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
   * - `auto`: sluit aan op browservenster (≥1024px → vaste desktop-viewport in iframe; zelfde als Tailwind `lg:`).
   * - `mobile`: smalle telefoonbreedte + `device-width` (mobiele Tailwind-breakpoints).
   * - `desktop`: brede layout ongeacht paneelbreedte.
   */
  viewportMode?: "auto" | "mobile" | "desktop";
  /** Server-build Tailwind CSS: gezet → geen Play CDN in srcDoc (minder console-warnings bij remount). */
  compiledTailwindCss?: string | null;
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
  compiledTailwindCss,
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

  const previewScriptOrigin = typeof window !== "undefined" ? window.location.origin : "";

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
        compiledTailwindCss: compiledTailwindCss?.trim() || undefined,
        previewScriptOrigin: previewScriptOrigin || undefined,
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
      compiledTailwindCss,
      previewScriptOrigin,
    ],
  );

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
      key={`studio-preview-${String(previewMatchParentWindowBreakpoints)}-${String(studioMobileEditorFrame)}-${viewportMode}`}
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

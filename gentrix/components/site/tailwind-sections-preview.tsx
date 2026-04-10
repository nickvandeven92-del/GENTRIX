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
  /** Zelfde filtering als `/site/[slug]` — booking/shop alleen als module aan staat. */
  appointmentsEnabled?: boolean;
  webshopEnabled?: boolean;
  /** Optioneel: snapshot-volgorde + Site IR (editor/live-parity); geen layout-presets. */
  composePlan?: ComposePublicMarketingPlan | null;
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
  appointmentsEnabled = true,
  webshopEnabled = true,
  composePlan = null,
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
        appointmentsEnabled,
        webshopEnabled,
        previewMatchParentWindowBreakpoints: parentWindowDesktop,
      }),
    [
      previewSections,
      pageConfig,
      previewPostMessageBridge,
      userCss,
      userJs,
      logoSet,
      publishedSlug,
      appointmentsEnabled,
      webshopEnabled,
      parentWindowDesktop,
    ],
  );

  useEffect(() => {
    setMeasuredHeight(null);
  }, [srcDoc]);

  useLayoutEffect(() => {
    if (!autoResizeFromPostMessage || documentHeightMode === "full") {
      setPanelClipPx(null);
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

  return (
    <PublishedTailwindNavBridge>
      <div
        ref={containerRef}
        className={cn(
          "flex flex-col rounded-b-xl bg-white",
          documentHeightMode === "full" ? "overflow-visible" : "min-h-0 overflow-hidden",
          className,
        )}
      >
        <iframe
          ref={iframeRef}
          title={title}
          className={cn("w-full border-0 bg-white", frameClassName ?? "h-[min(72vh,800px)]")}
          sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
          srcDoc={srcDoc}
          style={autoResizeHeightPx != null ? { height: `${Math.round(autoResizeHeightPx)}px` } : undefined}
        />
      </div>
    </PublishedTailwindNavBridge>
  );
}

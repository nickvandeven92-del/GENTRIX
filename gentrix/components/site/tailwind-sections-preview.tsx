"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { DesignGenerationContract } from "@/lib/ai/design-generation-contract";
import type { StudioRasterBrandSet, TailwindPageConfig, TailwindSection } from "@/lib/ai/tailwind-sections-schema";
import type { GeneratedLogoSet } from "@/types/logo";
import {
  composePublicMarketingTailwindSections,
  type ComposePublicMarketingPlan,
} from "@/lib/site/public-site-composition";
import { isStudioPreviewPostMessage } from "@/lib/site/preview-post-message";
import { PublishedTailwindNavBridge } from "@/components/site/published-tailwind-nav-bridge";
import { buildTailwindIframeSrcDoc } from "@/lib/site/tailwind-page-html";
import type { ContactSubpageNavScriptInput } from "@/lib/site/tailwind-contact-subpage";
import { filterSectionsForPublicSite } from "@/lib/site/studio-section-visibility";
import { useStudioTailwindPreviewViewportModes } from "@/lib/site/studio-tailwind-preview-viewport";
import { cn } from "@/lib/utils";

/** Alleen bij expliciete desktop-preview: zelfde als `meta viewport` in `buildTailwindIframeSrcDoc` — vaste desktop-layout. */
const STUDIO_PREVIEW_DESKTOP_IFRAME_MIN_PX = 1280;

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
  rasterBrandSet?: StudioRasterBrandSet | null;
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
   * `SiteHtmlEditor`: secties zijn al door `composePublicMarketingTailwindSections` (zelfde als `/site`);
   * geen tweede compose in de preview (voorkomt drift).
   */
  skipPublicMarketingCompose?: boolean;
  /**
   * Studio-editor: viewport / breakpoints in de iframe.
   * - `auto`: breakpoints volgen de **preview-paneelbreedte** (sleepbalk) — naadloos tablet/telefoon zonder horizontale scrollbar.
   * - `mobile`: smalle telefoonbreedte + `device-width` (mobiele Tailwind-breakpoints).
   * - `desktop`: vaste brede layout (1280px-viewport) ongeacht paneelbreedte; bij smal paneel horizontaal scrollen.
   */
  viewportMode?: "auto" | "mobile" | "desktop";
  /** Server-build Tailwind CSS: gezet → geen Play CDN in srcDoc (minder console-warnings bij remount). */
  compiledTailwindCss?: string | null;
  /** Korte merknaam voor favicon-titel / shell (niet `config.style`). */
  navBrandLabel?: string | null;
  /**
   * Alleen `SiteHtmlEditor`: home/contact/marketing in dezelfde iframe, `postMessage` wisselt alleen
   * de preview in de admin (niet de hele `window`).
   */
  contactSubpageNavForHtmlEditor?: ContactSubpageNavScriptInput | null;
  /** Huidig iframe-pad: moet de actieve (sub)route matchen, anders faalt o.a. de home-knop. */
  iframeDocumentPathname?: string | null;
  /** Zet `STUDIO_HTML_EDITOR_IFRAME_NAV` i.p.v. `studio-public-nav` in het iframe. */
  studioHtmlEditorParentNav?: boolean;
  designContract?: DesignGenerationContract | null;
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
  rasterBrandSet,
  publishedSlug,
  draftPublicPreviewToken,
  appointmentsEnabled = true,
  webshopEnabled = true,
  composePlan = null,
  skipPublicMarketingCompose = false,
  viewportMode = "auto",
  compiledTailwindCss,
  navBrandLabel,
  contactSubpageNavForHtmlEditor = null,
  iframeDocumentPathname: iframeDocumentPathnameProp = null,
  studioHtmlEditorParentNav = false,
  designContract = null,
}: TailwindSectionsPreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [measuredHeight, setMeasuredHeight] = useState<number | null>(null);
  const [panelClipPx, setPanelClipPx] = useState<number | null>(null);

  const { previewMatchParentWindowBreakpoints, studioMobileEditorFrame } = useStudioTailwindPreviewViewportModes(
    viewportMode,
    containerRef,
  );

  const previewScriptOrigin = typeof window !== "undefined" ? window.location.origin : "";

  const previewSections = useMemo(
    () =>
      skipPublicMarketingCompose
        ? sections
        : composePublicMarketingTailwindSections(
            filterSectionsForPublicSite(sections),
            {
              appointmentsEnabled,
              webshopEnabled,
            },
            composePlan ?? undefined,
          ),
    [sections, appointmentsEnabled, webshopEnabled, composePlan, skipPublicMarketingCompose],
  );

  const srcDoc = useMemo(
    () =>
      buildTailwindIframeSrcDoc(previewSections, pageConfig, {
        previewPostMessageBridge,
        userCss,
        userJs,
        logoSet,
        rasterBrandSet: rasterBrandSet ?? undefined,
        designContract: designContract ?? undefined,
        publishedSlug: publishedSlug?.trim(),
        draftPublicPreviewToken: draftPublicPreviewToken?.trim() || undefined,
        appointmentsEnabled,
        webshopEnabled,
        previewMatchParentWindowBreakpoints,
        studioMobileEditorFrame,
        compiledTailwindCss: compiledTailwindCss?.trim() || undefined,
        previewScriptOrigin: previewScriptOrigin || undefined,
        navBrandLabel: navBrandLabel?.trim() || undefined,
        ...(contactSubpageNavForHtmlEditor
          ? { contactSubpageNav: contactSubpageNavForHtmlEditor }
          : {}),
        ...(iframeDocumentPathnameProp != null && String(iframeDocumentPathnameProp).trim() !== ""
          ? { iframeDocumentPathname: String(iframeDocumentPathnameProp).trim() }
          : {}),
        ...(studioHtmlEditorParentNav ? { studioHtmlEditorParentNav: true } : {}),
      }),
    [
      previewSections,
      pageConfig,
      previewPostMessageBridge,
      userCss,
      userJs,
      logoSet,
      rasterBrandSet,
      publishedSlug,
      draftPublicPreviewToken,
      appointmentsEnabled,
      webshopEnabled,
      previewMatchParentWindowBreakpoints,
      studioMobileEditorFrame,
      compiledTailwindCss,
      previewScriptOrigin,
      navBrandLabel,
      contactSubpageNavForHtmlEditor,
      iframeDocumentPathnameProp,
      studioHtmlEditorParentNav,
      designContract,
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

  const iframeStyle: CSSProperties = {
    ...(autoResizeHeightPx != null ? { height: `${Math.round(autoResizeHeightPx)}px` } : {}),
    ...(previewMatchParentWindowBreakpoints
      ? { width: STUDIO_PREVIEW_DESKTOP_IFRAME_MIN_PX, minWidth: STUDIO_PREVIEW_DESKTOP_IFRAME_MIN_PX }
      : {}),
  };

  const iframe = (
    <iframe
      key={`studio-preview-${String(previewMatchParentWindowBreakpoints)}-${String(studioMobileEditorFrame)}-${viewportMode}`}
      ref={iframeRef}
      title={title}
      onLoad={() => {
        try {
          const w = iframeRef.current?.contentWindow;
          if (!w) return;
          w.scrollTo(0, 0);
          const d = w.document;
          if (d?.documentElement) d.documentElement.scrollTop = 0;
          if (d?.body) d.body.scrollTop = 0;
        } catch {
          /* srcDoc sandbox: sommige browsers beperken parent→iframe; geen harde fout */
        }
      }}
      className={cn(
        "border-0 bg-white",
        previewMatchParentWindowBreakpoints ? "max-w-none shrink-0" : "w-full",
        frameClassName ?? "h-[min(72vh,800px)]",
      )}
      sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
      srcDoc={srcDoc}
      style={Object.keys(iframeStyle).length > 0 ? iframeStyle : undefined}
    />
  );

  const desktopWideScroll = previewMatchParentWindowBreakpoints ? (
    <div
      className={cn(
        "min-h-0 w-full overflow-x-auto",
        documentHeightMode === "full" ? "overflow-y-auto" : "flex-1 overflow-y-hidden",
      )}
      style={{ scrollbarGutter: "stable" }}
    >
      {iframe}
    </div>
  ) : null;

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
        ) : desktopWideScroll ? (
          desktopWideScroll
        ) : (
          iframe
        )}
      </div>
    </PublishedTailwindNavBridge>
  );
}

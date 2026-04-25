"use client";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import type { DesignGenerationContract } from "@/lib/ai/design-generation-contract";
import type { StudioRasterBrandSet, TailwindPageConfig, TailwindSection } from "@/lib/ai/tailwind-sections-schema";
import type { GeneratedLogoSet } from "@/types/logo";
import { rewriteStudioDevOriginsInHtml } from "@/lib/site/rewrite-published-html-origins";
import { buildTailwindIframeSrcDoc } from "@/lib/site/tailwind-page-html";
import {
  filterSectionsForPortalOnly,
  filterSectionsForPublicSite,
} from "@/lib/site/studio-section-visibility";
import {
  type ContactSubpageNavScriptInput,
  publicSiteIframeDocumentPathname,
} from "@/lib/site/tailwind-contact-subpage";
import { PublishedTailwindAssets } from "@/components/site/published-tailwind-assets";
import { PublishedTailwindNavBridge } from "@/components/site/published-tailwind-nav-bridge";
import { PublicSitePageSkeleton } from "@/components/site/public-site-page-skeleton";
import { isStudioPreviewPostMessage } from "@/lib/site/preview-post-message";
import { cn } from "@/lib/utils";
import {
  initGentrixAnalytics,
  isGentrixAnalyticsEnabled,
  setGentrixPageContext,
} from "@/lib/analytics/gentrix-analytics";

function escapeHtmlForSrcDocTitle(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

const MAX_SRC_DOC_CHARS = 3_500_000;
/** Gelijk aan `TailwindSectionsPreview` / `buildTailwindIframeSrcDoc` — vaste desktop-breakpoints in iframe. */
const STUDIO_IFRAME_DESKTOP_VIEWPORT_PX = 1280;

type PublicPublishedTailwindProps = {
  sections: TailwindSection[];
  pageConfig?: TailwindPageConfig | null;
  className?: string;
  visibility?: "public" | "portal";
  publishedSlug?: string;
  /** Zie `buildTailwindIframeSrcDoc` — alleen token-preview. */
  draftPublicPreviewToken?: string | null;
  userCss?: string;
  userJs?: string;
  logoSet?: GeneratedLogoSet | null;
  rasterBrandSet?: StudioRasterBrandSet | null;
  /** Minified Tailwind v4 — geen Play CDN (sneller, geen FOUC). */
  compiledTailwindCss?: string | null;
  documentTitle?: string;
  embedded?: boolean;
  appointmentsEnabled?: boolean;
  webshopEnabled?: boolean;
  /** Zonder `pageOrigin` — die zet de client in `useEffect` vóór `buildTailwindIframeSrcDoc`. */
  contactSubpageNavBase?: Omit<ContactSubpageNavScriptInput, "pageOrigin"> | null;
  /** Korte merknaam (klantnaam) voor favicon/shell; niet `documentTitle` met subpagina-suffix. */
  navBrandLabel?: string | null;
  /** Denklijn-contract wanneer beschikbaar — zelfde nav-preset infer als live payload. */
  designContract?: DesignGenerationContract | null;
  /**
   * Server-side pre-computed srcDoc (RSC via `NEXT_PUBLIC_SITE_URL`).
   * Als gezet: iframe verschijnt direct bij eerste paint zonder client-side JS-build.
   * CDN-scripts zijn dan ook al herschreven naar de eigen proxy (`/api/public/studio-preview-lib`).
   * Fallback naar client-build als `null`.
   */
  ssrSrcDoc?: string | null;
  /** Zelfde als `TailwindSectionsPreview`: hoogte-meting uit iframe → geen lege band onder de pagina. */
  previewPostMessageBridge?: boolean;
  autoResizeFromPostMessage?: boolean;
  documentHeightMode?: "panel" | "full";
  maxMeasuredHeight?: number;
  /**
   * Site-studio **generator**-iframe: `width=1280` viewport + horizontaal scrollen in smal paneel,
   * zodat `lg:`-desktop-nav zichtbaar is (niet `device-width` = breedte preview-kolom → mobiele layout).
   */
  studioIframeDesktopViewport?: boolean;
};

function fallbackSrcDoc(documentTitle: string, body: string): string {
  return `<!DOCTYPE html><html lang="nl"><head><meta charset="utf-8"/><title>${escapeHtmlForSrcDocTitle(
    documentTitle,
  )}</title></head><body style="font-family:system-ui;padding:1.5rem">${body}</body></html>`;
}

/**
 * Tailwind-publieke site: standaard wordt `srcDoc` in de **browser** gebouwd (`buildTailwindIframeSrcDoc`),
 * niet als kant-en-klare HTML van de server (behalve bij `ssrSrcDoc`).
 * Optioneel: `previewPostMessageBridge` + `autoResizeFromPostMessage` voor studio-generator (iframe-hoogte = inhoud).
 */
export function PublicPublishedTailwind({
  sections,
  pageConfig,
  className,
  visibility = "public",
  publishedSlug,
  draftPublicPreviewToken,
  userCss,
  userJs,
  logoSet,
  rasterBrandSet,
  compiledTailwindCss,
  documentTitle = "Website",
  embedded = false,
  appointmentsEnabled = true,
  webshopEnabled = true,
  contactSubpageNavBase = null,
  navBrandLabel = null,
  designContract = null,
  ssrSrcDoc = null,
  previewPostMessageBridge = false,
  autoResizeFromPostMessage = false,
  documentHeightMode = "panel",
  maxMeasuredHeight = 2400,
  studioIframeDesktopViewport = false,
}: PublicPublishedTailwindProps) {
  const filtered = useMemo(
    () =>
      visibility === "portal"
        ? filterSectionsForPortalOnly(sections)
        : filterSectionsForPublicSite(sections),
    [visibility, sections],
  );

  const iframeDocumentPathname = useMemo(
    () => publicSiteIframeDocumentPathname(publishedSlug, contactSubpageNavBase ?? undefined),
    [publishedSlug, contactSubpageNavBase],
  );

  /** Server-side pre-computed srcDoc als initiële waarde — geen client-side build nodig als gezet. */
  const [srcDoc, setSrcDoc] = useState<string | null>(ssrSrcDoc ?? null);
  /** Skeleton alleen tonen als we geen SSR srcDoc hebben; anders direct iframe. */
  const [showSkeleton] = useState<boolean>(ssrSrcDoc == null);
  /** Bij gezet `ssrSrcDoc` op mount: geen client-side herbouw (voorkomt overschrijven van server-doc). */
  const skipClientSrcDocBuildRef = useRef(Boolean(ssrSrcDoc?.trim()));
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [measuredHeight, setMeasuredHeight] = useState<number | null>(null);
  const [panelClipPx, setPanelClipPx] = useState<number | null>(null);

  useEffect(() => {
    if (!isGentrixAnalyticsEnabled()) return;
    if (visibility !== "portal" || !publishedSlug?.trim()) return;
    initGentrixAnalytics();
    setGentrixPageContext({
      session_type: "client_portal_iframe",
      site_slug: publishedSlug.trim(),
      page_key: iframeDocumentPathname && iframeDocumentPathname.length > 0 ? iframeDocumentPathname : "portal_iframe:home",
      is_preview: Boolean(draftPublicPreviewToken?.trim()),
      booking_module_enabled: appointmentsEnabled,
      webshop_module_enabled: webshopEnabled,
      actor: "known_customer",
      is_internal_actor: false,
      render_surface: "portal_iframe",
    });
  }, [
    visibility,
    publishedSlug,
    draftPublicPreviewToken,
    appointmentsEnabled,
    webshopEnabled,
    iframeDocumentPathname,
  ]);

  useEffect(() => {
    queueMicrotask(() => setMeasuredHeight(null));
  }, [srcDoc]);

  useLayoutEffect(() => {
    if (!autoResizeFromPostMessage || !previewPostMessageBridge || documentHeightMode === "full") {
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
  }, [autoResizeFromPostMessage, previewPostMessageBridge, documentHeightMode, srcDoc]);

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
    previewPostMessageBridge && autoResizeFromPostMessage && measuredHeight != null
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

  useEffect(() => {
    if (skipClientSrcDocBuildRef.current) return;
    let cancelled = false;
    /** Eén macrotask uitstellen zodat de browser eerst skeleton kan painten (zware sync `buildTailwindIframeSrcDoc` blokkeert anders meteen de main thread). */
    const t = window.setTimeout(() => {
      if (cancelled) return;
      try {
        const contactSubpageNav =
          contactSubpageNavBase && typeof window !== "undefined"
            ? { ...contactSubpageNavBase, pageOrigin: window.location.origin }
            : undefined;
        let doc = buildTailwindIframeSrcDoc(filtered, pageConfig, {
          previewPostMessageBridge,
          ...(studioIframeDesktopViewport && !embedded
            ? {
                previewMatchParentWindowBreakpoints: true,
                studioMobileEditorFrame: false,
              }
            : {}),
          userCss,
          userJs,
          logoSet,
          rasterBrandSet: rasterBrandSet ?? undefined,
          designContract: designContract ?? undefined,
          publishedSlug: publishedSlug?.trim(),
          draftPublicPreviewToken: draftPublicPreviewToken?.trim() || undefined,
          appointmentsEnabled,
          webshopEnabled,
          /* Scroll-reveal: `data-animation` + `.studio-border-reveal` + STUDIO_SCROLL_REVEAL_SCRIPT;
           * `data-studio-scroll-border` + STUDIO_SCROLL_BORDER_* (tailwind-page-html).
           * Hero + eerste secties: CSS-vrijstelling; ~1,6s IO-fallback voorkomt stuck states in iframes. */
          compiledTailwindCss: compiledTailwindCss?.trim() || undefined,
          previewScriptOrigin: window.location.origin,
          navBrandLabel: navBrandLabel?.trim() || undefined,
          iframeDocumentPathname,
          /** Portaal site-preview: postMessage → PostHog via `GentrixIframeAnalyticsListener`. */
          gentrixIframeAnalytics: visibility === "portal",
          ...(contactSubpageNav ? { contactSubpageNav } : {}),
        });
        if (typeof window !== "undefined") {
          doc = rewriteStudioDevOriginsInHtml(doc, window.location.origin);
        }
        if (doc.length > MAX_SRC_DOC_CHARS) {
          doc = fallbackSrcDoc(
            documentTitle,
            "Deze pagina is te groot om hier te tonen. Verklein de site in de editor of splits content.",
          );
        }
        if (!cancelled) queueMicrotask(() => setSrcDoc(doc));
      } catch {
        if (!cancelled) {
          const fallback = fallbackSrcDoc(
            documentTitle,
            "Deze site kan tijdelijk niet worden opgebouwd. Vernieuw de pagina of neem contact op met de beheerder.",
          );
          queueMicrotask(() => setSrcDoc(fallback));
        }
      }
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [
    filtered,
    pageConfig,
    userCss,
    userJs,
    logoSet,
    publishedSlug,
    appointmentsEnabled,
    webshopEnabled,
    documentTitle,
    compiledTailwindCss,
    contactSubpageNavBase,
    draftPublicPreviewToken,
    navBrandLabel,
    iframeDocumentPathname,
    embedded,
    visibility,
    previewPostMessageBridge,
    studioIframeDesktopViewport,
    designContract,
    rasterBrandSet,
  ]);

  const useStudioDesktopIframe = Boolean(studioIframeDesktopViewport && !embedded);

  const iframeStyle: CSSProperties = {
    ...(embedded
      ? {
          width: "100%",
          minHeight: "min(72vh, 720px)",
          height: "min(72vh, 720px)",
          border: "none",
          background: "transparent",
          overflow: "auto",
        }
      : useStudioDesktopIframe
        ? {
            width: STUDIO_IFRAME_DESKTOP_VIEWPORT_PX,
            minWidth: STUDIO_IFRAME_DESKTOP_VIEWPORT_PX,
            height: "100%",
            border: "none",
            background: "transparent",
            display: "block",
            overflow: "auto",
          }
        : {
            width: "100%",
            height: "100%",
            border: "none",
            background: "transparent",
            display: "block",
            overflow: "auto",
          }),
    ...(autoResizeHeightPx != null ? { height: `${Math.round(autoResizeHeightPx)}px` } : {}),
  };
  const shouldShowSkeleton = embedded || showSkeleton;

  if (srcDoc === null) {
    return (
      <PublishedTailwindNavBridge>
        <div
          ref={previewPostMessageBridge && autoResizeFromPostMessage ? containerRef : undefined}
          className={cn(
            "flex w-full min-w-0 flex-col bg-transparent",
            previewPostMessageBridge && autoResizeFromPostMessage && documentHeightMode === "full"
              ? "min-h-0"
              : "min-h-0 flex-1",
            previewPostMessageBridge && autoResizeFromPostMessage && documentHeightMode !== "full" && "overflow-hidden",
            className,
          )}
          style={{ width: "100%", height: embedded ? undefined : "100%" }}
        >
          {/* Tailwind Play wordt altijd naar `/api/public/studio-preview-lib` herschreven; preconnect naar cdn.tailwindcss.com is dan nutteloos (Lighthouse). */}
          <PublishedTailwindAssets preconnectTailwindPlayCdn={false} />
          {shouldShowSkeleton ? (
            <PublicSitePageSkeleton embedded={embedded} />
          ) : (
            <div
              className={cn("w-full bg-transparent", embedded ? "min-h-[min(72vh,720px)]" : "min-h-0 flex-1")}
              role="status"
              aria-live="polite"
              aria-busy="true"
            >
              <span className="sr-only">Pagina wordt geladen</span>
            </div>
          )}
        </div>
      </PublishedTailwindNavBridge>
    );
  }

  return (
    <PublishedTailwindNavBridge>
        <div
          ref={previewPostMessageBridge && autoResizeFromPostMessage ? containerRef : undefined}
          className={cn(
            "flex w-full min-w-0 flex-col bg-transparent",
            /* `full` + postMessage: buiten-iframe verticaal scrollen; geen `flex-1` — anders klem je op paneelhóógte. */
            previewPostMessageBridge && autoResizeFromPostMessage && documentHeightMode === "full"
              ? "min-h-0"
              : "min-h-0 flex-1",
            previewPostMessageBridge && autoResizeFromPostMessage && documentHeightMode !== "full" && "overflow-hidden",
            className,
          )}
          style={{ width: "100%", height: embedded ? undefined : "100%" }}
        >
          <PublishedTailwindAssets preconnectTailwindPlayCdn={false} />
        {useStudioDesktopIframe ? (
          <div
            className={cn(
              "min-h-0 w-full overflow-x-auto",
              /* `full` + fysiek hoge iframe: geen `flex-1` — anders weer één “viewport”-strip. */
              documentHeightMode === "full" ? "overflow-y-auto" : "flex-1 overflow-y-hidden",
            )}
            style={{ scrollbarGutter: "stable" }}
          >
            <iframe
              ref={iframeRef}
              title={documentTitle}
              className="max-w-none shrink-0 border-0 bg-white"
              style={iframeStyle}
              sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
              srcDoc={srcDoc}
            />
          </div>
        ) : (
          <iframe
            ref={iframeRef}
            title={documentTitle}
            style={iframeStyle}
            sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
            srcDoc={srcDoc}
          />
        )}
      </div>
    </PublishedTailwindNavBridge>
  );
}

"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { TailwindPageConfig, TailwindSection } from "@/lib/ai/tailwind-sections-schema";
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
import { cn } from "@/lib/utils";

function escapeHtmlForSrcDocTitle(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

const MAX_SRC_DOC_CHARS = 3_500_000;

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
  /** Minified Tailwind v4 — geen Play CDN (sneller, geen FOUC). */
  compiledTailwindCss?: string | null;
  documentTitle?: string;
  embedded?: boolean;
  appointmentsEnabled?: boolean;
  webshopEnabled?: boolean;
  /** Zonder `pageOrigin` — die zet de client in `useEffect` vóór `buildTailwindIframeSrcDoc`. */
  contactSubpageNavBase?: Omit<ContactSubpageNavScriptInput, "pageOrigin"> | null;
  /** Korte merknaam voor de auto-topnavbar (klantnaam); niet `documentTitle` met subpagina-suffix. */
  navBrandLabel?: string | null;
};

function fallbackSrcDoc(documentTitle: string, body: string): string {
  return `<!DOCTYPE html><html lang="nl"><head><meta charset="utf-8"/><title>${escapeHtmlForSrcDocTitle(
    documentTitle,
  )}</title></head><body style="font-family:system-ui;padding:1.5rem">${body}</body></html>`;
}

/**
 * Tailwind-publieke site: HTML wordt in de **browser** gebouwd (DOMPurify/jsdom), niet op de Vercel-server.
 * Daarmee vermijd je 500-crash op serverless die lokaal wél kan werken.
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
  compiledTailwindCss,
  documentTitle = "Website",
  embedded = false,
  appointmentsEnabled = true,
  webshopEnabled = true,
  contactSubpageNavBase = null,
  navBrandLabel = null,
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

  const [srcDoc, setSrcDoc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    /** Eén macrotask uitstellen zodat de browser eerst spinner/layout kan painten (zware sync `buildTailwindIframeSrcDoc` blokkeert anders meteen de main thread). */
    const t = window.setTimeout(() => {
      if (cancelled) return;
      try {
        const contactSubpageNav =
          contactSubpageNavBase && typeof window !== "undefined"
            ? { ...contactSubpageNavBase, pageOrigin: window.location.origin }
            : undefined;
        let doc = buildTailwindIframeSrcDoc(filtered, pageConfig, {
          previewPostMessageBridge: false,
          userCss,
          userJs,
          logoSet,
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
  ]);

  const iframeStyle: CSSProperties = embedded
    ? {
        width: "100%",
        minHeight: "min(72vh, 720px)",
        height: "min(72vh, 720px)",
        border: "none",
        background: "white",
        overflow: "auto",
      }
    : { width: "100%", height: "100%", border: "none", background: "white", display: "block", overflow: "auto" };

  if (srcDoc === null) {
    return (
      <PublishedTailwindNavBridge>
        <div
          className={cn("flex min-h-0 w-full flex-1 flex-col bg-white", className)}
          style={{ width: "100%", height: embedded ? undefined : "100%" }}
        >
          <PublishedTailwindAssets preconnectTailwindPlayCdn={!compiledTailwindCss?.trim()} />
          <PublicSitePageSkeleton embedded={embedded} />
        </div>
      </PublishedTailwindNavBridge>
    );
  }

  return (
    <PublishedTailwindNavBridge>
      <div
        className={cn("flex min-h-0 w-full flex-1 flex-col bg-white", className)}
        style={{ width: "100%", height: embedded ? undefined : "100%" }}
      >
        <PublishedTailwindAssets preconnectTailwindPlayCdn={!compiledTailwindCss?.trim()} />
        <iframe
          title={documentTitle}
          style={iframeStyle}
          sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
          srcDoc={srcDoc}
        />
      </div>
    </PublishedTailwindNavBridge>
  );
}

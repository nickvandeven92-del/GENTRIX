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
import type { ContactSubpageNavScriptInput } from "@/lib/site/tailwind-contact-subpage";
import { PublishedTailwindAssets } from "@/components/site/published-tailwind-assets";
import { PublishedTailwindNavBridge } from "@/components/site/published-tailwind-nav-bridge";
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
}: PublicPublishedTailwindProps) {
  const filtered = useMemo(
    () =>
      visibility === "portal"
        ? filterSectionsForPortalOnly(sections)
        : filterSectionsForPublicSite(sections),
    [visibility, sections],
  );

  const [srcDoc, setSrcDoc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
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
        /* Scroll-reveal: `data-animation` + `.studio-border-reveal` + STUDIO_SCROLL_REVEAL_SCRIPT (tailwind-page-html).
         * Hero + eerste secties: CSS-vrijstelling; ~1,6s IO-fallback voorkomt stuck states in iframes. */
        compiledTailwindCss: compiledTailwindCss?.trim() || undefined,
        ...(contactSubpageNav ? { contactSubpageNav } : {}),
      });
      if (typeof window !== "undefined") {
        doc = rewriteStudioDevOriginsInHtml(doc, window.location.origin);
      }
      // #region agent log
      {
        const da = (doc.match(/data-animation="/g) ?? []).length;
        const aos = (doc.match(/data-aos="/g) ?? []).length;
        const hasRevealScript = doc.includes('querySelectorAll("[data-animation]"');
        const reduced =
          typeof window !== "undefined" &&
          window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;
        void fetch("http://127.0.0.1:7380/ingest/00ec8e83-ff50-4a98-8102-2ae76b9c5e1c", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "06cb80" },
          body: JSON.stringify({
            sessionId: "06cb80",
            runId: "published-srcdoc",
            hypothesisId: "H1-H4-H5",
            location: "public-published-tailwind.tsx:buildDoc",
            message: "published iframe srcdoc motion signals",
            data: {
              dataAnimationAttrCount: da,
              dataAosAttrCount: aos,
              hasRevealScript,
              prefersReducedMotion: reduced,
              srcDocLen: doc.length,
            },
            timestamp: Date.now(),
          }),
        }).catch(() => {});
      }
      // #endregion
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
    return () => {
      cancelled = true;
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
          className={cn(
            "flex min-h-[50vh] w-full flex-1 flex-col items-center justify-center bg-white text-sm text-zinc-500",
            className,
          )}
          style={{ width: "100%", height: embedded ? undefined : "100%" }}
        >
          <PublishedTailwindAssets preconnectTailwindPlayCdn={!compiledTailwindCss?.trim()} />
          <span className="mt-4">Site laden…</span>
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

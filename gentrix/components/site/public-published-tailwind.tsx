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
  userCss?: string;
  userJs?: string;
  logoSet?: GeneratedLogoSet | null;
  documentTitle?: string;
  embedded?: boolean;
  appointmentsEnabled?: boolean;
  webshopEnabled?: boolean;
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
  userCss,
  userJs,
  logoSet,
  documentTitle = "Website",
  embedded = false,
  appointmentsEnabled = true,
  webshopEnabled = true,
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
      let doc = buildTailwindIframeSrcDoc(filtered, pageConfig, {
        previewPostMessageBridge: false,
        userCss,
        userJs,
        logoSet,
        publishedSlug: publishedSlug?.trim(),
        appointmentsEnabled,
        webshopEnabled,
        disableScrollRevealAnimations: true,
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
      if (!cancelled) setSrcDoc(doc);
    } catch {
      if (!cancelled) {
        setSrcDoc(
          fallbackSrcDoc(
            documentTitle,
            "Deze site kan tijdelijk niet worden opgebouwd. Vernieuw de pagina of neem contact op met de beheerder.",
          ),
        );
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
          <PublishedTailwindAssets />
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
        <PublishedTailwindAssets />
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

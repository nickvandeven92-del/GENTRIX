import type { DesignGenerationContract } from "@/lib/ai/design-generation-contract";
import type { TailwindPageConfig, TailwindSection } from "@/lib/ai/tailwind-sections-schema";
import Script from "next/script";
import { publishedTailwindInlineHtmlShellAttrs } from "@/lib/site/studio-site-shell";
import type { GeneratedLogoSet } from "@/types/logo";
import { rewriteStudioDevOriginsInHtml } from "@/lib/site/rewrite-published-html-origins";
import { rewritePublishedHtmlToPrettyPublicUrls } from "@/lib/site/rewrite-published-html-public-basepath";
import { buildTailwindIframeSrcDoc } from "@/lib/site/tailwind-page-html";
import { extractTailwindPageParts } from "@/lib/site/tailwind-page-html-to-parts";
import { filterSectionsForPublicSite } from "@/lib/site/studio-section-visibility";
import {
  type ContactSubpageNavScriptInput,
  publicSiteIframeDocumentPathname,
} from "@/lib/site/tailwind-contact-subpage";
import type { PublishedSiteSoftNavContext } from "@/lib/site/published-site-soft-nav";
import { PublishedTailwindAssets } from "@/components/site/published-tailwind-assets";
import { PublishedTailwindInlineClientEffects } from "@/components/site/published-tailwind-inline-client-effects";
import { PublishedTailwindNavBridge } from "@/components/site/published-tailwind-nav-bridge";
import { PublishedTailwindShellSync } from "@/components/site/published-tailwind-shell-sync";
import { cn } from "@/lib/utils";

/**
 * Publieke Tailwind-site **zonder iframe** — HTML wordt direct in de Next.js-pagina gerenderd.
 *
 * Principe:
 * – `buildTailwindIframeSrcDoc` bouwt de volledige HTML (zelfde output als bij iframe-gebruik)
 * – `extractTailwindPageParts` splitst in head + body + body-attrs
 * – Head-inhoud (compiled Tailwind CSS, meta, script-tags) wordt via `dangerouslySetInnerHTML`
 *   in een `<style>`-container gezet — browser parseert dit bij SSR-response en past alle regels toe
 * – Body-inhoud komt in een wrapper-div; scripts runnen omdat de browser ze bij initial parse ziet
 * – Standaard: full SSR page-load. Met {@link PublishedSiteSoftNavContext} via de nav-bridge:
 *   App Router `router.push` + Alpine/Lucide-resync voor een SPA-achtiger gevoel.
 *
 * Isolatie-risico's zijn laag omdat `/site/[slug]` in de eigen `(public)` route-group zit:
 * admin/portaal hebben een eigen layout en delen geen DOM met de publieke site-routes.
 */
type PublicPublishedTailwindInlineProps = {
  sections: TailwindSection[];
  pageConfig?: TailwindPageConfig | null;
  className?: string;
  publishedSlug?: string;
  draftPublicPreviewToken?: string | null;
  userCss?: string;
  userJs?: string;
  logoSet?: GeneratedLogoSet | null;
  compiledTailwindCss?: string | null;
  documentTitle?: string;
  appointmentsEnabled?: boolean;
  webshopEnabled?: boolean;
  contactSubpageNavBase?: Omit<ContactSubpageNavScriptInput, "pageOrigin"> | null;
  navBrandLabel?: string | null;
  /**
   * Pretty URL host (primaire studio-domein of klant-custom-domain): strip `/site/{slug}` uit alle
   * anchor-hrefs en laat de nav-scripts pretty paden emitteren. De middleware vertaalt korte paden
   * intern terug naar `/site/{slug}/…`.
   */
  prettyPublicUrls?: boolean;
  /** Flyer/QR-preview: geen body-visibility lock op Tailwind Play CDN. */
  relaxedTailwindCdnLoading?: boolean;
  /** Flyer/QR: `flyer=1` op interne navigatie (actiebalk op subpagina’s). */
  flyerPreview?: boolean;
  /** Multipage/contact: client-side navigatie + morph (View Transitions) i.p.v. volledige document-load. */
  publishedSiteSoftNav?: PublishedSiteSoftNavContext | null;
  designContract?: DesignGenerationContract | null;
};

function deriveSSROrigin(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "") ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    ""
  );
}

export function PublicPublishedTailwindInline({
  sections,
  pageConfig,
  className,
  publishedSlug,
  draftPublicPreviewToken,
  userCss,
  userJs,
  logoSet,
  compiledTailwindCss,
  documentTitle,
  appointmentsEnabled = true,
  webshopEnabled = true,
  contactSubpageNavBase = null,
  navBrandLabel = null,
  prettyPublicUrls = false,
  relaxedTailwindCdnLoading = false,
  flyerPreview = false,
  publishedSiteSoftNav = null,
  designContract = null,
}: PublicPublishedTailwindInlineProps) {
  const filtered = filterSectionsForPublicSite(sections);
  const iframeDocumentPathname = publicSiteIframeDocumentPathname(
    publishedSlug,
    contactSubpageNavBase ?? undefined,
  );
  const ssrOrigin = deriveSSROrigin();
  const contactSubpageNav =
    contactSubpageNavBase && ssrOrigin
      ? { ...contactSubpageNavBase, pageOrigin: ssrOrigin, prettyPublicUrls: prettyPublicUrls || undefined }
      : undefined;

  let fullHtml: string;
  try {
    fullHtml = buildTailwindIframeSrcDoc(filtered, pageConfig, {
      previewPostMessageBridge: false,
      userCss,
      userJs,
      logoSet,
      designContract: designContract ?? undefined,
      publishedSlug: publishedSlug?.trim(),
      draftPublicPreviewToken: draftPublicPreviewToken?.trim() || undefined,
      appointmentsEnabled,
      webshopEnabled,
      compiledTailwindCss: compiledTailwindCss?.trim() || undefined,
      previewScriptOrigin: ssrOrigin || undefined,
      navBrandLabel: navBrandLabel?.trim() || undefined,
      iframeDocumentPathname,
      relaxedTailwindCdnLoading,
      flyerPreview,
      ...(contactSubpageNav ? { contactSubpageNav } : {}),
    });
    if (ssrOrigin) fullHtml = rewriteStudioDevOriginsInHtml(fullHtml, ssrOrigin);
    if (prettyPublicUrls && publishedSlug?.trim()) {
      fullHtml = rewritePublishedHtmlToPrettyPublicUrls(fullHtml, {
        slug: publishedSlug.trim(),
        pageOrigin: ssrOrigin || null,
      });
    }
  } catch {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-2 bg-white px-4 text-center text-sm text-zinc-700">
        <p className="font-medium">Deze site kan tijdelijk niet worden opgebouwd.</p>
        <p className="text-zinc-500">Vernieuw de pagina of neem contact op met de beheerder.</p>
      </div>
    );
  }

  const parts = extractTailwindPageParts(fullHtml);
  const docTitle = documentTitle?.trim() || undefined;

  const htmlShellAttrs = publishedTailwindInlineHtmlShellAttrs({
    publishedSlug,
    navBrandLabel,
  });
  const shellBootScript = `(function(){try{var e=document.documentElement;${Object.entries(htmlShellAttrs)
    .map(([k, v]) => `e.setAttribute(${JSON.stringify(k)},${JSON.stringify(v)});`)
    .join("")}}catch(_){}})();`;

  const bodyFingerprint = `${filtered.map((s) => s.id ?? "").join("\0")}|${parts.bodyHtml.length}`;

  return (
    <PublishedTailwindNavBridge publishedSiteSoftNav={publishedSiteSoftNav}>
      <Script
        id="gentrix-published-tailwind-html-shell"
        strategy="beforeInteractive"
        dangerouslySetInnerHTML={{ __html: shellBootScript }}
      />
      <PublishedTailwindShellSync publishedSlug={publishedSlug} navBrandLabel={navBrandLabel} />
      <PublishedTailwindAssets preconnectTailwindPlayCdn={!compiledTailwindCss?.trim()} />
      {/* gegenereerde head-inhoud uit eigen builder (styles, meta, scripts) */}
      <div
        id="studio-published-head-payload"
        hidden
        aria-hidden="true"
        dangerouslySetInnerHTML={{ __html: parts.headHtml }}
      />
      {/* server-side gebouwde, DOMPurified HTML uit eigen builder */}
      <div
        className={cn("gentrix-published-root", parts.bodyClassName, className)}
        data-gentrix-published-site-root=""
        title={docTitle}
        {...parts.bodyDataAttrs}
        dangerouslySetInnerHTML={{ __html: parts.bodyHtml }}
      />
      <PublishedTailwindInlineClientEffects bodyFingerprint={bodyFingerprint} />
    </PublishedTailwindNavBridge>
  );
}

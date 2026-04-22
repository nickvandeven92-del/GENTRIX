import type { TailwindPageConfig, TailwindSection } from "@/lib/ai/tailwind-sections-schema";
import type { GeneratedLogoSet } from "@/types/logo";
import { rewriteStudioDevOriginsInHtml } from "@/lib/site/rewrite-published-html-origins";
import { buildTailwindIframeSrcDoc } from "@/lib/site/tailwind-page-html";
import { extractTailwindPageParts } from "@/lib/site/tailwind-page-html-to-parts";
import { filterSectionsForPublicSite } from "@/lib/site/studio-section-visibility";
import {
  type ContactSubpageNavScriptInput,
  publicSiteIframeDocumentPathname,
} from "@/lib/site/tailwind-contact-subpage";
import { PublishedTailwindAssets } from "@/components/site/published-tailwind-assets";
import { PublishedTailwindNavBridge } from "@/components/site/published-tailwind-nav-bridge";
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
 * – Elke navigatie is een full SSR page-load → Alpine/Tailwind/etc. herinitialiseren betrouwbaar
 *   én de browser houdt de oude pagina zichtbaar tot de nieuwe klaar is (geen flash)
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
}: PublicPublishedTailwindInlineProps) {
  const filtered = filterSectionsForPublicSite(sections);
  const iframeDocumentPathname = publicSiteIframeDocumentPathname(
    publishedSlug,
    contactSubpageNavBase ?? undefined,
  );
  const ssrOrigin = deriveSSROrigin();
  const contactSubpageNav =
    contactSubpageNavBase && ssrOrigin
      ? { ...contactSubpageNavBase, pageOrigin: ssrOrigin }
      : undefined;

  let fullHtml: string;
  try {
    fullHtml = buildTailwindIframeSrcDoc(filtered, pageConfig, {
      previewPostMessageBridge: false,
      userCss,
      userJs,
      logoSet,
      publishedSlug: publishedSlug?.trim(),
      draftPublicPreviewToken: draftPublicPreviewToken?.trim() || undefined,
      appointmentsEnabled,
      webshopEnabled,
      compiledTailwindCss: compiledTailwindCss?.trim() || undefined,
      previewScriptOrigin: ssrOrigin || undefined,
      navBrandLabel: navBrandLabel?.trim() || undefined,
      iframeDocumentPathname,
      ...(contactSubpageNav ? { contactSubpageNav } : {}),
    });
    if (ssrOrigin) fullHtml = rewriteStudioDevOriginsInHtml(fullHtml, ssrOrigin);
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

  return (
    <PublishedTailwindNavBridge>
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
        title={docTitle}
        {...parts.bodyDataAttrs}
        dangerouslySetInnerHTML={{ __html: parts.bodyHtml }}
      />
    </PublishedTailwindNavBridge>
  );
}

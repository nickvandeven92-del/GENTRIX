import type { PublishedSitePayload } from "@/lib/site/project-published-payload";
import { ReactPublishedSiteView } from "@/components/site/react-published-site-view";
import {
  composePublicMarketingTailwindSections,
  type ComposePublicMarketingPlan,
} from "@/lib/site/public-site-composition";
import { filterSectionsForPublicSite } from "@/lib/site/studio-section-visibility";
import { PublicPublishedTailwind } from "@/components/site/public-published-tailwind";
import { PublicPublishedTailwindInline } from "@/components/site/public-published-tailwind-inline";
import { SiteRenderer } from "@/components/site/site-renderer";
import {
  contactNavCaptureFragmentId,
  hasResolvedPublicContactRoute,
  landingSectionIdsForPublicSubpageNav,
  resolvePublicTailwindContactPlan,
  selectTailwindSectionsForPublicView,
  type ContactSubpageNavScriptInput,
} from "@/lib/site/tailwind-contact-subpage";
import { ensureFooterAppendedFromLanding } from "@/lib/site/ensure-footer-on-subpage";
import { cn } from "@/lib/utils";
import { formatSlugForDisplay } from "@/lib/slug";
import { GentrixPublicSiteAnalytics } from "@/components/analytics/gentrix-public-site-analytics";
import type { PublishedSiteSoftNavContext } from "@/lib/site/published-site-soft-nav";

type PublishedSiteViewProps = {
  payload: PublishedSitePayload;
  className?: string;
  publishedSlug?: string;
  /** Concept met geldige token (`/site/...?token=`): iframe interne nav idem als live. */
  draftPublicPreviewToken?: string | null;
  visibility?: "public" | "portal";
  appointmentsEnabled?: boolean;
  webshopEnabled?: boolean;
  /**
   * Publieke Tailwind: `contact` = weergave voor `/site/[slug]/contact`
   * (`contactSections` in payload, of legacy split met `SITE_CONTACT_SUBPAGE=1`).
   */
  publicSiteTailwindPath?: "landing" | "contact";
  /**
   * Tailwind `marketingPages[key]` — echte subroute `/site/[slug]/[key]` (en preview-variant).
   */
  marketingSubpageKey?: string | null;
  /**
   * Admin-routes (concept-preview): `nav_overlay` gebruikt `position:fixed` — zonder dit kleef je aan de hele viewport.
   */
  embedReactInChrome?: boolean;
  /**
   * Publieke weergave op een pretty-URL-host (primair studio-domein of klant-domein):
   * strip `/site/{slug}` uit alle anchor-hrefs zodat bezoekers alleen `gentrix.nl/werkwijze` zien.
   */
  prettyPublicUrls?: boolean;
  /**
   * Flyer/QR-concept (`?flyer=1`): bij ontbrekende gecompileerde Tailwind geen “lege pagina” tot Play CDN klaar is.
   */
  relaxedTailwindCdnLoading?: boolean;
  /** Flyer/QR: interne links behouden `flyer=1` zodat de actiebalk op alle subpagina’s blijft. */
  flyerPreview?: boolean;
  /**
   * Site-studio generator (split-pane): zelfde **inline** preview als live `/site` + QR/flyer (`PublicPublishedTailwindInline`),
   * in een host met `transform` zodat `position:fixed` ten opzichte van de preview kleeft i.p.v. de hele admin.
   * Geen `iframe` — die gaf o.a. scroll- en hoogteproblemen in de ingebouwde editor.
   */
  studioTailwindPreviewIframe?: boolean;
};

/** Publieke weergave: `tailwind_sections` (HTML) of `react_sections` (legacy JSON-contract); legacy vrije JSON via `SiteRenderer`. */
export function PublishedSiteView({
  payload,
  className,
  publishedSlug,
  draftPublicPreviewToken,
  visibility = "public",
  appointmentsEnabled = true,
  webshopEnabled = true,
  publicSiteTailwindPath = "landing",
  marketingSubpageKey = null,
  embedReactInChrome = false,
  prettyPublicUrls = false,
  relaxedTailwindCdnLoading = false,
  flyerPreview = false,
  studioTailwindPreviewIframe = false,
}: PublishedSiteViewProps) {
  if (payload.kind === "react") {
    const slugForA = publishedSlug?.trim() ?? "";
    const isPreview = Boolean(draftPublicPreviewToken?.trim());
    return (
      <div className="relative flex min-h-screen w-full flex-1 flex-col">
        {visibility === "public" && slugForA ? (
          <GentrixPublicSiteAnalytics
            siteSlug={slugForA}
            pageKey="home"
            isPreview={isPreview}
            bookingModuleEnabled={appointmentsEnabled}
            webshopModuleEnabled={webshopEnabled}
            sessionType={isPreview ? "public_preview" : "public_site"}
            renderSurface="react_page"
          />
        ) : null}
        <ReactPublishedSiteView
          doc={payload.doc}
          className={cn("min-h-0 flex-1", className)}
          visibility={visibility}
          publishedSlug={publishedSlug}
          embedded={visibility === "portal" || embedReactInChrome}
          appointmentsEnabled={appointmentsEnabled}
          webshopEnabled={webshopEnabled}
        />
      </div>
    );
  }

  if (payload.kind === "tailwind") {
    const docTitle = payload.clientName?.trim() || "Website";
    const isFullPage = visibility !== "portal";
    const composePlan: ComposePublicMarketingPlan | undefined =
      visibility === "public"
        ? {
            sectionIdsOrdered: payload.sectionIdsOrdered,
            siteIr: payload.siteIr,
          }
        : undefined;

    const marketingKeys = Object.keys(payload.marketingPages ?? {});
    const marketingKey = typeof marketingSubpageKey === "string" ? marketingSubpageKey.trim() : "";
    const marketingPageSections =
      marketingKey !== "" && payload.marketingPages != null ? payload.marketingPages[marketingKey] : undefined;

    const sections =
      visibility === "public"
        ? composePublicMarketingTailwindSections(
            filterSectionsForPublicSite(payload.sections),
            {
              appointmentsEnabled,
              webshopEnabled,
            },
            composePlan,
          )
        : payload.sections;
    const contactPlan =
      visibility === "public"
        ? resolvePublicTailwindContactPlan(sections, payload.contactSections)
        : { kind: "none" as const };
    const twSectionsRaw =
      visibility === "public" && marketingPageSections != null && marketingPageSections.length > 0
        ? composePublicMarketingTailwindSections(
            filterSectionsForPublicSite(marketingPageSections),
            {
              appointmentsEnabled,
              webshopEnabled,
            },
            composePlan,
          )
        : visibility === "public"
          ? selectTailwindSectionsForPublicView(
              sections,
              publicSiteTailwindPath === "contact" ? "contact" : "landing",
              contactPlan,
            )
          : sections;

    /**
     * Elke publieke pagina sluit af met dezelfde footer als de landing. Contact- en marketing-
     * subpagina's worden door de generator zelden met een eigen footer-sectie opgeleverd;
     * daarom wordt de landings-footer hier idempotent achter de subpagina-secties gezet.
     */
    const isPublicSubpage =
      visibility === "public" &&
      ((marketingPageSections != null && marketingPageSections.length > 0) ||
        (publicSiteTailwindPath === "contact" && hasResolvedPublicContactRoute(contactPlan)));
    const twSections = isPublicSubpage
      ? ensureFooterAppendedFromLanding(twSectionsRaw, sections)
      : twSectionsRaw;
    const iframeTitle =
      marketingKey !== "" && marketingPageSections != null && marketingPageSections.length > 0
        ? `${docTitle} · ${formatSlugForDisplay(marketingKey)}`
        : publicSiteTailwindPath === "contact" && hasResolvedPublicContactRoute(contactPlan)
          ? `${docTitle} · Contact`
          : docTitle;

    /** Contact-subpage nav — gedeeld door SSR-build en client-prop. */
    const contactNavBase: Omit<ContactSubpageNavScriptInput, "pageOrigin"> | null =
      publishedSlug?.trim() &&
      visibility === "public" &&
      (hasResolvedPublicContactRoute(contactPlan) || marketingKeys.length > 0)
        ? {
            slug: publishedSlug.trim(),
            view:
              marketingKey !== "" && marketingPageSections != null && marketingPageSections.length > 0
                ? "marketing"
                : publicSiteTailwindPath === "contact"
                  ? "contact"
                  : "landing",
            activeMarketingSlug:
              marketingKey !== "" && marketingPageSections != null && marketingPageSections.length > 0
                ? marketingKey
                : undefined,
            contactSectionId: contactNavCaptureFragmentId(contactPlan),
            landingSectionIds: landingSectionIdsForPublicSubpageNav(sections, contactPlan),
            marketingSlugs: marketingKeys,
          }
        : null;

    const analyticsPageKey =
      marketingKey !== "" && marketingPageSections != null && marketingPageSections.length > 0
        ? `marketing:${marketingKey}`
        : publicSiteTailwindPath === "contact" && hasResolvedPublicContactRoute(contactPlan)
          ? "contact"
          : "home";

    /** Publieke weergave: dezelfde `PublicPublishedTailwindInline` stack als live `/site` (geen iframe in admin; zie `studioTailwindPreviewIframe`). */
    if (visibility === "public") {
      const slugForA = publishedSlug?.trim() ?? "";
      const isPreview = Boolean(draftPublicPreviewToken?.trim());
      const publishedSiteSoftNav: PublishedSiteSoftNavContext | null =
        slugForA && contactNavBase ? { siteSlug: slugForA, prettyPublicUrls } : null;
      const publicInlinePreview = (
        <PublicPublishedTailwindInline
          sections={twSections}
          pageConfig={payload.config}
          publishedSlug={publishedSlug}
          draftPublicPreviewToken={draftPublicPreviewToken}
          userCss={payload.customCss}
          userJs={payload.customJs}
          logoSet={payload.logoSet}
          compiledTailwindCss={payload.tailwindCompiledCss}
          documentTitle={iframeTitle}
          navBrandLabel={docTitle}
          appointmentsEnabled={appointmentsEnabled}
          webshopEnabled={webshopEnabled}
          contactSubpageNavBase={contactNavBase}
          designContract={payload.designContract}
          prettyPublicUrls={prettyPublicUrls}
          relaxedTailwindCdnLoading={relaxedTailwindCdnLoading}
          flyerPreview={flyerPreview}
          publishedSiteSoftNav={publishedSiteSoftNav}
        />
      );
      return (
        <div className={cn("relative flex w-full min-w-0 flex-1 flex-col", className)}>
          {slugForA ? (
            <GentrixPublicSiteAnalytics
              siteSlug={slugForA}
              pageKey={analyticsPageKey}
              isPreview={isPreview}
              bookingModuleEnabled={appointmentsEnabled}
              webshopModuleEnabled={webshopEnabled}
              sessionType={isPreview ? "public_preview" : "public_site"}
              renderSurface="public_inline"
            />
          ) : null}
          {studioTailwindPreviewIframe ? (
            <div
              className="min-h-0 w-full min-w-0 flex-1 overflow-y-auto will-change-transform [transform:translateZ(0)]"
              data-gentrix-studio-inline-preview="1"
            >
              {publicInlinePreview}
            </div>
          ) : (
            publicInlinePreview
          )}
        </div>
      );
    }

    return (
      <div
        className={cn(
          "relative flex w-full flex-col",
          isFullPage ? "h-dvh overflow-hidden" : "min-h-screen flex-1",
        )}
      >
        <PublicPublishedTailwind
          sections={twSections}
          pageConfig={payload.config}
          className={cn("min-h-0 flex flex-1 flex-col", className)}
          visibility={visibility}
          publishedSlug={publishedSlug}
          draftPublicPreviewToken={draftPublicPreviewToken}
          userCss={payload.customCss}
          userJs={payload.customJs}
          logoSet={payload.logoSet}
          compiledTailwindCss={payload.tailwindCompiledCss}
          documentTitle={iframeTitle}
          navBrandLabel={docTitle}
          embedded={visibility === "portal"}
          appointmentsEnabled={appointmentsEnabled}
          webshopEnabled={webshopEnabled}
          ssrSrcDoc={null}
          contactSubpageNavBase={contactNavBase}
          designContract={payload.designContract}
        />
      </div>
    );
  }

  if (visibility === "portal") {
    return (
      <div className={className ?? "min-h-screen bg-zinc-50 px-6 py-12 text-center text-sm text-zinc-700 dark:bg-zinc-950 dark:text-zinc-300"}>
        <p className="mx-auto max-w-md">
          Portaal-preview ondersteunt geen legacy JSON. Gebruik <strong>tailwind_sections</strong> met{" "}
          <code className="rounded bg-zinc-200 px-1 text-xs dark:bg-zinc-800">data-studio-visibility=&quot;portal&quot;</code>{" "}
          op portaal-secties, of migreer naar een moderne site in de studio.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("flex min-h-screen flex-col", className)}>
      <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs text-amber-950">
        <strong>Legacy-site</strong>. Genereer opnieuw in de site-studio (HTML + Tailwind).
      </div>
      <SiteRenderer data={payload.site} publishedSlug={publishedSlug} className="min-h-0 flex-1" />
    </div>
  );
}

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
import type { PublishedSiteSoftNavContext } from "@/lib/site/published-site-soft-nav";
import { GentrixPublicSiteAnalytics } from "@/components/analytics/gentrix-public-site-analytics";
import { buildPublicSiteGeneratorMeta } from "@/lib/analytics/public-site-generator-meta";
import type { PublicSocialGallery } from "@/lib/data/social-gallery";
import { SocialGalleryLandingSection } from "@/components/site/social-gallery-landing-section";
import {
  enhanceTailwindHeroSectionHtmlForPublicDelivery,
  invokeHeroLcpImagePreloadFromHtml,
} from "@/lib/site/tailwind-hero-public-delivery";

type PublishedSiteViewProps = {
  payload: PublishedSitePayload;
  className?: string;
  publishedSlug?: string;
  draftPublicPreviewToken?: string | null;
  visibility?: "public" | "portal";
  appointmentsEnabled?: boolean;
  webshopEnabled?: boolean;
  publicSiteTailwindPath?: "landing" | "contact";
  marketingSubpageKey?: string | null;
  embedReactInChrome?: boolean;
  prettyPublicUrls?: boolean;
  relaxedTailwindCdnLoading?: boolean;
  flyerPreview?: boolean;
  studioTailwindPreviewIframe?: boolean;
  socialGallery?: PublicSocialGallery | null;
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
  socialGallery = null,
}: PublishedSiteViewProps) {
  const socialGallerySection = socialGallery?.enabled ? (
    <SocialGalleryLandingSection items={socialGallery.items} layout="carousel" />
  ) : null;
  if (payload.kind === "react") {
    const slugForA = publishedSlug?.trim() ?? "";
    const isPreview = Boolean(draftPublicPreviewToken?.trim());
    const generatorMeta = buildPublicSiteGeneratorMeta({
      generationPackage: payload.generationPackage,
    });
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
            generatorMeta={generatorMeta}
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
        {visibility === "public" ? socialGallerySection : null}
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

    const isPublicSubpage =
      visibility === "public" &&
      ((marketingPageSections != null && marketingPageSections.length > 0) ||
        (publicSiteTailwindPath === "contact" && hasResolvedPublicContactRoute(contactPlan)));
    const twSectionsBase = isPublicSubpage
      ? ensureFooterAppendedFromLanding(twSectionsRaw, sections)
      : twSectionsRaw;

    // ── PROFESSIONAL FIX ─────────────────────────────────────────────────────
    // Geen statische HTML-injectie meer voor de social gallery. De React-
    // component <SocialGalleryLandingSection /> wordt na de Tailwind-render
    // gemount, zodat Embla/carousel-logica correct hydrateert.
    const twSections = twSectionsBase;
    const shouldRenderSocialGalleryOnLanding =
      visibility === "public" &&
      !isPublicSubpage &&
      publicSiteTailwindPath === "landing" &&
      marketingKey === "" &&
      socialGallery?.enabled === true;
    // ─────────────────────────────────────────────────────────────────────────

    const twSectionsForDelivery = twSections.map((row) =>
      row.id === "hero"
        ? { ...row, html: enhanceTailwindHeroSectionHtmlForPublicDelivery(row.html) }
        : row,
    );
    if (visibility === "public" && !studioTailwindPreviewIframe) {
      const heroRow = twSectionsForDelivery.find((r) => r.id === "hero");
      if (heroRow) invokeHeroLcpImagePreloadFromHtml(heroRow.html);
    }
    const iframeTitle =
      marketingKey !== "" && marketingPageSections != null && marketingPageSections.length > 0
        ? `${docTitle} · ${formatSlugForDisplay(marketingKey)}`
        : publicSiteTailwindPath === "contact" && hasResolvedPublicContactRoute(contactPlan)
          ? `${docTitle} · Contact`
          : docTitle;

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

    if (visibility === "public") {
      const slugForA = publishedSlug?.trim() ?? "";
      const isPreview = Boolean(draftPublicPreviewToken?.trim());
      const generatorMeta = buildPublicSiteGeneratorMeta({
        generationPackage: payload.generationPackage,
        sectionIdsOrdered: payload.sectionIdsOrdered,
        siteIr: payload.siteIr,
        config: payload.config,
      });
      const publishedSiteSoftNav: PublishedSiteSoftNavContext | null =
        slugForA && contactNavBase ? { siteSlug: slugForA, prettyPublicUrls } : null;
      const publicInlinePreview = (
        <PublicPublishedTailwindInline
          sections={twSectionsForDelivery}
          pageConfig={payload.config}
          publishedSlug={publishedSlug}
          draftPublicPreviewToken={draftPublicPreviewToken}
          userCss={payload.customCss}
          userJs={payload.customJs}
          logoSet={payload.logoSet}
          rasterBrandSet={payload.rasterBrandSet}
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
              renderSurface={studioTailwindPreviewIframe ? "public_iframe" : "public_inline"}
              generatorMeta={generatorMeta}
            />
          ) : null}
          {studioTailwindPreviewIframe ? (
            <div
              className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden"
              data-gentrix-studio-generator-iframe-preview="1"
            >
              <PublicPublishedTailwind
                sections={twSectionsForDelivery}
                pageConfig={payload.config}
                className="min-h-0 flex-1"
                publishedSlug={publishedSlug}
                draftPublicPreviewToken={draftPublicPreviewToken}
                userCss={payload.customCss}
                userJs={payload.customJs}
                logoSet={payload.logoSet}
                rasterBrandSet={payload.rasterBrandSet}
                compiledTailwindCss={payload.tailwindCompiledCss}
                documentTitle={iframeTitle}
                navBrandLabel={docTitle}
                appointmentsEnabled={appointmentsEnabled}
                webshopEnabled={webshopEnabled}
                contactSubpageNavBase={contactNavBase}
                designContract={payload.designContract}
                previewPostMessageBridge
                autoResizeFromPostMessage
                documentHeightMode="panel"
                maxMeasuredHeight={3200}
              />
            </div>
          ) : (
            publicInlinePreview
          )}
          {shouldRenderSocialGalleryOnLanding ? socialGallerySection : null}
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
          sections={twSectionsForDelivery}
          pageConfig={payload.config}
          className={cn("min-h-0 flex flex-1 flex-col", className)}
          visibility={visibility}
          publishedSlug={publishedSlug}
          draftPublicPreviewToken={draftPublicPreviewToken}
          userCss={payload.customCss}
          userJs={payload.customJs}
          logoSet={payload.logoSet}
          rasterBrandSet={payload.rasterBrandSet}
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
      {visibility === "public" ? socialGallerySection : null}
    </div>
  );
}

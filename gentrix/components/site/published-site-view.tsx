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
import type { TailwindSection } from "@/lib/ai/tailwind-sections-schema";
import {
  enhanceTailwindHeroSectionHtmlForPublicDelivery,
  invokeHeroLcpImagePreloadFromHtml,
} from "@/lib/site/tailwind-hero-public-delivery";

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
   * Site-studio generator (split-pane): **iframe**-preview (`PublicPublishedTailwind`) i.p.v. inline + `transform`,
   * zodat `position: fixed` / zwevende nav dezelfde containing block heeft als de HTML-editor-preview en een echte
   * browsertab (niet het getransformeerde preview-paneel — dat gaf uitlijningverschil t.o.v. live `/site`).
   */
  studioTailwindPreviewIframe?: boolean;
  socialGallery?: PublicSocialGallery | null;
};

function injectSocialGalleryBlueprintSection(
  sections: TailwindSection[],
  socialGallery: PublicSocialGallery | null,
): TailwindSection[] {
  if (!socialGallery?.enabled) return sections;

  const placeholderCards = Array.from({ length: 9 }, () => {
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 600 600'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop stop-color='#0f172a' offset='0'/><stop stop-color='#1e293b' offset='1'/></linearGradient></defs><rect width='600' height='600' fill='url(#g)'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='#e2e8f0' font-size='46' font-family='Arial, Helvetica, sans-serif' letter-spacing='4'>GENTRIX</text></svg>`;
    const encoded = encodeURIComponent(svg);
    return `<div class="group relative block aspect-square overflow-hidden" style="border:1px solid var(--site-border, color-mix(in srgb, var(--site-fg, #111827) 18%, transparent)); border-radius:var(--radius-xl, var(--radius-lg, 1rem)); background:var(--site-surface, var(--site-bg, #ffffff)); box-shadow:0 6px 20px color-mix(in srgb, var(--site-fg, #111827) 10%, transparent);"><img src="data:image/svg+xml;utf8,${encoded}" alt="GENTRIX preview placeholder" class="h-full w-full object-cover" /></div>`;
  }).join("");

  const realCards = socialGallery.items
    .slice(0, 9)
    .map((item) => {
      const href = item.permalink ?? item.url;
      const caption = (item.caption ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");
      return `<a href="${href}" target="_blank" rel="noopener noreferrer" class="group relative block aspect-square overflow-hidden" style="border:1px solid var(--site-border, color-mix(in srgb, var(--site-fg, #111827) 18%, transparent)); border-radius:var(--radius-xl, var(--radius-lg, 1rem)); background:var(--site-surface, var(--site-bg, #ffffff)); box-shadow:0 6px 20px color-mix(in srgb, var(--site-fg, #111827) 10%, transparent);">
  <img src="${item.url}" alt="${caption}" loading="lazy" class="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" />
</a>`;
    })
    .join("");
  const cards =
    socialGallery.items.length >= 9
      ? realCards
      : `${realCards}${placeholderCards
          .split("</div>")
          .filter(Boolean)
          .slice(0, Math.max(0, 9 - socialGallery.items.length))
          .map((part) => `${part}</div>`)
          .join("")}`;

  if (!cards) return sections;

  // Public landing should always render social feed as carousel.
  // This avoids stale/incorrect persisted layout values forcing grid output.
  const useCarousel = true;
  const html = `<section id="social-gallery-placeholder" data-studio-section-role="gallery"${useCarousel ? ' data-social-gallery-carousel="1"' : ""} class="bg-white px-6 py-20 sm:px-10 lg:px-16 lg:py-28">
  <div class="mx-auto max-w-6xl">
    <div class="${useCarousel ? "relative px-10" : ""}">
      <div data-social-gallery-track="1" class="grid grid-cols-3 gap-3">${cards}</div>
    </div>
  </div>
</section>`;

  const baseSections = sections.filter((section) => (section.id ?? "").trim() !== "social-gallery-placeholder");
  const socialSection: TailwindSection = {
    id: "social-gallery-placeholder",
    sectionName: "Social Gallery",
    semanticRole: "gallery",
    html,
  };
  const heroIndex = baseSections.findIndex((section) => (section.id ?? "").trim() === "hero");
  if (heroIndex >= 0) {
    return [...baseSections.slice(0, heroIndex + 1), socialSection, ...baseSections.slice(heroIndex + 1)];
  }
  if (baseSections.length > 0) {
    return [baseSections[0], socialSection, ...baseSections.slice(1)];
  }
  return [socialSection];
}

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

    /**
     * Elke publieke pagina sluit af met dezelfde footer als de landing. Contact- en marketing-
     * subpagina's worden door de generator zelden met een eigen footer-sectie opgeleverd;
     * daarom wordt de landings-footer hier idempotent achter de subpagina-secties gezet.
     */
    const isPublicSubpage =
      visibility === "public" &&
      ((marketingPageSections != null && marketingPageSections.length > 0) ||
        (publicSiteTailwindPath === "contact" && hasResolvedPublicContactRoute(contactPlan)));
    const twSectionsBase = isPublicSubpage
      ? ensureFooterAppendedFromLanding(twSectionsRaw, sections)
      : twSectionsRaw;
    const twSections =
      visibility === "public" && !isPublicSubpage && publicSiteTailwindPath === "landing" && marketingKey === ""
        ? injectSocialGalleryBlueprintSection(
            twSectionsBase,
            socialGallery,
          )
        : twSectionsBase;
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

    /** Publieke weergave: standaard `PublicPublishedTailwindInline` als live `/site`; studio-generator gebruikt iframe (zie `studioTailwindPreviewIframe`). */
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

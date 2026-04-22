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
import { cn } from "@/lib/utils";
import { formatSlugForDisplay } from "@/lib/slug";

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
}: PublishedSiteViewProps) {
  if (payload.kind === "react") {
    return (
      <div className="relative flex min-h-screen w-full flex-1 flex-col">
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
    const twSections =
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

    /**
     * Publieke weergave — **geen iframe**: HTML wordt direct in de Next.js-pagina gerenderd
     * (Optie A). Portaal blijft iframe-based zodat inline visual editing mogelijk blijft.
     */
    if (visibility === "public") {
      return (
        <div className={cn("relative flex w-full flex-1 flex-col", className)}>
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
          />
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

import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ConceptFlyerExperienceLazy } from "@/components/site/concept-flyer-experience-lazy";
import { PublishedSiteView } from "@/components/site/published-site-view";
import { getPublishedSiteBySlug } from "@/lib/data/get-published-site";
import { composePublicMarketingTailwindSections } from "@/lib/site/public-site-composition";
import { filterSectionsForPublicSite } from "@/lib/site/studio-section-visibility";
import { readPrettyPublicUrlContext, toPrettyPublicRedirectTarget } from "@/lib/site/pretty-public-url";
import { buildNextPublishedSiteIcons } from "@/lib/site/site-identity-favicon";
import {
  hasResolvedPublicContactRoute,
  resolvePublicTailwindContactPlan,
} from "@/lib/site/tailwind-contact-subpage";
import { decodeRouteSlugParam, formatSlugForDisplay } from "@/lib/slug";
import { isLegacyTailwindPageConfig } from "@/lib/ai/tailwind-sections-schema";
import {
  computePublicSiteShellColors,
  publicSiteShellGlobalCssBlock,
} from "@/lib/site/public-site-shell-inline-style";

type ContactSitePageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ token?: string; flyer?: string }>;
};

export const revalidate = 60;

export async function generateMetadata({ params, searchParams }: ContactSitePageProps): Promise<Metadata> {
  try {
    const { slug: raw } = await params;
    const slug = decodeRouteSlugParam(raw);
    const sp = await searchParams;
    const previewToken = typeof sp.token === "string" ? sp.token : "";
    if (!slug) {
      return { title: "Contact" };
    }
    const bundle = await getPublishedSiteBySlug(slug, previewToken);
    if (!bundle) {
      return { title: "Contact" };
    }
    const conceptRobots = bundle.isConceptTokenAccess
      ? ({ robots: { index: false, follow: false } } as const)
      : ({} as const);
    const row = bundle.payload;
    if (row.kind !== "tailwind") {
      return { title: "Contact" };
    }
    const displayName = row.clientName?.trim() || formatSlugForDisplay(slug);
    const title = `${displayName} · Contact`;
    return {
      title,
      description: `Neem contact op met ${displayName}`,
      ...conceptRobots,
      icons: buildNextPublishedSiteIcons({
        logoFavicon: row.logoSet?.variants?.favicon,
        displayName,
        slug,
        pageConfig: row.config ?? null,
      }),
    };
  } catch {
    return { title: "Contact", robots: { index: true, follow: true } };
  }
}

/** Contact-subpad: zelfde opgeslagen site als de landingspagina; alleen weergave (geen wijziging aan generator-JSON). */
export default async function PublicClientSiteContactPage({ params, searchParams }: ContactSitePageProps) {
  const { slug: raw } = await params;
  const slug = decodeRouteSlugParam(raw);
  if (!slug) notFound();

  const sp = await searchParams;
  const previewToken = typeof sp.token === "string" ? sp.token : "";
  const qs = new URLSearchParams();
  if (previewToken.trim()) qs.set("token", previewToken.trim());
  if (sp.flyer === "1") qs.set("flyer", "1");
  const tq = qs.toString() ? `?${qs.toString()}` : "";

  const bundle = await getPublishedSiteBySlug(slug, previewToken);
  if (!bundle) notFound();

  const prettyCtx = await readPrettyPublicUrlContext();
  const prettyPublicUrls = prettyCtx.active && !bundle.isConceptTokenAccess;

  if (bundle.payload.kind !== "tailwind") {
    redirect(toPrettyPublicRedirectTarget(`/site/${encodeURIComponent(slug)}${tq}`, prettyCtx));
  }

  const sections = composePublicMarketingTailwindSections(
    filterSectionsForPublicSite(bundle.payload.sections),
    {
      appointmentsEnabled: bundle.appointmentsEnabled,
      webshopEnabled: bundle.webshopEnabled,
    },
    bundle.payload.kind === "tailwind"
      ? { sectionIdsOrdered: bundle.payload.sectionIdsOrdered, siteIr: bundle.payload.siteIr }
      : undefined,
  );

  const contactPlan = resolvePublicTailwindContactPlan(
    sections,
    bundle.payload.kind === "tailwind" ? bundle.payload.contactSections : undefined,
  );
  if (!hasResolvedPublicContactRoute(contactPlan)) {
    redirect(toPrettyPublicRedirectTarget(`/site/${encodeURIComponent(slug)}${tq}`, prettyCtx));
  }

  const showFlyer = sp.flyer === "1" && bundle.isConceptTokenAccess;
  const hasCompiledTailwindCss = Boolean(bundle.payload.tailwindCompiledCss?.trim());
  const flyerRelaxedTailwindCdn = showFlyer && !hasCompiledTailwindCss;
  const siteLabel = bundle.payload.clientName?.trim() || formatSlugForDisplay(slug);
  const flyerTailwindPageConfig =
    bundle.payload.config != null && !isLegacyTailwindPageConfig(bundle.payload.config) ? bundle.payload.config : null;

  const shell = computePublicSiteShellColors(bundle.payload);

  return (
    <>
      <style>{publicSiteShellGlobalCssBlock(shell)}</style>
      <PublishedSiteView
        payload={bundle.payload}
        publishedSlug={slug}
        appointmentsEnabled={bundle.appointmentsEnabled}
        webshopEnabled={bundle.webshopEnabled}
        publicSiteTailwindPath="contact"
        draftPublicPreviewToken={bundle.isConceptTokenAccess ? (bundle.conceptPreviewToken ?? previewToken) : null}
        prettyPublicUrls={prettyPublicUrls}
        relaxedTailwindCdnLoading={flyerRelaxedTailwindCdn}
        flyerPreview={showFlyer}
      />
      {showFlyer ? (
        <ConceptFlyerExperienceLazy
          siteLabel={siteLabel}
          slug={slug}
          appointmentsEnabled={bundle.appointmentsEnabled}
          webshopEnabled={bundle.webshopEnabled}
          tailwindPageConfig={flyerTailwindPageConfig}
          previewToken={bundle.isConceptTokenAccess ? (bundle.conceptPreviewToken ?? previewToken) : null}
          preserveFlyerQuery={showFlyer}
        />
      ) : null}
    </>
  );
}

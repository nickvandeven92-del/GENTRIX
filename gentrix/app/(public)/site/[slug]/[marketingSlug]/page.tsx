import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ConceptFlyerExperienceLazy } from "@/components/site/concept-flyer-experience-lazy";
import { PublishedSiteView } from "@/components/site/published-site-view";
import { getPublishedSiteBySlug } from "@/lib/data/get-published-site";
import { readPrettyPublicUrlContext, toPrettyPublicRedirectTarget } from "@/lib/site/pretty-public-url";
import { buildNextPublishedSiteIcons } from "@/lib/site/site-identity-favicon";
import { resolveMarketingPageKeyForUrlSegment } from "@/lib/site/marketing-path-aliases";
import { decodeRouteSlugParam, formatSlugForDisplay } from "@/lib/slug";
import { isLegacyTailwindPageConfig } from "@/lib/ai/tailwind-sections-schema";
import {
  computePublicSiteShellColors,
  publicSiteShellGlobalCssBlock,
} from "@/lib/site/public-site-shell-inline-style";

type MarketingSitePageProps = {
  params: Promise<{ slug: string; marketingSlug: string }>;
  searchParams: Promise<{ token?: string; flyer?: string }>;
};

export const revalidate = 60;

export async function generateMetadata({ params, searchParams }: MarketingSitePageProps): Promise<Metadata> {
  try {
    const { slug: raw, marketingSlug: rawSeg } = await params;
    const slug = decodeRouteSlugParam(raw);
    const seg = decodeRouteSlugParam(rawSeg);
    const sp = await searchParams;
    const previewToken = typeof sp.token === "string" ? sp.token : "";
    if (!slug || !seg) {
      return { title: "Pagina" };
    }
    const bundle = await getPublishedSiteBySlug(slug, previewToken);
    if (!bundle || bundle.payload.kind !== "tailwind") {
      return { title: "Pagina" };
    }
    const conceptRobots = bundle.isConceptTokenAccess
      ? ({ robots: { index: false, follow: false } } as const)
      : ({} as const);
    const pages = bundle.payload.marketingPages;
    const resolvedSeg = resolveMarketingPageKeyForUrlSegment(seg, pages ?? null);
    if (!resolvedSeg || !pages?.[resolvedSeg]) {
      return { title: "Pagina" };
    }
    const displayName = bundle.payload.clientName?.trim() || formatSlugForDisplay(slug);
    const title = `${displayName} · ${formatSlugForDisplay(resolvedSeg)}`;
    return {
      title,
      description: `${displayName} — ${formatSlugForDisplay(seg)}`,
      ...conceptRobots,
      icons: buildNextPublishedSiteIcons({
        rasterFavicon32Url: bundle.payload.rasterBrandSet?.favicon32Url,
        rasterFavicon192Url: bundle.payload.rasterBrandSet?.favicon192Url,
        logoFavicon: bundle.payload.logoSet?.variants?.favicon,
        displayName,
        slug,
        pageConfig: bundle.payload.config ?? null,
      }),
    };
  } catch {
    return { title: "Pagina", robots: { index: true, follow: true } };
  }
}

/** Marketing-subroute: HTML uit `marketingPages` in site_data_json. */
export default async function PublicClientSiteMarketingSubPage({ params, searchParams }: MarketingSitePageProps) {
  const { slug: raw, marketingSlug: rawSeg } = await params;
  const slug = decodeRouteSlugParam(raw);
  const seg = decodeRouteSlugParam(rawSeg);
  if (!slug || !seg) notFound();

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

  const pages = bundle.payload.marketingPages;
  const resolvedSeg = resolveMarketingPageKeyForUrlSegment(seg, pages ?? null);
  if (!resolvedSeg || !pages?.[resolvedSeg]?.length) {
    redirect(toPrettyPublicRedirectTarget(`/site/${encodeURIComponent(slug)}${tq}`, prettyCtx));
  }
  if (resolvedSeg !== seg) {
    redirect(
      toPrettyPublicRedirectTarget(
        `/site/${encodeURIComponent(slug)}/${encodeURIComponent(resolvedSeg)}${tq}`,
        prettyCtx,
      ),
    );
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
        marketingSubpageKey={resolvedSeg}
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

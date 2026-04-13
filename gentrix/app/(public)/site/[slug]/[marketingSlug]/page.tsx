import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ConceptFlyerExperience } from "@/components/site/concept-flyer-experience";
import { PublishedSiteView } from "@/components/site/published-site-view";
import { getPublishedSiteBySlug } from "@/lib/data/get-published-site";
import { MAX_FAVICON_DATA_URL_CHARS } from "@/lib/site/tailwind-page-html";
import { decodeRouteSlugParam, formatSlugForDisplay } from "@/lib/slug";

type MarketingSitePageProps = {
  params: Promise<{ slug: string; marketingSlug: string }>;
  searchParams: Promise<{ token?: string; flyer?: string }>;
};

export const maxDuration = 60;
export const dynamic = "force-dynamic";

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
    if (!pages?.[seg]) {
      return { title: "Pagina" };
    }
    const displayName = bundle.payload.clientName?.trim() || formatSlugForDisplay(slug);
    const title = `${displayName} · ${formatSlugForDisplay(seg)}`;
    const base = { title, description: `${displayName} — ${formatSlugForDisplay(seg)}`, ...conceptRobots };
    const fav = bundle.payload.logoSet?.variants.favicon?.trim() ?? "";
    if (!fav || fav.length > MAX_FAVICON_DATA_URL_CHARS) return base;
    return {
      ...base,
      icons: {
        icon: [
          {
            url: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(fav)}`,
            type: "image/svg+xml",
          },
        ],
      },
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

  if (bundle.payload.kind !== "tailwind") {
    redirect(`/site/${encodeURIComponent(slug)}${tq}`);
  }

  const pages = bundle.payload.marketingPages;
  if (!pages?.[seg]?.length) {
    redirect(`/site/${encodeURIComponent(slug)}${tq}`);
  }

  const showFlyer = sp.flyer === "1" && bundle.isConceptTokenAccess;
  const siteLabel = bundle.payload.clientName?.trim() || formatSlugForDisplay(slug);

  return (
    <>
      {showFlyer ? (
        <ConceptFlyerExperience
          siteLabel={siteLabel}
          slug={slug}
          appointmentsEnabled={bundle.appointmentsEnabled}
          webshopEnabled={bundle.webshopEnabled}
          previewToken={bundle.isConceptTokenAccess ? (bundle.conceptPreviewToken ?? previewToken) : null}
          preserveFlyerQuery={showFlyer}
        />
      ) : null}
      <PublishedSiteView
        payload={bundle.payload}
        publishedSlug={slug}
        appointmentsEnabled={bundle.appointmentsEnabled}
        webshopEnabled={bundle.webshopEnabled}
        marketingSubpageKey={seg}
        draftPublicPreviewToken={bundle.isConceptTokenAccess ? (bundle.conceptPreviewToken ?? previewToken) : null}
      />
    </>
  );
}

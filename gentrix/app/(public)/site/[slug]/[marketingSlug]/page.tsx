import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PublishedSiteView } from "@/components/site/published-site-view";
import { getPublishedSiteBySlug } from "@/lib/data/get-published-site";
import { MAX_FAVICON_DATA_URL_CHARS } from "@/lib/site/tailwind-page-html";
import { decodeRouteSlugParam, formatSlugForDisplay } from "@/lib/slug";

type MarketingSitePageProps = {
  params: Promise<{ slug: string; marketingSlug: string }>;
};

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: MarketingSitePageProps): Promise<Metadata> {
  try {
    const { slug: raw, marketingSlug: rawSeg } = await params;
    const slug = decodeRouteSlugParam(raw);
    const seg = decodeRouteSlugParam(rawSeg);
    if (!slug || !seg) {
      return { title: "Pagina" };
    }
    const bundle = await getPublishedSiteBySlug(slug);
    if (!bundle || bundle.payload.kind !== "tailwind") {
      return { title: "Pagina" };
    }
    const pages = bundle.payload.marketingPages;
    if (!pages?.[seg]) {
      return { title: "Pagina" };
    }
    const displayName = bundle.payload.clientName?.trim() || formatSlugForDisplay(slug);
    const title = `${displayName} · ${formatSlugForDisplay(seg)}`;
    const base = { title, description: `${displayName} — ${formatSlugForDisplay(seg)}` };
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
export default async function PublicClientSiteMarketingSubPage({ params }: MarketingSitePageProps) {
  const { slug: raw, marketingSlug: rawSeg } = await params;
  const slug = decodeRouteSlugParam(raw);
  const seg = decodeRouteSlugParam(rawSeg);
  if (!slug || !seg) notFound();

  const bundle = await getPublishedSiteBySlug(slug);
  if (!bundle) notFound();

  if (bundle.payload.kind !== "tailwind") {
    redirect(`/site/${encodeURIComponent(slug)}`);
  }

  const pages = bundle.payload.marketingPages;
  if (!pages?.[seg]?.length) {
    redirect(`/site/${encodeURIComponent(slug)}`);
  }

  return (
    <PublishedSiteView
      payload={bundle.payload}
      publishedSlug={slug}
      appointmentsEnabled={bundle.appointmentsEnabled}
      webshopEnabled={bundle.webshopEnabled}
      marketingSubpageKey={seg}
    />
  );
}

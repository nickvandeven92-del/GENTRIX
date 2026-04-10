import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublishedSiteView } from "@/components/site/published-site-view";
import { getPublishedSiteBySlug } from "@/lib/data/get-published-site";
import { decodeRouteSlugParam, formatSlugForDisplay } from "@/lib/slug";

type SitePageProps = {
  params: Promise<{ slug: string }>;
};

/** Vercel hobby: standaard ~10s; bij zware HTML-build iets ruimer (Pro/hogere limiet). */
export const maxDuration = 60;

export const dynamic = "force-dynamic";

/** Te grote data-URL’s in metadata kunnen SSR op Vercel laten falen. */
const MAX_METADATA_FAVICON_CHARS = 12_000;

export async function generateMetadata({ params }: SitePageProps): Promise<Metadata> {
  try {
    const { slug: raw } = await params;
    const slug = decodeRouteSlugParam(raw);
    const bundle = await getPublishedSiteBySlug(slug);
    if (!bundle) {
      return { title: "Site niet gevonden" };
    }
    const row = bundle.payload;
    if (row.kind === "legacy") {
      return {
        title: row.site.meta.title,
        description: row.site.meta.description,
      };
    }
    const displayName = row.clientName?.trim() || formatSlugForDisplay(slug);
    if (row.kind === "react") {
      const title = row.doc.documentTitle?.trim() || displayName;
      return {
        title,
        description: `Website van ${displayName}`,
      };
    }
    const base = {
      title: displayName,
      description: `Website van ${displayName}`,
    };
    const fav = row.logoSet?.variants.favicon?.trim() ?? "";
    if (!fav || fav.length > MAX_METADATA_FAVICON_CHARS) return base;
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
    return { title: "Site", robots: { index: true, follow: true } };
  }
}

/** Publieke klant-site: SSR + SiteRenderer of Tailwind-secties (SEO-vriendelijk). */
export default async function PublicClientSitePage({ params }: SitePageProps) {
  const { slug: raw } = await params;
  const slug = decodeRouteSlugParam(raw);
  if (!slug) notFound();

  const bundle = await getPublishedSiteBySlug(slug);
  if (!bundle) notFound();

  return (
    <PublishedSiteView
      payload={bundle.payload}
      publishedSlug={slug}
      appointmentsEnabled={bundle.appointmentsEnabled}
      webshopEnabled={bundle.webshopEnabled}
    />
  );
}

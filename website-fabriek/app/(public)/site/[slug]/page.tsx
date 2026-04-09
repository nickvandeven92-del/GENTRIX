import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublishedSiteView } from "@/components/site/published-site-view";
import { getPublishedSiteBySlug } from "@/lib/data/get-published-site";
import { formatSlugForDisplay } from "@/lib/slug";

type SitePageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: SitePageProps): Promise<Metadata> {
  const { slug } = await params;
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
  const fav = row.logoSet?.variants.favicon;
  if (!fav?.trim()) return base;
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
}

/** Publieke klant-site: SSR + SiteRenderer of Tailwind-secties (SEO-vriendelijk). */
export default async function PublicClientSitePage({ params }: SitePageProps) {
  const { slug } = await params;
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

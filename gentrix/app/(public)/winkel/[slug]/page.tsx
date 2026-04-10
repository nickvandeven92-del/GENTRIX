import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicWebshopLanding } from "@/components/public/public-webshop-landing";
import { PublishedSiteView } from "@/components/site/published-site-view";
import { getPublishedSiteBySlug } from "@/lib/data/get-published-site";
import { resolveActiveClientWebshopBySlug } from "@/lib/portal/resolve-portal-client";
import { composePublicMarketingTailwindSections } from "@/lib/site/public-site-composition";
import { filterSectionsForPublicSite } from "@/lib/site/studio-section-visibility";
import { getPublicAppUrl } from "@/lib/site/public-app-url";
import {
  appendShopCatalogEmbedSection,
  buildWebshopPageSections,
} from "@/lib/site/webshop-page-sections";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug: raw } = await params;
  const slug = decodeURIComponent(raw);
  const resolved = await resolveActiveClientWebshopBySlug(slug);
  if (!resolved.ok || !resolved.webshopEnabled) {
    return { title: "Webshop" };
  }
  const bundle = await getPublishedSiteBySlug(slug);
  const name =
    bundle?.payload && "clientName" in bundle.payload
      ? bundle.payload.clientName?.trim() || resolved.name
      : resolved.name;
  return { title: `Webshop — ${name}` };
}

export default async function PublicWebshopPage({ params }: Props) {
  const { slug: raw } = await params;
  const slug = decodeURIComponent(raw);
  const resolved = await resolveActiveClientWebshopBySlug(slug);
  if (!resolved.ok || !resolved.webshopEnabled) {
    notFound();
  }

  const appOrigin = getPublicAppUrl();
  const enc = encodeURIComponent(slug);
  const publicSiteHref = `${appOrigin}/site/${enc}`;
  const embedTemplate = process.env.NEXT_PUBLIC_WEBSHOP_IFRAME_SRC_TEMPLATE?.trim() || null;

  const bundle = await getPublishedSiteBySlug(slug);

  if (bundle?.payload.kind === "tailwind") {
    const filtered = composePublicMarketingTailwindSections(
      filterSectionsForPublicSite(bundle.payload.sections),
      {
        appointmentsEnabled: bundle.appointmentsEnabled,
        webshopEnabled: true,
      },
      bundle.payload.kind === "tailwind"
        ? { sectionIdsOrdered: bundle.payload.sectionIdsOrdered, siteIr: bundle.payload.siteIr }
        : undefined,
    );
    const sections = appendShopCatalogEmbedSection(buildWebshopPageSections(filtered), embedTemplate, slug);

    return (
      <PublishedSiteView
        payload={{
          ...bundle.payload,
          sections,
        }}
        publishedSlug={slug}
        appointmentsEnabled={bundle.appointmentsEnabled}
        webshopEnabled
      />
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <PublicWebshopLanding
        businessName={resolved.name}
        publicSiteHref={publicSiteHref}
        embedSrcTemplate={embedTemplate}
        subfolderSlug={slug}
      />
    </div>
  );
}

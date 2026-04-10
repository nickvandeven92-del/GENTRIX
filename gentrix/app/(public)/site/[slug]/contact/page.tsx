import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PublishedSiteView } from "@/components/site/published-site-view";
import { getPublishedSiteBySlug } from "@/lib/data/get-published-site";
import { composePublicMarketingTailwindSections } from "@/lib/site/public-site-composition";
import { filterSectionsForPublicSite } from "@/lib/site/studio-section-visibility";
import { MAX_FAVICON_DATA_URL_CHARS } from "@/lib/site/tailwind-page-html";
import { detectTailwindContactSubpagePlan } from "@/lib/site/tailwind-contact-subpage";
import { decodeRouteSlugParam, formatSlugForDisplay } from "@/lib/slug";

type ContactSitePageProps = {
  params: Promise<{ slug: string }>;
};

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: ContactSitePageProps): Promise<Metadata> {
  try {
    const { slug: raw } = await params;
    const slug = decodeRouteSlugParam(raw);
    if (!slug) {
      return { title: "Contact" };
    }
    const bundle = await getPublishedSiteBySlug(slug);
    if (!bundle) {
      return { title: "Contact" };
    }
    const row = bundle.payload;
    if (row.kind !== "tailwind") {
      return { title: "Contact" };
    }
    const displayName = row.clientName?.trim() || formatSlugForDisplay(slug);
    const title = `${displayName} · Contact`;
    const base = { title, description: `Neem contact op met ${displayName}` };
    const fav = row.logoSet?.variants.favicon?.trim() ?? "";
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
    return { title: "Contact", robots: { index: true, follow: true } };
  }
}

/** Contact-subpad: zelfde opgeslagen site als de landingspagina; alleen weergave (geen wijziging aan generator-JSON). */
export default async function PublicClientSiteContactPage({ params }: ContactSitePageProps) {
  const { slug: raw } = await params;
  const slug = decodeRouteSlugParam(raw);
  if (!slug) notFound();

  const bundle = await getPublishedSiteBySlug(slug);
  if (!bundle) notFound();

  if (bundle.payload.kind !== "tailwind") {
    redirect(`/site/${encodeURIComponent(slug)}`);
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

  if (!detectTailwindContactSubpagePlan(sections)) {
    redirect(`/site/${encodeURIComponent(slug)}`);
  }

  return (
    <PublishedSiteView
      payload={bundle.payload}
      publishedSlug={slug}
      appointmentsEnabled={bundle.appointmentsEnabled}
      webshopEnabled={bundle.webshopEnabled}
      publicSiteTailwindPath="contact"
    />
  );
}

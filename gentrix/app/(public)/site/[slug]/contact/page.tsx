import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ConceptFlyerExperience } from "@/components/site/concept-flyer-experience";
import { PublishedSiteView } from "@/components/site/published-site-view";
import { getPublishedSiteBySlug } from "@/lib/data/get-published-site";
import { composePublicMarketingTailwindSections } from "@/lib/site/public-site-composition";
import { filterSectionsForPublicSite } from "@/lib/site/studio-section-visibility";
import { MAX_FAVICON_DATA_URL_CHARS } from "@/lib/site/tailwind-page-html";
import {
  hasResolvedPublicContactRoute,
  resolvePublicTailwindContactPlan,
} from "@/lib/site/tailwind-contact-subpage";
import { decodeRouteSlugParam, formatSlugForDisplay } from "@/lib/slug";

type ContactSitePageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ token?: string; flyer?: string }>;
};

export const maxDuration = 60;
export const dynamic = "force-dynamic";

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
    const base = { title, description: `Neem contact op met ${displayName}`, ...conceptRobots };
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

  if (bundle.payload.kind !== "tailwind") {
    redirect(`/site/${encodeURIComponent(slug)}${tq}`);
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
        publicSiteTailwindPath="contact"
        draftPublicPreviewToken={bundle.isConceptTokenAccess ? (bundle.conceptPreviewToken ?? previewToken) : null}
      />
    </>
  );
}

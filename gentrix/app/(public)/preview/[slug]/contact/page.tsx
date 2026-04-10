import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PublishedSiteView } from "@/components/site/published-site-view";
import { getDraftPublishedSitePayloadBySlug } from "@/lib/data/client-draft-site";
import { getClientCommercialBySlug } from "@/lib/data/get-client-commercial-by-slug";
import { getPublicConceptPreviewAccess } from "@/lib/preview/public-concept-preview-access";
import { composePublicMarketingTailwindSections } from "@/lib/site/public-site-composition";
import { filterSectionsForPublicSite } from "@/lib/site/studio-section-visibility";
import { MAX_FAVICON_DATA_URL_CHARS } from "@/lib/site/tailwind-page-html";
import {
  hasResolvedPublicContactRoute,
  resolvePublicTailwindContactPlan,
} from "@/lib/site/tailwind-contact-subpage";
import { decodeRouteSlugParam, formatSlugForDisplay } from "@/lib/slug";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ token?: string }>;
};

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  try {
    const { slug } = await params;
    const slugDecoded = decodeRouteSlugParam(slug);
    if (!slugDecoded) {
      return { title: "Contact", robots: { index: false, follow: false } };
    }
    const payload = await getDraftPublishedSitePayloadBySlug(slugDecoded);
    if (!payload || payload.kind !== "tailwind") {
      return { title: "Contact", robots: { index: false, follow: false } };
    }
    const displayName = payload.clientName?.trim() || formatSlugForDisplay(slugDecoded);
    const title = `${displayName} · Contact`;
    const base = { title, description: `Neem contact op met ${displayName}`, robots: { index: false, follow: false } as const };
    const fav = payload.logoSet?.variants.favicon?.trim() ?? "";
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
    return { title: "Contact", robots: { index: false, follow: false } };
  }
}

/** Concept-preview contact-subpad: zelfde token als `/preview/[slug]`. */
export default async function PublicConceptPreviewContactPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const sp = await searchParams;
  const decoded = decodeRouteSlugParam(slug);
  if (!decoded) notFound();

  const token = typeof sp.token === "string" ? sp.token : "";
  const access = await getPublicConceptPreviewAccess(decoded, token);
  if (access === "not_found") notFound();
  if (access === "redirect_active") {
    redirect(`/site/${encodeURIComponent(decoded)}/contact`);
  }

  const supabase = createServiceRoleClient();
  const commercial = await getClientCommercialBySlug(decoded, supabase);
  const appointmentsEnabled = commercial?.appointments_enabled ?? false;
  const webshopEnabled = commercial?.webshop_enabled ?? false;

  const payload = await getDraftPublishedSitePayloadBySlug(decoded);
  if (!payload) notFound();

  if (payload.kind !== "tailwind") {
    redirect(`/preview/${encodeURIComponent(decoded)}?token=${encodeURIComponent(token)}`);
  }

  const sections = composePublicMarketingTailwindSections(
    filterSectionsForPublicSite(payload.sections),
    {
      appointmentsEnabled,
      webshopEnabled,
    },
    { sectionIdsOrdered: payload.sectionIdsOrdered, siteIr: payload.siteIr },
  );

  const contactPlan = resolvePublicTailwindContactPlan(sections, payload.contactSections);
  if (!hasResolvedPublicContactRoute(contactPlan)) {
    redirect(`/preview/${encodeURIComponent(decoded)}?token=${encodeURIComponent(token)}`);
  }

  return (
    <div className="flex min-h-screen flex-col">
      <div className="sticky top-0 z-10 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/90 dark:text-amber-100">
        <strong>Concept-preview</strong> — contactpagina (nog geen definitieve live-URL).
      </div>
      <PublishedSiteView
        payload={payload}
        publishedSlug={decoded}
        appointmentsEnabled={appointmentsEnabled}
        webshopEnabled={webshopEnabled}
        embedReactInChrome
        publicSiteTailwindPath="contact"
        draftPublicPreviewToken={token}
      />
    </div>
  );
}

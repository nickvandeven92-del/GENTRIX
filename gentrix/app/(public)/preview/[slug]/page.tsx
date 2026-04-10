import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PublishedSiteView } from "@/components/site/published-site-view";
import { getDraftPublishedSitePayloadBySlug } from "@/lib/data/client-draft-site";
import { getClientCommercialBySlug } from "@/lib/data/get-client-commercial-by-slug";
import { getPublicConceptPreviewAccess } from "@/lib/preview/public-concept-preview-access";
import { decodeRouteSlugParam, formatSlugForDisplay } from "@/lib/slug";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ token?: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const decoded = decodeRouteSlugParam(slug);
  const label = formatSlugForDisplay(decoded);
  return {
    title: `Concept · ${label}`,
    robots: { index: false, follow: false },
  };
}

/** Publieke concept-preview: alleen met geldige `token` query; niet geïndexeerd. */
export default async function PublicConceptPreviewPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const sp = await searchParams;
  const decoded = decodeRouteSlugParam(slug);
  if (!decoded) notFound();

  const token = typeof sp.token === "string" ? sp.token : "";
  const access = await getPublicConceptPreviewAccess(decoded, token);
  if (access === "not_found") notFound();
  if (access === "redirect_active") {
    redirect(`/site/${encodeURIComponent(decoded)}`);
  }

  const supabase = createServiceRoleClient();

  const payload = await getDraftPublishedSitePayloadBySlug(decoded);
  if (!payload) notFound();

  const commercial = await getClientCommercialBySlug(decoded, supabase);
  const appointmentsEnabled = commercial?.appointments_enabled ?? false;
  const webshopEnabled = commercial?.webshop_enabled ?? false;

  return (
    <div className="flex min-h-screen flex-col">
      <div className="sticky top-0 z-10 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/90 dark:text-amber-100">
        <strong>Concept-preview</strong> — dit is nog geen definitieve live-site. Na betaling en activatie wordt de site
        publiek op{" "}
        <code className="rounded bg-amber-100 px-1 font-mono dark:bg-amber-900/50">/site/{encodeURIComponent(decoded)}</code>
        .
      </div>
      <PublishedSiteView
        payload={payload}
        publishedSlug={decoded}
        appointmentsEnabled={appointmentsEnabled}
        webshopEnabled={webshopEnabled}
        embedReactInChrome
        draftPublicPreviewToken={token}
      />
    </div>
  );
}

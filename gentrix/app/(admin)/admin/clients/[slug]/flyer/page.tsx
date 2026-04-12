import { notFound } from "next/navigation";
import { ClientFlyerWorkspace } from "@/components/admin/client-flyer-workspace";
import { getClientSiteUrlsForAdminDossier } from "@/lib/data/client-preview-urls";
import { getFlyerScanSummary } from "@/lib/data/get-flyer-scan-summary";
import { getClientCommercialBySlug } from "@/lib/data/get-client-commercial-by-slug";
import { getRequestOrigin } from "@/lib/site/request-origin";

type PageProps = { params: Promise<{ slug: string }> };

export default async function ClientFlyerPage({ params }: PageProps) {
  const { slug: raw } = await params;
  const slug = decodeURIComponent(raw);
  if (!slug) notFound();

  const row = await getClientCommercialBySlug(slug);
  if (!row) notFound();

  const origin = await getRequestOrigin();
  const [urls, flyerScanSummary] = await Promise.all([
    getClientSiteUrlsForAdminDossier(row.subfolder_slug, origin),
    getFlyerScanSummary(row.id),
  ]);

  return (
    <ClientFlyerWorkspace
      slug={row.subfolder_slug}
      clientName={row.name}
      flyerQrAbsoluteUrl={urls?.flyerQrAbsolute ?? null}
      flyerScanSummary={flyerScanSummary}
    />
  );
}

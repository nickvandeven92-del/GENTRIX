import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FlyerHubWorkspace } from "@/components/admin/flyer-hub-workspace";
import { getClientSiteUrlsForAdminDossier } from "@/lib/data/client-preview-urls";
import { getClientFlyerStudioBySlugForAdmin } from "@/lib/data/get-client-flyer-studio";
import { getFlyerScanSummary } from "@/lib/data/get-flyer-scan-summary";
import { getClientCommercialBySlug } from "@/lib/data/get-client-commercial-by-slug";
import { getRequestOrigin } from "@/lib/site/request-origin";

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug: raw } = await params;
  const slug = decodeURIComponent(raw ?? "");
  if (!slug) return { title: "Flyer & QR" };
  const row = await getClientCommercialBySlug(slug);
  return { title: row ? `Flyer & QR — ${row.name}` : "Flyer & QR" };
}

export default async function AdminFlyerClientPage({ params }: PageProps) {
  const { slug: raw } = await params;
  const slug = decodeURIComponent(raw);
  if (!slug) notFound();

  const row = await getClientCommercialBySlug(slug);
  if (!row) notFound();

  const origin = await getRequestOrigin();
  const [urls, flyerScanSummary, initialFlyerStudio] = await Promise.all([
    getClientSiteUrlsForAdminDossier(row.subfolder_slug, origin),
    getFlyerScanSummary(row.id),
    getClientFlyerStudioBySlugForAdmin(row.subfolder_slug),
  ]);

  return (
    <FlyerHubWorkspace
      slug={row.subfolder_slug}
      clientName={row.name}
      flyerQrAbsoluteUrl={urls?.flyerQrAbsolute ?? null}
      flyerScanSummary={flyerScanSummary}
      initialFlyerStudio={initialFlyerStudio}
    />
  );
}

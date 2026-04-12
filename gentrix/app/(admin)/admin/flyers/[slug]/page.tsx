import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FlyerHubWorkspace } from "@/components/admin/flyer-hub-workspace";
import { getAdminFlyerQrAbsoluteUrl } from "@/lib/data/get-admin-flyer-qr-url";
import { getClientFlyerStudioBySlugForAdmin } from "@/lib/data/get-client-flyer-studio";
import { getFlyerScanSummary } from "@/lib/data/get-flyer-scan-summary";
import { getClientCommercialBySlug } from "@/lib/data/get-client-commercial-by-slug";
import { getRequestOrigin } from "@/lib/site/request-origin";

export const dynamic = "force-dynamic";

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
  const [flyerQrAbsoluteUrl, flyerScanSummary, initialFlyerStudio] = await Promise.all([
    getAdminFlyerQrAbsoluteUrl(row.subfolder_slug, origin),
    getFlyerScanSummary(row.id),
    getClientFlyerStudioBySlugForAdmin(row.subfolder_slug),
  ]);

  return (
    <FlyerHubWorkspace
      slug={row.subfolder_slug}
      clientName={row.name}
      flyerQrAbsoluteUrl={flyerQrAbsoluteUrl}
      flyerScanSummary={flyerScanSummary}
      initialFlyerStudio={initialFlyerStudio}
    />
  );
}

import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { ClientDossierShell } from "@/components/admin/client-dossier-shell";
import { getClientSiteUrlsForAdminDossier } from "@/lib/data/client-preview-urls";
import { getClientCommercialBySlug } from "@/lib/data/get-client-commercial-by-slug";
import { getRequestOrigin } from "@/lib/site/request-origin";

type LayoutProps = {
  children: ReactNode;
  params: Promise<{ slug: string }>;
};

export default async function ClientDossierLayout({ children, params }: LayoutProps) {
  const { slug: raw } = await params;
  const slug = decodeURIComponent(raw);
  if (!slug) notFound();

  const row = await getClientCommercialBySlug(slug);
  if (!row) notFound();

  const origin = await getRequestOrigin();
  const urls = await getClientSiteUrlsForAdminDossier(row.subfolder_slug, origin);

  return (
    <ClientDossierShell
      slug={row.subfolder_slug}
      clientName={row.name}
      liveSiteAbsoluteUrl={urls?.status === "active" ? urls.liveAbsolute : undefined}
      conceptPreviewAbsoluteUrl={urls?.previewAbsolute ?? null}
      clientStatus={row.status}
    >
      {children}
    </ClientDossierShell>
  );
}

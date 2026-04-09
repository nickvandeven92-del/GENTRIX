import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { ClientDossierShell } from "@/components/admin/client-dossier-shell";
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
  const enc = encodeURIComponent(row.subfolder_slug);
  const liveSiteAbsoluteUrl = origin ? `${origin}/site/${enc}` : undefined;

  return (
    <ClientDossierShell
      slug={row.subfolder_slug}
      clientName={row.name}
      liveSiteAbsoluteUrl={liveSiteAbsoluteUrl}
      clientStatus={row.status}
    >
      {children}
    </ClientDossierShell>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PublishedSiteView } from "@/components/site/published-site-view";
import { getDraftPublishedSitePayloadBySlug } from "@/lib/data/client-draft-site";
import { getAdminClientBySlug } from "@/lib/data/get-admin-client-by-slug";
import { getClientCommercialBySlug } from "@/lib/data/get-client-commercial-by-slug";
import { formatSlugForDisplay } from "@/lib/slug";

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const decoded = decodeURIComponent(slug ?? "");
  const row = await getAdminClientBySlug(decoded);
  const label = row?.name?.trim() || formatSlugForDisplay(decoded);
  return { title: `Concept-preview · ${label}` };
}

/** Fase 3: admin-only preview van het **concept** (draft-snapshot), niet de live pointer. */
export default async function ClientDraftPreviewPage({ params }: PageProps) {
  const { slug } = await params;
  const decoded = decodeURIComponent(slug ?? "");
  if (!decoded) notFound();

  const row = await getAdminClientBySlug(decoded);
  if (!row) notFound();

  const payload = await getDraftPublishedSitePayloadBySlug(decoded);
  if (!payload) notFound();

  const commercial = await getClientCommercialBySlug(decoded);
  const appointmentsEnabled = commercial?.appointments_enabled ?? false;
  const webshopEnabled = commercial?.webshop_enabled ?? false;

  const enc = encodeURIComponent(decoded);

  return (
    <div className="flex min-h-screen flex-col">
      <div className="sticky top-0 z-10 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/90 dark:text-amber-100">
        <strong>Concept-preview</strong> — dit is de werkversie (draft), niet per se wat live staat.{" "}
        <Link href={`/admin/editor/${enc}`} className="font-medium underline">
          Terug naar editor
        </Link>
        {" · "}
        <Link href={`/admin/clients/${enc}/snapshots`} className="font-medium underline">
          Snapshots
        </Link>
      </div>
      <PublishedSiteView
        payload={payload}
        publishedSlug={decoded}
        appointmentsEnabled={appointmentsEnabled}
        webshopEnabled={webshopEnabled}
        embedReactInChrome
      />
    </div>
  );
}

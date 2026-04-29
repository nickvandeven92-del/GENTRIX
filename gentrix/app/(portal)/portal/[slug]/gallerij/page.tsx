import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PortalSocialGalleryCard } from "@/components/portal/portal-social-gallery-card";
import { getActivePortalClient } from "@/lib/data/get-portal-client";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  if (!slug) return { title: "Gallerij" };
  const c = await getActivePortalClient(decodeURIComponent(slug));
  if (!c) return { title: "Gallerij" };
  return { title: `Gallerij — ${c.name}` };
}

export default async function PortalGalleryPage({ params }: Props) {
  const { slug } = await params;
  if (!slug) notFound();

  const decoded = decodeURIComponent(slug);
  const client = await getActivePortalClient(decoded);
  if (!client) notFound();

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Gallerij</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Koppel je social media en vul automatisch je website-gallerij met recente posts.
        </p>
      </div>
      <PortalSocialGalleryCard slug={slug} />
    </main>
  );
}

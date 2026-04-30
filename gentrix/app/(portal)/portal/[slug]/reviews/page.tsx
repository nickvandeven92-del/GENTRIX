import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PortalReviewsClient } from "@/components/portal/portal-reviews-client";
import { getActivePortalClient } from "@/lib/data/get-portal-client";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const portal = await getActivePortalClient(decodeURIComponent(slug));
  if (!portal) return { title: "Portaal" };
  return { title: `Reviews — ${portal.name}` };
}

export default async function PortalReviewsPage({ params }: Props) {
  const { slug } = await params;
  if (!slug) notFound();

  const decoded = decodeURIComponent(slug);
  const portal = await getActivePortalClient(decoded);
  if (!portal) notFound();

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Reviews koppelen</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Koppel hier Google of Trustpilot. De website toont eerst placeholders en schakelt na sync naar live reviews.
        </p>
      </div>
      <PortalReviewsClient slug={slug} />
    </main>
  );
}

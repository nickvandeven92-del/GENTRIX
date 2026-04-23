import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PortalSupportChat } from "@/components/portal/portal-support-chat";
import { getActivePortalClient } from "@/lib/data/get-portal-client";
import { listClientSupportThreads } from "@/lib/data/list-client-support-threads";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const decoded = decodeURIComponent(slug ?? "");
  const c = await getActivePortalClient(decoded);
  if (!c) return { title: "Support" };
  return { title: `Support — ${c.name}` };
}

export default async function PortalSupportPage({ params }: Props) {
  const { slug } = await params;
  if (!slug) notFound();

  const decoded = decodeURIComponent(slug);
  const client = await getActivePortalClient(decoded);
  if (!client) notFound();

  const [initialOpen, initialClosed] = await Promise.all([
    listClientSupportThreads(client.id, "open"),
    listClientSupportThreads(client.id, "closed"),
  ]);

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Support</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Stel een vraag aan de studio of volg je lopende onderwerpen. Gesloten onderwerpen vind je terug onder Archief.
        </p>
      </div>
      <PortalSupportChat slug={slug} initialOpen={initialOpen} initialClosed={initialClosed} />
    </main>
  );
}

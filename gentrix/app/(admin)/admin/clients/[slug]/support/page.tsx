import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ClientSupportPanel } from "@/components/admin/client-support-panel";
import { getClientCommercialBySlug } from "@/lib/data/get-client-commercial-by-slug";
import { listClientSupportThreads } from "@/lib/data/list-client-support-threads";

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const row = await getClientCommercialBySlug(decodeURIComponent(slug ?? ""));
  if (!row) return { title: "Support-chat" };
  return { title: `${row.name} — support-chat` };
}

export default async function ClientSupportChatPage({ params }: PageProps) {
  const { slug } = await params;
  const decoded = decodeURIComponent(slug ?? "");
  if (!decoded) notFound();

  const row = await getClientCommercialBySlug(decoded);
  if (!row) notFound();

  const [supportOpen, supportClosed] = await Promise.all([
    listClientSupportThreads(row.id, "open"),
    listClientSupportThreads(row.id, "closed"),
  ]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Portaalvragen per onderwerp. Gesloten onderwerpen vind je onder Archief.
      </p>
      <ClientSupportPanel
        subfolderSlug={row.subfolder_slug}
        initialOpen={supportOpen}
        initialClosed={supportClosed}
      />
    </div>
  );
}

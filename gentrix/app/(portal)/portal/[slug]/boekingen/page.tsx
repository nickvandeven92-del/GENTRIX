import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PortalBookingsHub } from "@/components/portal/portal-bookings-hub";
import { getActivePortalClient } from "@/lib/data/get-portal-client";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const c = await getActivePortalClient(decodeURIComponent(slug));
  if (!c) return { title: "Boekingen" };
  return { title: `Boekingen — ${c.name}` };
}

export default async function PortalBookingsPage({ params }: Props) {
  const { slug } = await params;
  if (!slug) notFound();

  const client = await getActivePortalClient(decodeURIComponent(slug));
  if (!client || !client.appointments_enabled) notFound();

  return (
    <main className="space-y-4">
      <div className="lg:hidden">
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Boekingen</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Agenda, diensten, team en weekplanning op één plek.
        </p>
      </div>
      <PortalBookingsHub slug={slug} clientName={client.name} />
    </main>
  );
}

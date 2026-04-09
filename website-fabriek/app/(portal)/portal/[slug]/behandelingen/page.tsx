import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PortalBookingServicesClient } from "@/components/portal/portal-booking-services-client";
import { getActivePortalClient } from "@/lib/data/get-portal-client";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const c = await getActivePortalClient(decodeURIComponent(slug));
  if (!c) return { title: "Behandelingen" };
  return { title: `Behandelingen — ${c.name}` };
}

export default async function PortalBookingServicesPage({ params }: Props) {
  const { slug } = await params;
  if (!slug) notFound();

  const client = await getActivePortalClient(decodeURIComponent(slug));
  if (!client || !client.appointments_enabled) notFound();

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Behandelingen</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Beheer welke diensten klanten op de boekpagina zien: naam, duur, prijs en actief/inactief. Zonder actieve
          behandelingen gebruikt de boekpagina alleen de standaard slotlengte uit je agenda-instellingen.
        </p>
      </div>
      <PortalBookingServicesClient slug={slug} />
    </main>
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PortalAppointmentsClient } from "@/components/portal/portal-appointments-client";
import { getActivePortalClient } from "@/lib/data/get-portal-client";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const c = await getActivePortalClient(decodeURIComponent(slug));
  if (!c) return { title: "Afspraken" };
  return { title: `Afspraken — ${c.name}` };
}

export default async function PortalAppointmentsPage({ params }: Props) {
  const { slug } = await params;
  if (!slug) notFound();

  const client = await getActivePortalClient(decodeURIComponent(slug));
  if (!client || !client.appointments_enabled) notFound();

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Afspraken</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Instellingen en agenda zijn gekoppeld aan de stap-voor-stap boekpagina voor bezoekers. Op deze pagina zie je een
          live voorbeeld, plan je handmatig mee, en beheer je bestaande afspraken (.ics voor je telefoon).
        </p>
      </div>
      <PortalAppointmentsClient slug={slug} clientName={client.name} />
    </main>
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PortalStaffClient } from "@/components/portal/portal-staff-client";
import { getActivePortalClient } from "@/lib/data/get-portal-client";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const c = await getActivePortalClient(decodeURIComponent(slug));
  if (!c) return { title: "Medewerkers" };
  return { title: `Medewerkers — ${c.name}` };
}

export default async function PortalStaffPage({ params }: Props) {
  const { slug } = await params;
  if (!slug) notFound();

  const client = await getActivePortalClient(decodeURIComponent(slug));
  if (!client || !client.appointments_enabled) notFound();

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Medewerkers</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Voeg teamleden toe voor interne planning. Alleen actieve medewerkers verschijnen in het weekrooster om te slepen.
        </p>
      </div>
      <PortalStaffClient slug={slug} />
    </main>
  );
}

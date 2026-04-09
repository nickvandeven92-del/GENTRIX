import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PortalPlanningWeekClient } from "@/components/portal/portal-planning-week-client";
import { getActivePortalClient } from "@/lib/data/get-portal-client";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const c = await getActivePortalClient(decodeURIComponent(slug));
  if (!c) return { title: "Planning" };
  return { title: `Planning — ${c.name}` };
}

export default async function PortalPlanningPage({ params }: Props) {
  const { slug } = await params;
  if (!slug) notFound();

  const client = await getActivePortalClient(decodeURIComponent(slug));
  if (!client || !client.appointments_enabled) notFound();

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Planning</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Weekrooster per medewerker: plan blokken via <strong>Taak inplannen</strong> (ook meerdere dagen tegelijk).
          Op de site kiezen klanten een medewerker; alleen wie die dag (of dat tijdvak) boekbaar is verschijnt in de lijst.
          Tijdzone staat onder Afspraken.
        </p>
      </div>
      <PortalPlanningWeekClient slug={slug} />
    </main>
  );
}

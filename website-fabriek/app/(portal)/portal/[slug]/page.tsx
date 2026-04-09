import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PortalDashboard } from "@/components/portal/portal-dashboard";
import { getActivePortalClient } from "@/lib/data/get-portal-client";
import { getPortalDashboardSnapshot } from "@/lib/data/get-portal-dashboard-snapshot";
import { getRequestOrigin } from "@/lib/site/request-origin";
import { getSupabaseForPortalDataReads } from "@/lib/portal/studio-portal-preview";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  if (!slug) return { title: "Portaal" };
  const c = await getActivePortalClient(decodeURIComponent(slug));
  if (!c) return { title: "Portaal" };
  return { title: `Dashboard — ${c.name}` };
}

/**
 * Portaal-start: alleen dashboard en modules. De publieke klant-site staat los op `/site/{slug}`
 * (en op het klantdomein); die open je via "Publieke site" — niet ingesloten in het portaal.
 */
export default async function ClientPortalOverviewPage({ params }: Props) {
  const { slug } = await params;
  if (!slug) notFound();

  const decoded = decodeURIComponent(slug);
  const client = await getActivePortalClient(decoded);
  if (!client) notFound();

  const db = await getSupabaseForPortalDataReads(client.portal_user_id);

  const [snapshot, origin] = await Promise.all([
    getPortalDashboardSnapshot(decoded, client, { supabaseForReads: db }),
    getRequestOrigin(),
  ]);
  const publicSiteAbsoluteUrl = origin ? `${origin}/site/${encodeURIComponent(decoded)}` : undefined;
  const publicBookingAbsoluteUrl = origin ? `${origin}/boek/${encodeURIComponent(decoded)}` : undefined;

  return (
    <main>
      <PortalDashboard
        slug={slug}
        clientName={client.name}
        snapshot={snapshot}
        invoicesEnabled={client.portal_invoices_enabled}
        appointmentsEnabled={client.appointments_enabled}
        accountEnabled={client.portal_account_enabled}
        publicSiteAbsoluteUrl={publicSiteAbsoluteUrl}
        publicBookingAbsoluteUrl={publicBookingAbsoluteUrl}
      />
    </main>
  );
}

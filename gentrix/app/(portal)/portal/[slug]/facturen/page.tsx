import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PortalFacturenClient } from "@/components/portal/portal-facturen-client";
import { getActivePortalClient } from "@/lib/data/get-portal-client";
import { listInvoices } from "@/lib/data/list-invoices";
import { getSupabaseForPortalDataReads } from "@/lib/portal/studio-portal-preview";
import { isInvoiceStatusVisibleInPortal, type InvoiceStoredStatus } from "@/lib/commercial/billing-helpers";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const c = await getActivePortalClient(decodeURIComponent(slug));
  if (!c || !c.portal_invoices_enabled) return { title: "Portaal" };
  return { title: `Facturen — ${c.name}` };
}

export default async function PortalFacturenPage({ params }: Props) {
  const { slug } = await params;
  if (!slug) notFound();

  const decoded = decodeURIComponent(slug);
  const client = await getActivePortalClient(decoded);
  if (!client || !client.portal_invoices_enabled) notFound();

  const db = await getSupabaseForPortalDataReads(client.portal_user_id);
  const all = await listInvoices({ clientId: client.id, supabase: db });
  const visible = all.filter((inv) => isInvoiceStatusVisibleInPortal(inv.status as InvoiceStoredStatus));

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Facturen</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Overzicht van verzonden en betaalde facturen. Conceptfacturen worden hier niet getoond.
        </p>
      </div>
      <PortalFacturenClient slug={slug} invoices={visible} />
    </main>
  );
}

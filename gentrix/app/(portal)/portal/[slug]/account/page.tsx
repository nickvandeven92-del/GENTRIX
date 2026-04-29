import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PortalAccountClient } from "@/components/portal/portal-account-client";
import { getActivePortalClient } from "@/lib/data/get-portal-client";
import { getClientCommercialBySlug } from "@/lib/data/get-client-commercial-by-slug";
import { getSupabaseForPortalDataReads } from "@/lib/portal/studio-portal-preview";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const portal = await getActivePortalClient(decodeURIComponent(slug));
  if (!portal || !portal.portal_account_enabled) return { title: "Portaal" };
  return { title: `Account — ${portal.name}` };
}

export default async function PortalAccountPage({ params }: Props) {
  const { slug } = await params;
  if (!slug) notFound();

  const decoded = decodeURIComponent(slug);
  const portal = await getActivePortalClient(decoded);
  if (!portal || !portal.portal_account_enabled) notFound();

  const db = await getSupabaseForPortalDataReads(portal.portal_user_id);
  const row = await getClientCommercialBySlug(decoded, db);
  if (!row || row.status !== "active") notFound();

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Account</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Abonnement, betaling en opzeggen. Factuurmail wordt ook gebruikt voor afspraakbevestigingen.
        </p>
      </div>
      <PortalAccountClient
        slug={slug}
        initial={{
          plan_type: row.plan_type,
          plan_label: row.plan_label,
          payment_status: row.payment_status,
          subscription_renews_at: row.subscription_renews_at,
          subscription_cancel_at_period_end: row.subscription_cancel_at_period_end,
          subscription_cancel_requested_at: row.subscription_cancel_requested_at,
          billing_email: row.billing_email,
        }}
      />
    </main>
  );
}

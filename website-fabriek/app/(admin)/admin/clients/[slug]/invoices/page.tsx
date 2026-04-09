import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { InvoiceStatusSelect } from "@/components/admin/billing/invoice-status-select";
import {
  formatCurrencyEUR,
  getInvoiceListStatusLabel,
  parseInvoiceAmount,
  type InvoiceStoredStatus,
} from "@/lib/commercial/billing-helpers";
import {
  AdminPortalFacturenListLink,
  AdminPortalInvoiceRowLink,
} from "@/components/admin/billing/admin-portal-invoice-links";
import { getClientCommercialBySlug } from "@/lib/data/get-client-commercial-by-slug";
import { listInvoices } from "@/lib/data/list-invoices";

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const row = await getClientCommercialBySlug(decodeURIComponent(slug ?? ""));
  if (!row) return { title: "Facturen" };
  return { title: `Facturen — ${row.name}` };
}

export default async function ClientInvoicesPage({ params }: PageProps) {
  const { slug } = await params;
  const decoded = decodeURIComponent(slug ?? "");
  if (!decoded) notFound();

  const row = await getClientCommercialBySlug(decoded);
  if (!row) notFound();

  const invoices = await listInvoices({ clientId: row.id });
  const enc = encodeURIComponent(row.subfolder_slug);
  const base = `/admin/clients/${enc}`;
  const newHref = `/admin/invoices/new?client_id=${encodeURIComponent(row.id)}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Facturen</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Gekoppeld aan deze klant.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AdminPortalFacturenListLink
            subfolderSlug={row.subfolder_slug}
            portalInvoicesEnabled={row.portal_invoices_enabled}
          />
          <Link
            href={newHref}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            Nieuwe factuur
          </Link>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <table className="w-full min-w-[640px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
              <th className="px-4 py-3">Factuurnummer</th>
              <th className="px-4 py-3">Bedrag</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Wijzigen</th>
              <th className="px-4 py-3">Vervaldatum</th>
              <th className="px-4 py-3">Acties</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {invoices.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-zinc-500">
                  Nog geen facturen voor deze klant.{" "}
                  <Link href={newHref} className="font-medium text-blue-700 underline dark:text-blue-400">
                    Maak een factuur
                  </Link>
                  .
                </td>
              </tr>
            ) : (
              invoices.map((r) => (
                <tr key={r.id} className="text-zinc-800 dark:text-zinc-200">
                  <td className="px-4 py-3 font-mono text-xs font-medium">
                    {r.invoice_number?.trim() ? (
                      <span className="block">
                        {r.invoice_number}
                        {r.status === "draft" ? (
                          <span className="mt-0.5 block text-[10px] font-sans font-normal text-zinc-500">
                            Definitief nummer; blijft behouden
                          </span>
                        ) : null}
                      </span>
                    ) : (
                      <span className="text-[11px] font-sans font-normal text-zinc-500">Bij versturen</span>
                    )}
                  </td>
                  <td className="px-4 py-3 tabular-nums">{formatCurrencyEUR(parseInvoiceAmount(r.amount))}</td>
                  <td className="px-4 py-3">
                    {getInvoiceListStatusLabel({
                      status: r.status,
                      due_date: r.due_date,
                      paid_at: r.paid_at,
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <InvoiceStatusSelect invoiceId={r.id} initialStatus={r.status as InvoiceStoredStatus} />
                  </td>
                  <td className="px-4 py-3">{new Date(r.due_date).toLocaleDateString("nl-NL")}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1.5">
                      <Link
                        href={`/admin/invoices/${r.id}`}
                        className="text-sm font-medium text-blue-800 underline dark:text-blue-400"
                      >
                        Bekijken
                      </Link>
                      <AdminPortalInvoiceRowLink invoiceId={r.id} status={r.status as InvoiceStoredStatus} clients={r.clients} />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-sm text-zinc-500">
        <Link href={`${base}`} className="font-medium text-zinc-700 hover:underline dark:text-zinc-300">
          ← Terug naar overzicht
        </Link>
      </p>
    </div>
  );
}

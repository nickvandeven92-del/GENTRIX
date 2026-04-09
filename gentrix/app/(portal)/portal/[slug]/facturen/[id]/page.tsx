import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getActivePortalClient } from "@/lib/data/get-portal-client";
import { getInvoiceById } from "@/lib/data/get-invoice-by-id";
import { getSupabaseForPortalDataReads } from "@/lib/portal/studio-portal-preview";
import {
  formatCurrencyEUR,
  getInvoiceListStatusLabel,
  parseInvoiceAmount,
} from "@/lib/commercial/billing-helpers";
import { formatDocumentDate, formatDocumentDateTime } from "@/lib/commercial/billing-helpers";

type Props = { params: Promise<{ slug: string; id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, id } = await params;
  const client = await getActivePortalClient(decodeURIComponent(slug));
  const db = client ? await getSupabaseForPortalDataReads(client.portal_user_id) : null;
  const inv = await getInvoiceById(id, db ?? undefined);
  if (!client || !client.portal_invoices_enabled || !inv || inv.client_id !== client.id)
    return { title: "Portaal" };
  return { title: `Factuur ${inv.invoice_number ?? ""} — ${client.name}` };
}

export default async function PortalFactuurDetailPage({ params }: Props) {
  const { slug, id } = await params;
  if (!slug || !id) notFound();

  const decoded = decodeURIComponent(slug);
  const client = await getActivePortalClient(decoded);
  if (!client || !client.portal_invoices_enabled) notFound();

  const db = await getSupabaseForPortalDataReads(client.portal_user_id);
  const inv = await getInvoiceById(id, db);
  if (!inv || inv.client_id !== client.id) notFound();
  if (inv.status === "draft") notFound();

  const enc = encodeURIComponent(slug);
  const back = `/portal/${enc}/facturen`;

  return (
    <main className="space-y-6">
      <Link
        href={back}
        className="text-sm font-medium text-blue-700 hover:underline dark:text-blue-400"
      >
        ← Terug naar facturen
      </Link>

      <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase text-zinc-500">Factuur</p>
            <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
              {inv.invoice_number ?? "Zonder nummer"}
            </h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{getInvoiceListStatusLabel(inv)}</p>
          </div>
          <p className="text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
            {formatCurrencyEUR(parseInvoiceAmount(inv.amount))}
          </p>
        </div>

        <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-zinc-500">Factuurdatum</dt>
            <dd className="font-medium text-zinc-900 dark:text-zinc-100">{formatDocumentDate(inv.issued_at)}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Vervaldatum</dt>
            <dd className="font-medium text-zinc-900 dark:text-zinc-100">{formatDocumentDate(inv.due_date)}</dd>
          </div>
          {inv.paid_at ? (
            <div>
              <dt className="text-zinc-500">Betaald op</dt>
              <dd className="font-medium text-zinc-900 dark:text-zinc-100">
                {formatDocumentDateTime(inv.paid_at)}
              </dd>
            </div>
          ) : null}
        </dl>

        {inv.items.length > 0 ? (
          <div className="mt-8">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Regels</h2>
            <table className="mt-3 w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500 dark:border-zinc-700">
                  <th className="pb-2">Omschrijving</th>
                  <th className="pb-2 text-right">Aantal</th>
                  <th className="pb-2 text-right">Prijs</th>
                  <th className="pb-2 text-right">Totaal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {inv.items.map((line) => (
                  <tr key={line.id}>
                    <td className="py-2 pr-2">{line.description}</td>
                    <td className="py-2 text-right tabular-nums">{String(line.quantity)}</td>
                    <td className="py-2 text-right tabular-nums">
                      {formatCurrencyEUR(parseInvoiceAmount(line.unit_price))}
                    </td>
                    <td className="py-2 text-right tabular-nums font-medium">
                      {formatCurrencyEUR(parseInvoiceAmount(line.line_total))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {inv.notes?.trim() ? (
          <div className="mt-6 rounded-lg bg-zinc-50 p-4 text-sm text-zinc-700 dark:bg-zinc-950 dark:text-zinc-300">
            <p className="text-xs font-medium uppercase text-zinc-500">Notitie</p>
            <p className="mt-1 whitespace-pre-wrap">{inv.notes}</p>
          </div>
        ) : null}
      </div>
    </main>
  );
}

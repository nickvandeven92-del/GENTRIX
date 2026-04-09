import type { Metadata } from "next";
import Link from "next/link";
import { InvoiceStatusSelect } from "@/components/admin/billing/invoice-status-select";
import { AdminPortalInvoiceRowLink } from "@/components/admin/billing/admin-portal-invoice-links";
import {
  formatCurrencyEUR,
  getInvoiceListStatusLabel,
  getInvoiceStatusLabel,
  parseInvoiceAmount,
  type InvoiceStoredStatus,
} from "@/lib/commercial/billing-helpers";
import { listInvoices } from "@/lib/data/list-invoices";

export const metadata: Metadata = {
  title: "Facturen",
};

const INV_STATUSES: InvoiceStoredStatus[] = ["draft", "sent", "paid", "cancelled"];

type PageProps = { searchParams: Promise<{ q?: string; status?: string }> };

export default async function AdminInvoicesPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const statusFilter = INV_STATUSES.includes(sp.status as InvoiceStoredStatus)
    ? (sp.status as InvoiceStoredStatus)
    : undefined;
  const rows = await listInvoices({ search: sp.q, status: statusFilter });

  return (
    <div className="mx-auto max-w-[1200px] space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900 dark:text-zinc-50">Facturen</h1>
          <p className="mt-1 text-[13px] text-neutral-500 dark:text-zinc-400">
            Documenten, status en verval — business-laag, geen boekhouding.
          </p>
        </div>
        <Link
          href="/admin/invoices/new"
          className="sales-os-glass-primary-btn rounded-md border border-transparent bg-neutral-950 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
        >
          Nieuwe factuur
        </Link>
      </div>

      <form
        method="get"
        action="/admin/invoices"
        className="sales-os-glass-panel flex flex-wrap items-end gap-3 rounded-lg border border-neutral-200 bg-white p-4 dark:border-zinc-600/80 dark:bg-zinc-950/50"
      >
        <div className="min-w-[200px] flex-1">
          <label htmlFor="inv-q" className="text-[11px] font-medium text-neutral-600 dark:text-zinc-300">
            Zoeken
          </label>
          <input
            id="inv-q"
            name="q"
            type="search"
            defaultValue={sp.q ?? ""}
            placeholder="Factuurnummer, klant of klantnummer…"
            className="mt-1 w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
          />
        </div>
        <div className="w-full sm:w-44">
          <label htmlFor="inv-status" className="text-[11px] font-medium text-neutral-600 dark:text-zinc-300">
            Status
          </label>
          <select
            id="inv-status"
            name="status"
            defaultValue={sp.status ?? ""}
            className="mt-1 w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
          >
            <option value="">Alle statussen</option>
            {INV_STATUSES.map((s) => (
              <option key={s} value={s}>
                {getInvoiceStatusLabel(s)}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="sales-os-glass-primary-btn rounded-md border border-transparent bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
        >
          Toepassen
        </button>
      </form>

      <div className="sales-os-table-shell overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <table className="w-full min-w-[960px] border-collapse text-left text-[13px]">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50/80 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
              <th className="px-4 py-3">Factuurnummer</th>
              <th className="px-4 py-3">Klant</th>
              <th className="px-4 py-3">Klantnummer</th>
              <th className="px-4 py-3">Bedrag</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Status wijzigen</th>
              <th className="px-4 py-3">Vervaldatum</th>
              <th className="px-4 py-3">Factuurdatum</th>
              <th className="px-4 py-3">Acties</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-neutral-500">
                  Geen facturen gevonden.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-b border-neutral-100">
                  <td className="px-4 py-3 font-mono text-[12px] font-medium text-neutral-900">
                    {r.invoice_number?.trim() ? (
                      <span className="block">
                        {r.invoice_number}
                        {r.status === "draft" ? (
                          <span className="mt-0.5 block text-[10px] font-sans font-normal text-neutral-500">
                            Definitief nummer; blijft behouden
                          </span>
                        ) : null}
                      </span>
                    ) : (
                      <span className="text-[11px] font-sans font-normal text-neutral-500">Bij versturen</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-medium text-neutral-900">{r.clients?.name ?? "—"}</td>
                  <td className="px-4 py-3 font-mono text-[11px] text-neutral-700">{r.clients?.client_number ?? "—"}</td>
                  <td className="px-4 py-3 tabular-nums text-neutral-800">
                    {formatCurrencyEUR(parseInvoiceAmount(r.amount))}
                  </td>
                  <td className="px-4 py-3 text-neutral-800">
                    {getInvoiceListStatusLabel({
                      status: r.status,
                      due_date: r.due_date,
                      paid_at: r.paid_at,
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <InvoiceStatusSelect invoiceId={r.id} initialStatus={r.status as InvoiceStoredStatus} />
                  </td>
                  <td className="px-4 py-3 text-neutral-700">
                    {new Date(r.due_date).toLocaleDateString("nl-NL")}
                  </td>
                  <td className="px-4 py-3 text-neutral-600">
                    {new Date(r.issued_at ?? r.created_at).toLocaleDateString("nl-NL")}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <Link
                        href={`/admin/invoices/${r.id}`}
                        className="text-[12px] font-medium text-neutral-900 underline underline-offset-2"
                      >
                        Bekijken
                      </Link>
                      <Link
                        href={`/admin/invoices/${r.id}/edit`}
                        className="text-[12px] text-neutral-500 hover:text-neutral-900"
                      >
                        Bewerken
                      </Link>
                      <AdminPortalInvoiceRowLink
                        invoiceId={r.id}
                        status={r.status as InvoiceStoredStatus}
                        clients={r.clients}
                        className="inline-flex items-center gap-1 text-[12px] font-medium text-violet-800 underline underline-offset-2"
                      />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

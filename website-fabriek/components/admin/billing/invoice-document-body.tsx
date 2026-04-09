import { ADMIN_STUDIO_NAME } from "@/lib/constants";
import {
  formatCurrencyEUR,
  formatDocumentDate,
  formatDocumentDateTime,
  getInvoiceListStatusLabel,
  parseInvoiceAmount,
} from "@/lib/commercial/billing-helpers";
import type { InvoiceDetail } from "@/lib/data/get-invoice-by-id";

export function InvoiceDocumentBody({ invoice }: { invoice: InvoiceDetail }) {
  const clientName = invoice.company_name_snapshot ?? invoice.clients?.name ?? "—";
  const statusLabel = getInvoiceListStatusLabel({
    status: invoice.status,
    due_date: invoice.due_date,
    paid_at: invoice.paid_at,
  });
  const total = parseInvoiceAmount(invoice.amount);

  const addressLines = [
    [invoice.billing_postal_code_snapshot, invoice.billing_city_snapshot].filter(Boolean).join(" "),
  ].filter((s) => s && String(s).trim().length > 0);

  return (
    <article className="billing-document mx-auto max-w-[210mm] border border-neutral-200 bg-white p-8 shadow-sm md:p-12">
      <header className="flex flex-wrap items-start justify-between gap-6 border-b border-neutral-200 pb-6">
        <div>
          <p className="text-lg font-semibold tracking-tight text-neutral-950">{ADMIN_STUDIO_NAME}</p>
          <p className="mt-1 text-[11px] text-neutral-500">Factuur</p>
        </div>
        <div className="text-right text-[12px] text-neutral-700">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400">Factuurnummer</p>
          <p className="font-mono text-sm font-semibold text-neutral-950">
            {invoice.invoice_number?.trim()
              ? invoice.invoice_number
              : invoice.status === "draft"
                ? "Bij versturen"
                : "—"}
          </p>
          {invoice.status === "draft" && !invoice.invoice_number?.trim() ? (
            <p className="mt-1 text-[11px] font-normal text-neutral-500">
              Het definitieve nummer (INV-jaar-volgnummer) verschijnt zodra je de factuur verstuurt of op betaald zet.
            </p>
          ) : null}
          {invoice.status === "draft" && invoice.invoice_number?.trim() ? (
            <p className="mt-1 text-[11px] font-normal text-neutral-500">
              Dit nummer is definitief toegekend en blijft op dit document staan, ook in concept.
            </p>
          ) : null}
          <p className="mt-2">
            <span className="text-neutral-500">Status: </span>
            {statusLabel}
          </p>
        </div>
      </header>

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400">Klant</p>
          <p className="mt-1 font-medium text-neutral-950">{clientName}</p>
          {invoice.clients?.client_number ? (
            <p className="mt-1 text-[12px] text-neutral-600">
              <span className="text-neutral-500">Klantnummer: </span>
              <span className="font-mono">{invoice.clients.client_number}</span>
            </p>
          ) : null}
          {invoice.contact_name_snapshot ? (
            <p className="mt-1 text-[12px] text-neutral-600">
              <span className="text-neutral-500">Contactpersoon: </span>
              {invoice.contact_name_snapshot}
            </p>
          ) : null}
          {invoice.billing_email_snapshot ? (
            <p className="mt-1 text-[12px] text-neutral-600">{invoice.billing_email_snapshot}</p>
          ) : null}
          {invoice.billing_phone_snapshot ? (
            <p className="mt-1 text-[12px] text-neutral-600">{invoice.billing_phone_snapshot}</p>
          ) : null}
          {invoice.billing_address_snapshot ? (
            <p className="mt-2 whitespace-pre-line text-[12px] leading-relaxed text-neutral-600">
              {invoice.billing_address_snapshot}
            </p>
          ) : null}
          {addressLines.map((line, i) => (
            <p key={i} className="mt-1 text-[12px] text-neutral-600">
              {line}
            </p>
          ))}
        </div>
        <div className="space-y-1 text-[12px] text-neutral-700">
          <p>
            <span className="text-neutral-500">Factuurdatum: </span>
            {formatDocumentDate(invoice.issued_at ?? invoice.created_at)}
          </p>
          <p>
            <span className="text-neutral-500">Vervaldatum: </span>
            {formatDocumentDate(invoice.due_date)}
          </p>
          {invoice.sent_at ? (
            <p>
              <span className="text-neutral-500">Verstuurd op: </span>
              {formatDocumentDateTime(invoice.sent_at)}
            </p>
          ) : null}
          {invoice.status === "paid" && invoice.paid_at ? (
            <p>
              <span className="text-neutral-500">Betaald op: </span>
              {formatDocumentDateTime(invoice.paid_at)}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-8">
        <table className="w-full border-collapse text-left text-[12px]">
          <thead>
            <tr className="border-b border-neutral-300 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
              <th className="py-2 pr-4">Omschrijving</th>
              <th className="w-20 py-2 text-right">Aantal</th>
              <th className="w-28 py-2 text-right">Prijs</th>
              <th className="w-32 py-2 text-right">Regel</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((row) => (
              <tr key={row.id} className="border-b border-neutral-100">
                <td className="py-2.5 pr-4 text-neutral-900">{row.description}</td>
                <td className="py-2.5 text-right tabular-nums text-neutral-700">
                  {parseInvoiceAmount(row.quantity).toLocaleString("nl-NL", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                </td>
                <td className="py-2.5 text-right tabular-nums text-neutral-700">
                  {formatCurrencyEUR(parseInvoiceAmount(row.unit_price))}
                </td>
                <td className="py-2.5 text-right tabular-nums font-medium text-neutral-900">
                  {formatCurrencyEUR(parseInvoiceAmount(row.line_total))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-4 flex justify-end border-t border-neutral-200 pt-4">
          <p className="text-[13px] text-neutral-600">
            Totaal ({invoice.currency}){" "}
            <span className="ml-4 text-lg font-semibold tabular-nums text-neutral-950">{formatCurrencyEUR(total)}</span>
          </p>
        </div>
      </div>

      {invoice.notes?.trim() ? (
        <div className="mt-8 border-t border-neutral-100 pt-6">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400">Opmerkingen</p>
          <p className="mt-2 whitespace-pre-line text-[12px] leading-relaxed text-neutral-700">{invoice.notes}</p>
        </div>
      ) : null}

      <footer className="mt-10 border-t border-neutral-100 pt-6 text-[11px] leading-relaxed text-neutral-500">
        <p>Betaal voor de vervaldatum. Bij vragen over deze factuur, neem contact op via je gebruikelijke kanaal.</p>
      </footer>
    </article>
  );
}

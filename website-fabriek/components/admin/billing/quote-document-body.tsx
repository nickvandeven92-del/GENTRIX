import type { ReactNode } from "react";
import { memo } from "react";
import { ADMIN_STUDIO_NAME } from "@/lib/constants";
import {
  formatCurrencyEUR,
  formatDocumentDate,
  formatDocumentDateTime,
  getQuoteStatusLabel,
  parseInvoiceAmount,
} from "@/lib/commercial/billing-helpers";
import type { QuoteDetail } from "@/lib/data/get-quote-by-id";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-6 border-t border-neutral-100 pt-6">
      <h3 className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400">{title}</h3>
      <div className="mt-2 whitespace-pre-line text-[12px] leading-relaxed text-neutral-800">{children}</div>
    </div>
  );
}

export const QuoteDocumentBody = memo(function QuoteDocumentBody({ quote }: { quote: QuoteDetail }) {
  const clientName = quote.company_name_snapshot ?? quote.clients?.name ?? "—";
  const total = parseInvoiceAmount(quote.amount);

  const addressLine = [quote.billing_postal_code_snapshot, quote.billing_city_snapshot].filter(Boolean).join(" ");

  return (
    <article className="billing-document mx-auto max-w-[210mm] border border-neutral-200 bg-white p-8 shadow-sm md:p-12">
      <header className="flex flex-wrap items-start justify-between gap-6 border-b border-neutral-200 pb-6">
        <div>
          <p className="text-lg font-semibold tracking-tight text-neutral-950">{ADMIN_STUDIO_NAME}</p>
          <p className="mt-1 text-[11px] text-neutral-500">Offerte</p>
        </div>
        <div className="text-right text-[12px] text-neutral-700">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400">Offertenummer</p>
          <p className="font-mono text-sm font-semibold text-neutral-950">{quote.quote_number}</p>
          <p className="mt-2">
            <span className="text-neutral-500">Status: </span>
            {getQuoteStatusLabel(quote.status)}
          </p>
        </div>
      </header>

      {quote.title?.trim() ? (
        <h2 className="mt-6 text-lg font-semibold text-neutral-950">{quote.title.trim()}</h2>
      ) : null}

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400">Klant</p>
          <p className="mt-1 font-medium text-neutral-950">{clientName}</p>
          {quote.clients?.client_number ? (
            <p className="mt-1 text-[12px] text-neutral-600">
              <span className="text-neutral-500">Klantnummer: </span>
              <span className="font-mono">{quote.clients.client_number}</span>
            </p>
          ) : null}
          {quote.contact_name_snapshot ? (
            <p className="mt-1 text-[12px] text-neutral-600">
              <span className="text-neutral-500">Contactpersoon: </span>
              {quote.contact_name_snapshot}
            </p>
          ) : null}
          {quote.billing_email_snapshot ? (
            <p className="mt-1 text-[12px] text-neutral-600">{quote.billing_email_snapshot}</p>
          ) : null}
          {quote.billing_phone_snapshot ? (
            <p className="mt-1 text-[12px] text-neutral-600">{quote.billing_phone_snapshot}</p>
          ) : null}
          {quote.billing_address_snapshot ? (
            <p className="mt-2 whitespace-pre-line text-[12px] leading-relaxed text-neutral-600">
              {quote.billing_address_snapshot}
            </p>
          ) : null}
          {addressLine ? <p className="mt-1 text-[12px] text-neutral-600">{addressLine}</p> : null}
        </div>
        <div className="space-y-1 text-[12px] text-neutral-700">
          <p>
            <span className="text-neutral-500">Offertedatum: </span>
            {formatDocumentDate(quote.issued_at ?? quote.created_at)}
          </p>
          <p>
            <span className="text-neutral-500">Geldig tot: </span>
            {formatDocumentDate(quote.valid_until)}
          </p>
          {quote.sent_at ? (
            <p>
              <span className="text-neutral-500">Verstuurd op: </span>
              {formatDocumentDateTime(quote.sent_at)}
            </p>
          ) : null}
          {quote.accepted_at ? (
            <p>
              <span className="text-neutral-500">Geaccepteerd op: </span>
              {formatDocumentDateTime(quote.accepted_at)}
            </p>
          ) : null}
          {quote.rejected_at ? (
            <p>
              <span className="text-neutral-500">Afgewezen op: </span>
              {formatDocumentDateTime(quote.rejected_at)}
            </p>
          ) : null}
        </div>
      </div>

      {quote.intro_text?.trim() ? <Section title="Introductie / voorstel">{quote.intro_text.trim()}</Section> : null}
      {quote.scope_text?.trim() ? <Section title="Gewenste functies en scope">{quote.scope_text.trim()}</Section> : null}
      {quote.delivery_text?.trim() ? <Section title="Oplevering en aanpak">{quote.delivery_text.trim()}</Section> : null}
      {quote.exclusions_text?.trim() ? <Section title="Niet inbegrepen">{quote.exclusions_text.trim()}</Section> : null}
      {quote.terms_text?.trim() ? <Section title="Voorwaarden">{quote.terms_text.trim()}</Section> : null}

      <div className="mt-8">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400">Prijzen</p>
        <table className="mt-3 w-full border-collapse text-left text-[12px]">
          <thead>
            <tr className="border-b border-neutral-300 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
              <th className="py-2 pr-4">Omschrijving</th>
              <th className="w-20 py-2 text-right">Aantal</th>
              <th className="w-28 py-2 text-right">Prijs</th>
              <th className="w-32 py-2 text-right">Regel</th>
            </tr>
          </thead>
          <tbody>
            {quote.items.map((row) => (
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
            Totaal ({quote.currency}){" "}
            <span className="ml-4 text-lg font-semibold tabular-nums text-neutral-950">{formatCurrencyEUR(total)}</span>
          </p>
        </div>
      </div>

      {quote.notes?.trim() ? (
        <div className="mt-8 border-t border-neutral-100 pt-6">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400">Opmerkingen</p>
          <p className="mt-2 whitespace-pre-line text-[12px] leading-relaxed text-neutral-700">{quote.notes}</p>
        </div>
      ) : null}

      <footer className="mt-10 border-t border-neutral-100 pt-6 text-[11px] leading-relaxed text-neutral-500">
        <p>Deze offerte is geldig tot de vermelde datum. Prijzen zijn exclusief eventuele wettelijke heffingen, tenzij anders vermeld.</p>
      </footer>
    </article>
  );
});

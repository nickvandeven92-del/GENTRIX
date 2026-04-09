import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { isInvoiceStatusVisibleInPortal } from "@/lib/commercial/billing-helpers";
import type { InvoiceDetail } from "@/lib/data/get-invoice-by-id";
import { hrefPortalFactuurDetail } from "@/lib/portal/portal-client-hrefs";

export function InvoicePortalAdminCallout({ invoice }: { invoice: InvoiceDetail }) {
  const c = invoice.clients;
  if (!c) return null;

  const slug = c.subfolder_slug?.trim();
  if (!slug) return null;

  if (c.portal_invoices_enabled === false) {
    return (
      <div className="billing-no-print mb-4 rounded-md border border-amber-200 bg-amber-50/90 px-3 py-2 text-[12px] text-amber-950 print:hidden dark:border-amber-900/50 dark:bg-amber-950/25 dark:text-amber-100">
        Het tabblad <strong>Facturen</strong> in het klantportaal staat voor deze klant uit. Schakel het in via dossier →{" "}
        <strong>Portaal-modules</strong> of <strong>Commercie &amp; domein</strong>.
      </div>
    );
  }

  if (!isInvoiceStatusVisibleInPortal(invoice.status)) {
    return (
      <div className="billing-no-print mb-4 rounded-md border border-zinc-200 bg-zinc-50/90 px-3 py-2 text-[12px] text-zinc-800 print:hidden dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-200">
        In het klantportaal ziet de klant deze factuur pas na versturen (nu:{" "}
        {invoice.status === "draft" ? "concept" : invoice.status}).
      </div>
    );
  }

  return (
    <div className="billing-no-print mb-4 rounded-md border border-violet-200 bg-violet-50/90 px-3 py-2 text-[12px] text-violet-950 print:hidden dark:border-violet-900/45 dark:bg-violet-950/30 dark:text-violet-100">
      <span className="font-medium">Integratie klantportaal</span> — dezelfde factuur zoals de klant die ziet:{" "}
      <Link
        href={hrefPortalFactuurDetail(slug, invoice.id)}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 font-medium underline underline-offset-2"
      >
        Openen in portaal
        <ExternalLink className="size-3.5 shrink-0 opacity-80" aria-hidden />
      </Link>
    </div>
  );
}

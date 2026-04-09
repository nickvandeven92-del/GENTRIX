import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BillingDocumentToolbar } from "@/components/admin/billing/billing-document-toolbar";
import { InvoiceDocumentBody } from "@/components/admin/billing/invoice-document-body";
import { InvoicePortalAdminCallout } from "@/components/admin/billing/invoice-portal-admin-callout";
import { getInvoiceById } from "@/lib/data/get-invoice-by-id";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const inv = await getInvoiceById(id);
  return { title: inv?.invoice_number?.trim() ? inv.invoice_number : inv ? "Conceptfactuur" : "Factuur" };
}

export default async function AdminInvoiceDocumentPage({ params }: Props) {
  const { id } = await params;
  const invoice = await getInvoiceById(id);
  if (!invoice) notFound();

  return (
    <div>
      {invoice.origin_quote_id ? (
        <div className="billing-no-print mb-4 rounded-md border border-emerald-200 bg-emerald-50/80 px-3 py-2 text-[12px] text-emerald-950 print:hidden">
          Deze conceptfactuur is aangemaakt na acceptatie van een offerte.{" "}
          <Link href={`/admin/quotes/${invoice.origin_quote_id}`} className="font-medium underline">
            Bekijk offerte
          </Link>
        </div>
      ) : null}
      <InvoicePortalAdminCallout invoice={invoice} />
      <BillingDocumentToolbar
        listHref="/admin/invoices"
        editHref={`/admin/invoices/${id}/edit`}
        listLabel="Alle facturen"
      />
      <InvoiceDocumentBody invoice={invoice} />
    </div>
  );
}

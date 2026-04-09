import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { InvoiceEditForm } from "@/components/admin/billing/invoice-edit-form";
import { getInvoiceById } from "@/lib/data/get-invoice-by-id";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const inv = await getInvoiceById(id);
  return {
    title: inv?.invoice_number?.trim() ? `Bewerken · ${inv.invoice_number}` : inv ? "Bewerken · conceptfactuur" : "Factuur bewerken",
  };
}

export default async function AdminInvoiceEditPage({ params }: Props) {
  const { id } = await params;
  const invoice = await getInvoiceById(id);
  if (!invoice) notFound();

  return (
    <div className="mx-auto w-full max-w-[1280px] space-y-6">
      <div className="billing-no-print flex flex-wrap gap-3 text-[12px]">
        <Link
          href={`/admin/invoices/${id}`}
          className="text-neutral-500 hover:text-neutral-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          ← Document
        </Link>
        <Link
          href="/admin/invoices"
          className="text-neutral-500 hover:text-neutral-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          Alle facturen
        </Link>
      </div>
      <div>
        <h1 className="text-xl font-semibold text-neutral-900 dark:text-zinc-50">Factuur bewerken</h1>
        <p className="mt-1 text-[13px] text-neutral-600 dark:text-zinc-300">
          {invoice.invoice_number?.trim() ? (
            <span className="font-mono">{invoice.invoice_number}</span>
          ) : (
            <span className="text-neutral-500 dark:text-zinc-400">
              Nog geen definitief factuurnummer (wordt toegekend bij versturen).
            </span>
          )}
        </p>
      </div>
      <InvoiceEditForm invoice={invoice} />
    </div>
  );
}

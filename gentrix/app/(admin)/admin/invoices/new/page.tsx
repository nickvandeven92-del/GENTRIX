import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { InvoiceNewForm } from "@/components/admin/billing/invoice-new-form";
import { listAdminClients } from "@/lib/data/list-admin-clients";

export const metadata: Metadata = {
  title: "Nieuwe factuur",
};

export default async function AdminInvoiceNewPage() {
  const clients = await listAdminClients();

  return (
    <div className="mx-auto max-w-[1100px] space-y-6">
      <Link
        href="/admin/invoices"
        className="text-[12px] text-neutral-500 hover:text-neutral-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        ← Terug naar facturen
      </Link>
      <div>
        <h1 className="text-xl font-semibold text-neutral-900 dark:text-zinc-50">Nieuwe factuur</h1>
        <p className="mt-1 text-[13px] text-neutral-500 dark:text-zinc-400">Klant, bedrag en vervaldatum vastleggen.</p>
      </div>
      <Suspense fallback={<p className="text-sm text-neutral-500 dark:text-zinc-400">Formulier laden…</p>}>
        <InvoiceNewForm clients={clients} />
      </Suspense>
    </div>
  );
}

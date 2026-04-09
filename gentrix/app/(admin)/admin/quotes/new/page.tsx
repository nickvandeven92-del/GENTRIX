import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { QuoteNewForm } from "@/components/admin/billing/quote-new-form";
import { listAdminClients } from "@/lib/data/list-admin-clients";

export const metadata: Metadata = {
  title: "Nieuwe offerte",
};

export default async function AdminQuoteNewPage() {
  const clients = await listAdminClients();

  return (
    <div className="mx-auto max-w-[1100px] space-y-6">
      <Link
        href="/admin/quotes"
        className="text-[12px] text-neutral-500 hover:text-neutral-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        ← Terug naar offertes
      </Link>
      <div>
        <h1 className="text-xl font-semibold text-neutral-900 dark:text-zinc-50">Nieuwe offerte</h1>
        <p className="mt-1 text-[13px] text-neutral-500 dark:text-zinc-400">Bedrag en geldigheid vastleggen.</p>
        <p className="mt-3 text-[13px] leading-relaxed text-neutral-600 dark:text-zinc-300">
          Nog geen klant in het systeem? Maak die eerst aan (bijv. vanuit een{" "}
          <Link href="/admin/ops/leads" className="font-medium text-blue-800 underline dark:text-blue-400">
            lead
          </Link>{" "}
          of via{" "}
          <Link href="/admin/clients" className="font-medium text-blue-800 underline dark:text-blue-400">
            Klanten
          </Link>
          ). Daarna kun je hier de offerte koppelen; na aanmaken werk je verder op één pagina met live voorbeeld en
          verzenden.
        </p>
      </div>
      <Suspense fallback={<p className="text-sm text-neutral-500">Formulier laden…</p>}>
        <QuoteNewForm clients={clients} />
      </Suspense>
    </div>
  );
}

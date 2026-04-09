"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getQuoteStatusLabel, type QuoteStatus } from "@/lib/commercial/billing-helpers";

const STATUSES: QuoteStatus[] = ["draft", "sent", "accepted", "rejected"];

export function QuoteStatusSelect({ quoteId, initialStatus }: { quoteId: string; initialStatus: QuoteStatus }) {
  const router = useRouter();
  const [value, setValue] = useState(initialStatus);
  const [busy, setBusy] = useState(false);
  const [invoiceHint, setInvoiceHint] = useState<{ id: string; existed: boolean } | null>(null);

  useEffect(() => {
    setValue(initialStatus);
  }, [initialStatus]);

  async function onChange(next: QuoteStatus) {
    setBusy(true);
    setValue(next);
    setInvoiceHint(null);
    try {
      const res = await fetch(`/api/admin/quotes/${quoteId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const j = (await res.json()) as {
        ok?: boolean;
        error?: string;
        draft_invoice_id?: string;
        draft_invoice_existed?: boolean;
      };
      if (!j.ok) {
        setValue(initialStatus);
        alert(j.error ?? "Bijwerken mislukt.");
        return;
      }
      if (next === "accepted" && j.draft_invoice_id) {
        setInvoiceHint({ id: j.draft_invoice_id, existed: Boolean(j.draft_invoice_existed) });
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <select
        disabled={busy}
        value={value}
        onChange={(e) => void onChange(e.target.value as QuoteStatus)}
        className="max-w-[10rem] rounded border border-neutral-200 bg-white px-2 py-1 text-[12px] text-neutral-900"
        aria-label="Offertestatus wijzigen"
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {getQuoteStatusLabel(s)}
          </option>
        ))}
      </select>
      {invoiceHint ? (
        <p className="max-w-xs text-[11px] leading-snug text-neutral-600">
          {invoiceHint.existed ? "Er bestond al een conceptfactuur voor deze offerte. " : "Conceptfactuur aangemaakt (nog niet verzonden). "}
          <Link href={`/admin/invoices/${invoiceHint.id}`} className="font-medium text-neutral-900 underline">
            Open factuur
          </Link>
        </p>
      ) : null}
    </div>
  );
}

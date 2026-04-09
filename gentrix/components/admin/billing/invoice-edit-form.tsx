"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { InvoiceDocumentBody } from "@/components/admin/billing/invoice-document-body";
import type { InvoiceDetail, InvoiceItemRow } from "@/lib/data/get-invoice-by-id";
import {
  getInvoiceStatusLabel,
  lineTotalFromQtyPrice,
  parseInvoiceAmount,
  type InvoiceStoredStatus,
} from "@/lib/commercial/billing-helpers";
import {
  invoiceTransitionRequiresConfirmation,
  validateInvoiceStatusTransition,
} from "@/lib/commercial/invoice-status-machine";

type Line = { description: string; quantity: string; unit_price: string };

const STATUSES: InvoiceStoredStatus[] = ["draft", "sent", "paid", "cancelled"];

export function InvoiceEditForm({ invoice }: { invoice: InvoiceDetail }) {
  const router = useRouter();
  const [notes, setNotes] = useState(invoice.notes ?? "");
  const [dueDate, setDueDate] = useState(invoice.due_date);
  const [issuedAt, setIssuedAt] = useState(() => (invoice.issued_at ?? invoice.created_at).slice(0, 10));
  const [status, setStatus] = useState<InvoiceStoredStatus>(invoice.status);
  const [lines, setLines] = useState<Line[]>(() =>
    invoice.items.map((r) => ({
      description: r.description,
      quantity: String(parseInvoiceAmount(r.quantity)),
      unit_price: String(parseInvoiceAmount(r.unit_price)),
    })),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<"form" | "preview">("form");

  const previewInvoice = useMemo((): InvoiceDetail => {
    const mappedItems: InvoiceItemRow[] = [];
    let pos = 0;
    let sum = 0;
    for (const l of lines) {
      const desc = l.description.trim();
      if (!desc) continue;
      const qty = parseFloat(l.quantity.replace(",", "."));
      const up = parseFloat(l.unit_price.replace(",", "."));
      if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(up) || up < 0) continue;
      const line_total = lineTotalFromQtyPrice(qty, up);
      sum += line_total;
      mappedItems.push({
        id: `preview-${pos}`,
        invoice_id: invoice.id,
        description: desc,
        quantity: qty,
        unit_price: up,
        line_total,
        position: pos,
        created_at: invoice.created_at,
      });
      pos += 1;
    }
    const amount = Math.round(sum * 100) / 100;
    return {
      ...invoice,
      notes: notes.trim() || null,
      due_date: dueDate,
      issued_at: `${issuedAt}T12:00:00.000Z`,
      status,
      items: mappedItems,
      amount,
    };
  }, [invoice, lines, notes, dueDate, issuedAt, status]);

  function addLine() {
    setLines((L) => [...L, { description: "", quantity: "1", unit_price: "0" }]);
  }

  function removeLine(i: number) {
    setLines((L) => L.filter((_, j) => j !== i));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const items = lines
      .map((l) => ({
        description: l.description.trim(),
        quantity: parseFloat(l.quantity.replace(",", ".")),
        unit_price: parseFloat(l.unit_price.replace(",", ".")),
      }))
      .filter((l) => l.description.length > 0);
    if (items.length === 0 || items.some((l) => Number.isNaN(l.quantity) || l.quantity <= 0 || Number.isNaN(l.unit_price) || l.unit_price < 0)) {
      setError("Vul minstens één regel met geldige aantallen en prijzen in.");
      return;
    }
    if (invoice.status === "cancelled") {
      setError("Deze factuur is geannuleerd en kan niet meer worden bewerkt.");
      return;
    }

    let confirm_exception_transition = false;
    if (status !== invoice.status) {
      const unchecked = validateInvoiceStatusTransition(invoice.status, status, { confirmed: false });
      if (!unchecked.allowed && !unchecked.requiresConfirmation) {
        setError(unchecked.userMessage);
        return;
      }
      if (invoiceTransitionRequiresConfirmation(invoice.status, status)) {
        if (!window.confirm(unchecked.userMessage)) return;
        confirm_exception_transition = true;
      }
    }

    setBusy(true);
    try {
      const issuedIso = `${issuedAt}T12:00:00.000Z`;
      const body: Record<string, unknown> = {
        notes: notes.trim() || null,
        due_date: dueDate,
        issued_at: issuedIso,
        status,
        replace_items: items,
      };
      if (confirm_exception_transition) body.confirm_exception_transition = true;

      async function patchInvoice(payload: Record<string, unknown>) {
        const res = await fetch(`/api/admin/invoices/${invoice.id}`, {
          method: "PATCH",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "x-audit-source": "admin_ui",
          },
          body: JSON.stringify(payload),
        });
        return (await res.json()) as { ok?: boolean; error?: string; code?: string };
      }

      let j = await patchInvoice(body);
      if (!j.ok && j.code === "CONFIRMATION_REQUIRED") {
        if (window.confirm(j.error ?? "Bevestig deze uitzonderlijke wijziging.")) {
          j = await patchInvoice({ ...body, confirm_exception_transition: true });
        } else {
          return;
        }
      }
      if (!j.ok) {
        setError(j.error ?? "Opslaan mislukt.");
        return;
      }
      router.push(`/admin/invoices/${invoice.id}`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="billing-no-print mb-4 flex gap-2 lg:hidden print:hidden">
        <button
          type="button"
          onClick={() => setMobileTab("form")}
          className={`rounded-md border px-3 py-1.5 text-[12px] font-medium ${
            mobileTab === "form"
              ? "border-neutral-900 bg-neutral-900 text-white"
              : "border-neutral-200 bg-white text-neutral-800"
          }`}
        >
          Invullen
        </button>
        <button
          type="button"
          onClick={() => setMobileTab("preview")}
          className={`rounded-md border px-3 py-1.5 text-[12px] font-medium ${
            mobileTab === "preview"
              ? "border-neutral-900 bg-neutral-900 text-white"
              : "border-neutral-200 bg-white text-neutral-800"
          }`}
        >
          Voorbeeld
        </button>
      </div>

      <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-10">
        <form
          onSubmit={(e) => void submit(e)}
          className={`sales-os-glass-panel w-full shrink-0 space-y-6 rounded-lg border border-neutral-200 bg-white p-5 dark:border-zinc-600/80 dark:bg-zinc-950/50 lg:w-auto lg:max-w-[480px] lg:flex-none ${
            mobileTab === "preview" ? "hidden lg:block" : ""
          }`}
        >
      <div className="rounded-lg border border-neutral-100 bg-neutral-50/60 p-4">
        <p className="text-[11px] font-medium text-neutral-600 dark:text-zinc-300">Factuurnummer</p>
        <p className="mt-1 font-mono text-sm text-neutral-900 dark:text-zinc-100">
          {invoice.invoice_number?.trim() ? (
            invoice.invoice_number
          ) : (
            <span className="font-sans text-[13px] font-normal text-neutral-600 dark:text-zinc-400">
              Bij versturen (of bij direct op betaald zetten). Dit veld is niet handmatig aanpasbaar.
            </span>
          )}
        </p>
        {invoice.status === "draft" && invoice.invoice_number?.trim() ? (
          <p className="mt-2 text-[12px] leading-relaxed text-neutral-600 dark:text-zinc-300">
            Dit nummer is al definitief toegekend en blijft aan deze factuur gekoppeld, ook als je teruggaat naar concept.
          </p>
        ) : null}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-[11px] font-medium text-neutral-600 dark:text-zinc-300">Factuurdatum</label>
          <input
            type="date"
            required
            value={issuedAt}
            onChange={(e) => setIssuedAt(e.target.value)}
            className="mt-1 w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-neutral-600 dark:text-zinc-300">Vervaldatum</label>
          <input
            type="date"
            required
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="mt-1 w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-[11px] font-medium text-neutral-600 dark:text-zinc-300">Status</label>
          <select
            value={status}
            disabled={invoice.status === "cancelled"}
            onChange={(e) => setStatus(e.target.value as InvoiceStoredStatus)}
            className="mt-1 w-full rounded-md border border-neutral-200 px-3 py-2 text-sm disabled:opacity-60"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {getInvoiceStatusLabel(s)}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-[11px] font-medium text-neutral-600 dark:text-zinc-300">Opmerkingen</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="mt-1 w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[11px] font-medium text-neutral-600 dark:text-zinc-300">Regels</span>
          <button
            type="button"
            onClick={addLine}
            className="sales-os-glass-outline-btn rounded-md border border-transparent px-2.5 py-1 text-[12px] font-medium text-neutral-900 dark:text-zinc-200"
          >
            Regel toevoegen
          </button>
        </div>
        <div className="space-y-2">
          {lines.map((line, i) => (
            <div key={i} className="grid gap-2 rounded-md border border-neutral-100 p-3 sm:grid-cols-[1fr_5rem_6rem_auto]">
              <input
                value={line.description}
                onChange={(e) => {
                  const v = e.target.value;
                  setLines((L) => L.map((x, j) => (j === i ? { ...x, description: v } : x)));
                }}
                placeholder="Omschrijving"
                className="rounded border border-neutral-200 px-2 py-1.5 text-sm"
              />
              <input
                value={line.quantity}
                onChange={(e) => {
                  const v = e.target.value;
                  setLines((L) => L.map((x, j) => (j === i ? { ...x, quantity: v } : x)));
                }}
                placeholder="Aantal"
                className="rounded border border-neutral-200 px-2 py-1.5 text-sm"
              />
              <input
                value={line.unit_price}
                onChange={(e) => {
                  const v = e.target.value;
                  setLines((L) => L.map((x, j) => (j === i ? { ...x, unit_price: v } : x)));
                }}
                placeholder="Prijs"
                className="rounded border border-neutral-200 px-2 py-1.5 text-sm"
              />
              <button
                type="button"
                onClick={() => removeLine(i)}
                className="text-[12px] text-rose-600 hover:underline"
                disabled={lines.length <= 1}
              >
                Verwijder
              </button>
            </div>
          ))}
        </div>
      </div>
      {error ? <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p> : null}
      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={busy || invoice.status === "cancelled"}
          className="sales-os-glass-primary-btn rounded-md border border-transparent bg-neutral-950 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
        >
          Opslaan
        </button>
        <Link
          href={`/admin/invoices/${invoice.id}`}
          className="sales-os-glass-outline-btn inline-flex items-center rounded-md border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50"
        >
          Bekijk document
        </Link>
      </div>
        </form>

        <div
          className={`min-w-0 flex-1 ${mobileTab === "form" ? "hidden lg:block" : ""}`}
          aria-label="Voorbeeld factuur"
        >
          <p className="billing-no-print mb-2 text-[11px] text-neutral-500 lg:hidden print:hidden">
            Voorbeeld — zo ziet het document eruit.
          </p>
          <InvoiceDocumentBody invoice={previewInvoice} />
        </div>
      </div>
    </div>
  );
}

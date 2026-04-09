"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { QuoteDocumentBody } from "@/components/admin/billing/quote-document-body";
import {
  getQuoteStatusLabel,
  lineTotalFromQtyPrice,
  parseInvoiceAmount,
  type QuoteStatus,
} from "@/lib/commercial/billing-helpers";
import { clientSnapshotsFromRow } from "@/lib/commercial/billing-insert-helpers";
import type { QuoteDetail, QuoteItemRow } from "@/lib/data/get-quote-by-id";

type LocalLine = { id: string; description: string; quantity: string; unit_price: string };

type QuoteHead = Omit<QuoteDetail, "items" | "amount">;

const ta = "mt-1 w-full rounded-md border border-neutral-200 px-3 py-2 text-sm";

function stripItems(q: QuoteDetail): QuoteHead {
  const { items: _i, amount: _a, ...rest } = q;
  return rest;
}

function linesFromItems(items: QuoteItemRow[]): LocalLine[] {
  return items.map((r) => ({
    id: r.id,
    description: r.description,
    quantity: String(parseInvoiceAmount(r.quantity)),
    unit_price: String(parseInvoiceAmount(r.unit_price)),
  }));
}

function buildPreview(head: QuoteHead, lines: LocalLine[]): QuoteDetail {
  const mappedItems: QuoteItemRow[] = [];
  let pos = 0;
  for (const l of lines) {
    const desc = l.description.trim();
    if (!desc) continue;
    const qty = parseFloat(l.quantity.replace(",", "."));
    const up = parseFloat(l.unit_price.replace(",", "."));
    if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(up) || up < 0) continue;
    const line_total = lineTotalFromQtyPrice(qty, up);
    mappedItems.push({
      id: l.id,
      quote_id: head.id,
      description: desc,
      quantity: qty,
      unit_price: up,
      line_total,
      position: pos,
      created_at: head.created_at,
    });
    pos += 1;
  }
  const amount =
    Math.round(mappedItems.reduce((s, r) => s + parseInvoiceAmount(r.line_total), 0) * 100) / 100;
  return { ...head, items: mappedItems, amount };
}

type Props = { initialQuote: QuoteDetail };

export function QuoteWorkspace({ initialQuote }: Props) {
  const router = useRouter();
  const [head, setHead] = useState<QuoteHead>(() => stripItems(initialQuote));
  const [lines, setLines] = useState<LocalLine[]>(() => linesFromItems(initialQuote.items));
  const [busy, setBusy] = useState(false);
  const [contactBusy, setContactBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<"form" | "preview">("form");

  const previewQuote = useMemo(() => buildPreview(head, lines), [head, lines]);

  const clientSlug = head.clients?.subfolder_slug ?? null;

  const applyDetail = useCallback((q: QuoteDetail) => {
    setHead(stripItems(q));
    setLines(linesFromItems(q.items));
  }, []);

  const refetchDetail = useCallback(async (): Promise<boolean> => {
    const res = await fetch(`/api/admin/quotes/${head.id}`, { credentials: "include" });
    const j = (await res.json()) as { ok?: boolean; data?: QuoteDetail; error?: string };
    if (!res.ok || !j.ok || !j.data) {
      setError(j.error ?? "Offerte ophalen mislukt.");
      return false;
    }
    applyDetail(j.data as QuoteDetail);
    setError(null);
    return true;
  }, [applyDetail, head.id]);

  const persistBody = useCallback(() => {
    const items = lines
      .map((l) => ({
        description: l.description.trim(),
        quantity: parseFloat(l.quantity.replace(",", ".")),
        unit_price: parseFloat(l.unit_price.replace(",", ".")),
      }))
      .filter((l) => l.description.length > 0);
    return {
      notes: head.notes?.trim() || null,
      title: head.title?.trim() || null,
      intro_text: head.intro_text?.trim() || null,
      scope_text: head.scope_text?.trim() || null,
      delivery_text: head.delivery_text?.trim() || null,
      exclusions_text: head.exclusions_text?.trim() || null,
      terms_text: head.terms_text?.trim() || null,
      valid_until: head.valid_until,
      status: head.status,
      replace_items: items,
      company_name_snapshot: head.company_name_snapshot?.trim() || null,
      contact_name_snapshot: head.contact_name_snapshot?.trim() || null,
      billing_email_snapshot: head.billing_email_snapshot?.trim() || null,
      billing_phone_snapshot: head.billing_phone_snapshot?.trim() || null,
      billing_address_snapshot: head.billing_address_snapshot?.trim() || null,
      billing_postal_code_snapshot: head.billing_postal_code_snapshot?.trim() || null,
      billing_city_snapshot: head.billing_city_snapshot?.trim() || null,
    };
  }, [head, lines]);

  const save = useCallback(
    async (opts?: { thenStatus?: QuoteStatus }) => {
      setError(null);
      const items = lines
        .map((l) => ({
          description: l.description.trim(),
          quantity: parseFloat(l.quantity.replace(",", ".")),
          unit_price: parseFloat(l.unit_price.replace(",", ".")),
        }))
        .filter((l) => l.description.length > 0);
      if (
        items.length === 0 ||
        items.some(
          (l) =>
            Number.isNaN(l.quantity) ||
            l.quantity <= 0 ||
            Number.isNaN(l.unit_price) ||
            l.unit_price < 0,
        )
      ) {
        setError("Vul minstens één regel met geldige aantallen en prijzen in.");
        return false;
      }
      const body = { ...persistBody(), replace_items: items };
      if (opts?.thenStatus !== undefined) {
        body.status = opts.thenStatus;
      }
      setBusy(true);
      try {
        const res = await fetch(`/api/admin/quotes/${head.id}`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const j = (await res.json()) as {
          ok?: boolean;
          error?: string;
          draft_invoice_id?: string;
          draft_invoice_existed?: boolean;
        };
        if (!j.ok) {
          setError(j.error ?? "Opslaan mislukt.");
          return false;
        }
        if (j.draft_invoice_id && body.status === "accepted" && !j.draft_invoice_existed) {
          router.push(`/admin/invoices/${j.draft_invoice_id}`);
          router.refresh();
          return true;
        }
        await refetchDetail();
        router.refresh();
        return true;
      } finally {
        setBusy(false);
      }
    },
    [head.id, lines, persistBody, refetchDetail, router],
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    await save();
  }

  async function reloadContactFromClient() {
    setContactBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/clients/billing/${head.client_id}`, {
        credentials: "include",
      });
      const j = (await res.json()) as {
        ok?: boolean;
        data?: {
          name: string;
          company_legal_name: string | null;
          contact_name: string | null;
          billing_email: string | null;
          phone: string | null;
          billing_address: string | null;
          billing_postal_code: string | null;
          billing_city: string | null;
        };
        error?: string;
      };
      if (!res.ok || !j.ok || !j.data) {
        setError(j.error ?? "Klantgegevens ophalen mislukt.");
        return;
      }
      const snap = clientSnapshotsFromRow({
        name: j.data.name,
        company_legal_name: j.data.company_legal_name,
        contact_name: j.data.contact_name,
        billing_email: j.data.billing_email,
        phone: j.data.phone,
        billing_address: j.data.billing_address,
        billing_postal_code: j.data.billing_postal_code,
        billing_city: j.data.billing_city,
      });
      setHead((h) => ({
        ...h,
        company_name_snapshot: snap.company_name_snapshot,
        contact_name_snapshot: snap.contact_name_snapshot,
        billing_email_snapshot: snap.billing_email_snapshot,
        billing_phone_snapshot: snap.billing_phone_snapshot,
        billing_address_snapshot: snap.billing_address_snapshot,
        billing_postal_code_snapshot: snap.billing_postal_code_snapshot,
        billing_city_snapshot: snap.billing_city_snapshot,
      }));
    } finally {
      setContactBusy(false);
    }
  }

  async function markSent() {
    const itemsOk =
      lines.filter((l) => l.description.trim().length > 0).length > 0 &&
      !lines.some((l) => {
        if (!l.description.trim()) return false;
        const qty = parseFloat(l.quantity.replace(",", "."));
        const up = parseFloat(l.unit_price.replace(",", "."));
        return !Number.isFinite(qty) || qty <= 0 || !Number.isFinite(up) || up < 0;
      });
    if (!itemsOk) {
      setError("Sla eerst op met geldige regels voordat je verstuurd markeert.");
      return;
    }
    const ok = await save({ thenStatus: "sent" });
    if (!ok) return;
  }

  function printDoc() {
    window.print();
  }

  function openMailto() {
    const to = head.billing_email_snapshot?.trim();
    if (!to) {
      setError("Vul eerst een e-mailadres bij contactgegevens in.");
      setMobileTab("form");
      return;
    }
    const subject = `Offerte ${head.quote_number}`;
    const docUrl =
      typeof window !== "undefined" ? `${window.location.origin}/admin/quotes/${head.id}` : "";
    const bodyText =
      `Beste,\n\nHierbij onze offerte ${head.quote_number}.\n\n` +
      `Je kunt het document in het portaal bekijken of als PDF opslaan via Afdrukken → PDF.\n` +
      (docUrl ? `Link (intern): ${docUrl}\n` : "") +
      `\nMet vriendelijke groet`;
    window.location.href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyText)}`;
  }

  function addLine() {
    setLines((L) => [...L, { id: crypto.randomUUID(), description: "", quantity: "1", unit_price: "0" }]);
  }

  function removeLine(i: number) {
    setLines((L) => L.filter((_, j) => j !== i));
  }

  const STATUSES: QuoteStatus[] = ["draft", "sent", "accepted", "rejected"];

  return (
    <div>
      <div className="billing-no-print mb-6 flex flex-wrap items-center gap-2 border-b border-neutral-200 pb-4 print:hidden">
        <Link href="/admin/quotes" className="text-[12px] font-medium text-neutral-500 hover:text-neutral-900">
          ← Alle offertes
        </Link>
        {clientSlug ? (
          <>
            <span className="text-neutral-300" aria-hidden>
              |
            </span>
            <Link
              href={`/admin/clients/${encodeURIComponent(clientSlug)}`}
              className="text-[12px] font-medium text-blue-800 underline dark:text-blue-400"
            >
              Naar klantdossier
            </Link>
          </>
        ) : null}
        <span className="w-full sm:w-auto" />
        <button
          type="button"
          onClick={() => printDoc()}
          className="sales-os-glass-primary-btn rounded-md border border-transparent bg-neutral-950 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-neutral-800"
        >
          Afdrukken / PDF
        </button>
        <button
          type="button"
          disabled={busy || head.status !== "draft"}
          onClick={() => void markSent()}
          title={
            head.status !== "draft"
              ? "Al verzonden of niet meer concept."
              : "Slaat op en zet status op Verzonden (met datum verstuurd)."
          }
          className="rounded-md border border-emerald-700 bg-emerald-700 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Markeer als verstuurd
        </button>
        <button
          type="button"
          onClick={() => openMailto()}
          className="sales-os-glass-outline-btn rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-[12px] font-medium text-neutral-800 hover:bg-neutral-50"
        >
          E-mailclient openen
        </button>
        {head.sent_at ? (
          <span className="w-full text-[11px] text-neutral-500 sm:w-auto">
            Verstuurd op {new Date(head.sent_at).toLocaleString("nl-NL")}
          </span>
        ) : null}
      </div>

      <div className="billing-no-print mb-4 flex gap-2 lg:hidden print:hidden">
        <button
          type="button"
          onClick={() => setMobileTab("form")}
          className={`rounded-md px-3 py-1.5 text-[12px] font-medium ${
            mobileTab === "form"
              ? "sales-os-glass-primary-btn border border-transparent bg-neutral-900 text-white"
              : "sales-os-glass-outline-btn border border-neutral-200 bg-white"
          }`}
        >
          Invullen
        </button>
        <button
          type="button"
          onClick={() => setMobileTab("preview")}
          className={`rounded-md px-3 py-1.5 text-[12px] font-medium ${
            mobileTab === "preview"
              ? "sales-os-glass-primary-btn border border-transparent bg-neutral-900 text-white"
              : "sales-os-glass-outline-btn border border-neutral-200 bg-white"
          }`}
        >
          Voorbeeld
        </button>
      </div>

      <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-10">
        <form
          onSubmit={(e) => void onSubmit(e)}
          className={`billing-no-print w-full shrink-0 space-y-6 print:hidden lg:w-auto lg:max-w-[420px] lg:flex-none ${
            mobileTab === "preview" ? "hidden lg:block" : ""
          }`}
        >
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">Offertenummer</p>
            <p className="mt-0.5 font-mono text-[14px] font-semibold text-neutral-900">{head.quote_number}</p>
            <h1 className="mt-2 text-xl font-semibold text-neutral-900">Offerte</h1>
            {head.clients?.client_number ? (
              <p className="mt-1 text-[12px] text-neutral-600">
                Klantnummer: <span className="font-mono">{head.clients.client_number}</span>
              </p>
            ) : null}
            <p className="mt-1 text-[12px] text-neutral-500">
              Links invullen, rechts live voorbeeld. Opslaan bewaart alles in het dossier.
            </p>
          </div>

          <details open className="rounded-lg border border-neutral-200 bg-neutral-50/50 p-4">
            <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-wide text-neutral-600">
              Contact op het document
            </summary>
            <p className="mt-2 text-[11px] text-neutral-500">
              Dit is een vaste snapshot voor deze offerte. Wijzigingen in de klantkaart overschrijven een oude offerte
              niet — gebruik &quot;Vullen vanuit klant&quot; om opnieuw te laden.
            </p>
            <button
              type="button"
              disabled={contactBusy}
              onClick={() => void reloadContactFromClient()}
              className="mt-3 text-[12px] font-medium text-blue-800 underline disabled:opacity-50 dark:text-blue-400"
            >
              Vullen vanuit klant
            </button>
            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-[11px] font-medium text-neutral-600">Bedrijfs- / klantnaam</label>
                <input
                  value={head.company_name_snapshot ?? ""}
                  onChange={(e) => setHead((h) => ({ ...h, company_name_snapshot: e.target.value || null }))}
                  className={ta}
                  maxLength={500}
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-neutral-600">Contactpersoon</label>
                <input
                  value={head.contact_name_snapshot ?? ""}
                  onChange={(e) => setHead((h) => ({ ...h, contact_name_snapshot: e.target.value || null }))}
                  className={ta}
                  maxLength={500}
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-neutral-600">E-mail</label>
                <input
                  type="email"
                  value={head.billing_email_snapshot ?? ""}
                  onChange={(e) => setHead((h) => ({ ...h, billing_email_snapshot: e.target.value || null }))}
                  className={ta}
                  maxLength={320}
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-neutral-600">Telefoon</label>
                <input
                  value={head.billing_phone_snapshot ?? ""}
                  onChange={(e) => setHead((h) => ({ ...h, billing_phone_snapshot: e.target.value || null }))}
                  className={ta}
                  maxLength={80}
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-neutral-600">Adres</label>
                <textarea
                  value={head.billing_address_snapshot ?? ""}
                  onChange={(e) => setHead((h) => ({ ...h, billing_address_snapshot: e.target.value || null }))}
                  rows={3}
                  className={ta}
                  maxLength={2000}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-[11px] font-medium text-neutral-600">Postcode</label>
                  <input
                    value={head.billing_postal_code_snapshot ?? ""}
                    onChange={(e) => setHead((h) => ({ ...h, billing_postal_code_snapshot: e.target.value || null }))}
                    className={ta}
                    maxLength={32}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-neutral-600">Plaats</label>
                  <input
                    value={head.billing_city_snapshot ?? ""}
                    onChange={(e) => setHead((h) => ({ ...h, billing_city_snapshot: e.target.value || null }))}
                    className={ta}
                    maxLength={120}
                  />
                </div>
              </div>
            </div>
          </details>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-[11px] font-medium text-neutral-600">Geldig tot</label>
              <input
                type="date"
                required
                value={head.valid_until}
                onChange={(e) => setHead((h) => ({ ...h, valid_until: e.target.value }))}
                className={ta}
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-neutral-600">Status</label>
              <select
                value={head.status}
                onChange={(e) => setHead((h) => ({ ...h, status: e.target.value as QuoteStatus }))}
                className={ta}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {getQuoteStatusLabel(s)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <section className="space-y-4 rounded-lg border border-neutral-100 bg-neutral-50/40 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Inhoud op het document</p>
            <div>
              <label className="block text-[11px] font-medium text-neutral-600">Titel (optioneel)</label>
              <input
                value={head.title ?? ""}
                onChange={(e) => setHead((h) => ({ ...h, title: e.target.value || null }))}
                className={ta}
                maxLength={500}
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-neutral-600">Introductie / voorstel</label>
              <textarea
                value={head.intro_text ?? ""}
                onChange={(e) => setHead((h) => ({ ...h, intro_text: e.target.value || null }))}
                rows={4}
                className={ta}
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-neutral-600">Gewenste functies en scope</label>
              <textarea
                value={head.scope_text ?? ""}
                onChange={(e) => setHead((h) => ({ ...h, scope_text: e.target.value || null }))}
                rows={4}
                className={ta}
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-neutral-600">Oplevering en aanpak</label>
              <textarea
                value={head.delivery_text ?? ""}
                onChange={(e) => setHead((h) => ({ ...h, delivery_text: e.target.value || null }))}
                rows={3}
                className={ta}
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-neutral-600">Niet inbegrepen</label>
              <textarea
                value={head.exclusions_text ?? ""}
                onChange={(e) => setHead((h) => ({ ...h, exclusions_text: e.target.value || null }))}
                rows={3}
                className={ta}
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-neutral-600">Voorwaarden</label>
              <textarea
                value={head.terms_text ?? ""}
                onChange={(e) => setHead((h) => ({ ...h, terms_text: e.target.value || null }))}
                rows={3}
                className={ta}
              />
            </div>
          </section>

          <div>
            <label className="block text-[11px] font-medium text-neutral-600">Opmerkingen (op document)</label>
            <textarea
              value={head.notes ?? ""}
              onChange={(e) => setHead((h) => ({ ...h, notes: e.target.value || null }))}
              rows={3}
              className={ta}
            />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-medium text-neutral-600">Prijzen — regels</span>
              <button type="button" onClick={addLine} className="text-[12px] font-medium text-neutral-900 underline">
                Regel toevoegen
              </button>
            </div>
            <div className="space-y-2">
              {lines.map((line, i) => (
                <div
                  key={line.id}
                  className="grid gap-2 rounded-md border border-neutral-100 p-3 sm:grid-cols-[1fr_4.5rem_5.5rem_auto]"
                >
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

          {error ? <p className="text-sm text-rose-600">{error}</p> : null}

          <button
            type="submit"
            disabled={busy}
            className="sales-os-glass-primary-btn rounded-md border border-transparent bg-neutral-950 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
          >
            Opslaan
          </button>
        </form>

        <div
          className={`min-w-0 flex-1 ${mobileTab === "form" ? "hidden lg:block" : ""}`}
          aria-label="Voorbeeld offerte"
        >
          <p className="billing-no-print mb-2 text-[11px] text-neutral-500 lg:hidden print:hidden">
            Voorbeeld — zo ziet het document eruit.
          </p>
          <QuoteDocumentBody quote={previewQuote} />
        </div>
      </div>
    </div>
  );
}

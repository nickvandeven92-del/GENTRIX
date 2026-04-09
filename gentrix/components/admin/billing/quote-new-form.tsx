"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import type { AdminClientRow } from "@/lib/data/list-admin-clients";
import { getQuoteStatusLabel, type QuoteStatus } from "@/lib/commercial/billing-helpers";

type Props = { clients: AdminClientRow[] };

type Line = { description: string; quantity: string; unit_price: string };

const STATUSES: QuoteStatus[] = ["draft", "sent", "accepted", "rejected"];

const ta = "mt-1 w-full rounded-md border border-neutral-200 px-3 py-2 text-sm";

export function QuoteNewForm({ clients }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const presetClient = searchParams.get("client_id") ?? "";
  const presetDeal = searchParams.get("deal_id") ?? "";
  const presetAmount = searchParams.get("amount") ?? "";

  const initialLines = useMemo<Line[]>(() => {
    const price = presetAmount.replace(",", ".").trim();
    const p = parseFloat(price);
    const unit = Number.isFinite(p) && p >= 0 ? String(p) : "0";
    return [{ description: "Diensten / producten", quantity: "1", unit_price: unit }];
  }, [presetAmount]);

  const [clientId, setClientId] = useState(presetClient);
  const [lines, setLines] = useState<Line[]>(initialLines);
  const [title, setTitle] = useState("");
  const [introText, setIntroText] = useState("");
  const [scopeText, setScopeText] = useState("");
  const [deliveryText, setDeliveryText] = useState("");
  const [exclusionsText, setExclusionsText] = useState("");
  const [termsText, setTermsText] = useState("");
  const [validUntil, setValidUntil] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  });
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<QuoteStatus>("draft");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dealId = presetDeal || null;

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
    if (!clientId || items.length === 0 || items.some((l) => Number.isNaN(l.quantity) || l.quantity <= 0 || Number.isNaN(l.unit_price) || l.unit_price < 0)) {
      setError("Kies een klant en vul minstens één geldige regel in.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/quotes", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          deal_id: dealId,
          valid_until: validUntil,
          status,
          notes: notes.trim() || null,
          title: title.trim() || null,
          intro_text: introText.trim() || null,
          scope_text: scopeText.trim() || null,
          delivery_text: deliveryText.trim() || null,
          exclusions_text: exclusionsText.trim() || null,
          terms_text: termsText.trim() || null,
          items,
        }),
      });
      const j = (await res.json()) as { ok?: boolean; error?: string; data?: { id?: string } };
      if (!j.ok) {
        setError(j.error ?? "Opslaan mislukt.");
        return;
      }
      const newId = j.data?.id;
      router.push(newId ? `/admin/quotes/${newId}` : "/admin/quotes");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={(e) => void submit(e)}
      className="sales-os-glass-panel max-w-3xl space-y-8 rounded-lg border border-neutral-200 bg-white p-5 dark:border-zinc-600/80 dark:bg-zinc-950/50"
    >
      <div>
        <label className="block text-[11px] font-medium text-neutral-600 dark:text-zinc-300">Klant</label>
        <select
          required
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          className="mt-1 w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
        >
          <option value="">— Kies —</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.client_number ? `${c.name} · ${c.client_number}` : c.name}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-[11px] font-medium text-neutral-600 dark:text-zinc-300">Geldig tot</label>
          <input
            type="date"
            required
            value={validUntil}
            onChange={(e) => setValidUntil(e.target.value)}
            className="mt-1 w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-neutral-600 dark:text-zinc-300">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as QuoteStatus)}
            className="mt-1 w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {getQuoteStatusLabel(s)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <section className="space-y-4 rounded-lg border border-neutral-100 bg-neutral-50/50 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-zinc-400">
          Inhoud op het document
        </p>
        <div>
          <label className="block text-[11px] font-medium text-neutral-600 dark:text-zinc-300">Titel (optioneel)</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={ta} maxLength={500} />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-neutral-600 dark:text-zinc-300">
            Introductie / voorstel
          </label>
          <textarea value={introText} onChange={(e) => setIntroText(e.target.value)} rows={4} className={ta} />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-neutral-600 dark:text-zinc-300">
            Gewenste functies en scope
          </label>
          <textarea value={scopeText} onChange={(e) => setScopeText(e.target.value)} rows={4} className={ta} />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-neutral-600 dark:text-zinc-300">
            Oplevering en aanpak
          </label>
          <textarea value={deliveryText} onChange={(e) => setDeliveryText(e.target.value)} rows={3} className={ta} />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-neutral-600 dark:text-zinc-300">Niet inbegrepen</label>
          <textarea value={exclusionsText} onChange={(e) => setExclusionsText(e.target.value)} rows={3} className={ta} />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-neutral-600 dark:text-zinc-300">Voorwaarden</label>
          <textarea value={termsText} onChange={(e) => setTermsText(e.target.value)} rows={3} className={ta} />
        </div>
      </section>

      <div>
        <label className="block text-[11px] font-medium text-neutral-600 dark:text-zinc-300">
          Interne opmerkingen (optioneel)
        </label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={ta} />
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[11px] font-medium text-neutral-600 dark:text-zinc-300">Prijzen — regels</span>
          <button
            type="button"
            onClick={addLine}
            className="text-[12px] font-medium text-neutral-900 underline dark:text-zinc-200"
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
                placeholder="Prijs (EUR)"
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
        Offerte aanmaken
      </button>
    </form>
  );
}

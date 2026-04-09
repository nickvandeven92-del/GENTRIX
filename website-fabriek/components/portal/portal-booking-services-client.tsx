"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Scissors, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type BookingServiceRow = {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  price_cents: number | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

type Props = { slug: string };

function formatPrice(cents: number | null): string {
  if (cents == null) return "—";
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(cents / 100);
}

export function PortalBookingServicesClient({ slug }: Props) {
  const enc = encodeURIComponent(slug);
  const base = `/api/portal/clients/${enc}/booking-services`;

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [rows, setRows] = useState<BookingServiceRow[]>([]);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState("30");
  const [priceEuro, setPriceEuro] = useState("");
  const [adding, setAdding] = useState(false);

  const [editing, setEditing] = useState<BookingServiceRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDuration, setEditDuration] = useState("");
  const [editPriceEuro, setEditPriceEuro] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const load = useCallback(async () => {
    setErr(null);
    const res = await fetch(base, { credentials: "include" });
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; services?: BookingServiceRow[]; error?: string };
    if (!res.ok || !json.ok) {
      setErr(json.error ?? "Laden mislukt.");
      setRows([]);
      return;
    }
    setRows(json.services ?? []);
  }, [base]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await load();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  function euroToCents(s: string): number | null {
    const t = s.trim().replace(",", ".");
    if (!t) return null;
    const n = parseFloat(t);
    if (!Number.isFinite(n) || n < 0) return null;
    return Math.round(n * 100);
  }

  async function addService(e: React.FormEvent) {
    e.preventDefault();
    const n = name.trim();
    const d = parseInt(duration, 10);
    if (!n || !Number.isFinite(d) || d < 10 || d > 480) return;
    const cents = euroToCents(priceEuro);
    if (priceEuro.trim() && cents === null) {
      setErr("Ongeldige prijs (gebruik bijv. 43 of 43,50).");
      return;
    }
    setAdding(true);
    setErr(null);
    try {
      const res = await fetch(base, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: n,
          description: description.trim() || null,
          duration_minutes: d,
          price_cents: cents,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setErr(json.error ?? "Toevoegen mislukt.");
        return;
      }
      setName("");
      setDescription("");
      setDuration("30");
      setPriceEuro("");
      await load();
    } finally {
      setAdding(false);
    }
  }

  async function toggleActive(svc: BookingServiceRow) {
    setErr(null);
    const res = await fetch(`${base}/${encodeURIComponent(svc.id)}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !svc.is_active }),
    });
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    if (!res.ok || !json.ok) {
      setErr(json.error ?? "Bijwerken mislukt.");
      return;
    }
    await load();
  }

  async function removeService(svc: BookingServiceRow) {
    if (!window.confirm(`“${svc.name}” verwijderen?`)) return;
    setErr(null);
    const res = await fetch(`${base}/${encodeURIComponent(svc.id)}`, { method: "DELETE", credentials: "include" });
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    if (!res.ok || !json.ok) {
      setErr(json.error ?? "Verwijderen mislukt.");
      return;
    }
    if (editing?.id === svc.id) setEditing(null);
    await load();
  }

  function openEdit(svc: BookingServiceRow) {
    setEditing(svc);
    setEditName(svc.name);
    setEditDescription(svc.description ?? "");
    setEditDuration(String(svc.duration_minutes));
    setEditPriceEuro(
      svc.price_cents == null
        ? ""
        : new Intl.NumberFormat("nl-NL", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(
            svc.price_cents / 100,
          ),
    );
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    const n = editName.trim();
    const d = parseInt(editDuration, 10);
    if (!n || !Number.isFinite(d) || d < 10 || d > 480) return;
    const cents = euroToCents(editPriceEuro);
    if (editPriceEuro.trim() && cents === null) {
      setErr("Ongeldige prijs.");
      return;
    }
    setSavingEdit(true);
    setErr(null);
    try {
      const res = await fetch(`${base}/${encodeURIComponent(editing.id)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: n,
          description: editDescription.trim() || null,
          duration_minutes: d,
          price_cents: editPriceEuro.trim() ? cents : null,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setErr(json.error ?? "Opslaan mislukt.");
        return;
      }
      setEditing(null);
      await load();
    } finally {
      setSavingEdit(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Behandelingen laden…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {err ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {err}
        </p>
      ) : null}

      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Alleen <strong>actieve</strong> behandelingen verschijnen op de publieke boekpagina. De duur bepaalt hoe lang een
        tijdslot duurt. Prijs is alleen ter informatie voor de klant.
      </p>

      <form onSubmit={(e) => void addService(e)} className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          <Plus className="size-4 text-zinc-500" aria-hidden />
          Nieuwe behandeling
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 sm:col-span-2">
            Naam
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
              placeholder="Bijv. Heren knippen"
            />
          </label>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 sm:col-span-2">
            Omschrijving (optioneel)
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </label>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Duur (minuten)
            <input
              type="number"
              min={10}
              max={480}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </label>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Prijs (€, optioneel)
            <input
              value={priceEuro}
              onChange={(e) => setPriceEuro(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
              placeholder="43,00"
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={adding}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {adding ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          Toevoegen
        </button>
      </form>

      {editing ? (
        <form
          onSubmit={(e) => void saveEdit(e)}
          className="rounded-xl border border-violet-200 bg-violet-50/50 p-4 dark:border-violet-900/50 dark:bg-violet-950/25"
        >
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Behandeling bewerken</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 sm:col-span-2">
              Naam
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
                className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </label>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 sm:col-span-2">
              Omschrijving
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={2}
                className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </label>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Duur (min)
              <input
                type="number"
                min={10}
                max={480}
                value={editDuration}
                onChange={(e) => setEditDuration(e.target.value)}
                required
                className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </label>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Prijs (€)
              <input
                value={editPriceEuro}
                onChange={(e) => setEditPriceEuro(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={savingEdit}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
            >
              {savingEdit ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              Opslaan
            </button>
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-600"
            >
              Annuleren
            </button>
          </div>
        </form>
      ) : null}

      <div>
        <h2 className="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Jouw behandelingen</h2>
        {rows.length === 0 ? (
          <p className="text-sm text-zinc-500">Nog geen behandelingen. Voeg er minstens één toe om ze op /boek te tonen.</p>
        ) : (
          <ul className="space-y-2">
            {rows.map((svc) => (
              <li
                key={svc.id}
                className={cn(
                  "flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 px-3 py-3 dark:border-zinc-700",
                  !svc.is_active && "opacity-60",
                )}
              >
                <div className="flex min-w-0 items-start gap-2">
                  <Scissors className="mt-0.5 size-4 shrink-0 text-zinc-400" aria-hidden />
                  <div className="min-w-0">
                    <p className="font-medium text-zinc-900 dark:text-zinc-50">{svc.name}</p>
                    {svc.description?.trim() ? (
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">{svc.description}</p>
                    ) : null}
                    <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
                      {svc.duration_minutes} min · {formatPrice(svc.price_cents)}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300">
                    <input
                      type="checkbox"
                      checked={svc.is_active}
                      onChange={() => void toggleActive(svc)}
                      className="rounded border-zinc-300 accent-violet-700 dark:border-zinc-600"
                    />
                    Actief op website
                  </label>
                  <button
                    type="button"
                    onClick={() => openEdit(svc)}
                    className="rounded-lg border border-zinc-300 px-2 py-1 text-xs font-medium dark:border-zinc-600"
                  >
                    Bewerken
                  </button>
                  <button
                    type="button"
                    onClick={() => void removeService(svc)}
                    className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2 py-1 text-xs text-red-800 dark:border-red-900 dark:text-red-200"
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                    Verwijderen
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

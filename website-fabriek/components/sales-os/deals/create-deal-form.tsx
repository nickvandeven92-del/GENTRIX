"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function CreateDealForm() {
  const router = useRouter();
  const [company, setCompany] = useState("");
  const [valueEur, setValueEur] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const name = company.trim();
    if (!name) {
      setErr("Bedrijfsnaam verplicht.");
      return;
    }
    const euros = Number.parseFloat(valueEur.replace(",", "."));
    const value_cents = Number.isFinite(euros) ? Math.round(euros * 100) : 0;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/sales-os/deals", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_name: name,
          title: "",
          value_cents,
          stage: "new_lead",
        }),
      });
      const j = (await res.json()) as { ok?: boolean; error?: string };
      if (!j.ok) {
        setErr(j.error ?? "Aanmaken mislukt.");
        return;
      }
      setCompany("");
      setValueEur("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={(e) => void submit(e)}
      className="mb-6 flex flex-wrap items-end gap-2 rounded-lg border border-neutral-200 bg-white p-4"
    >
      <div className="min-w-[200px] flex-1">
        <label className="text-[10px] font-medium uppercase text-slate-500">Nieuwe deal</label>
        <input
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          placeholder="Bedrijfsnaam"
          className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-neutral-950 focus:outline-none focus:ring-1 focus:ring-neutral-950/10"
        />
      </div>
      <div className="w-32">
        <label className="text-[10px] font-medium uppercase text-slate-500">Waarde (€)</label>
        <input
          value={valueEur}
          onChange={(e) => setValueEur(e.target.value)}
          placeholder="0"
          className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-neutral-950 focus:outline-none focus:ring-1 focus:ring-neutral-950/10"
        />
      </div>
      <button
        type="submit"
        disabled={busy}
        className="sales-os-glass-primary-btn rounded-md border border-transparent bg-neutral-950 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
      >
        {busy ? "…" : "Aanmaken"}
      </button>
      {err ? <p className="w-full text-xs text-rose-600">{err}</p> : null}
    </form>
  );
}

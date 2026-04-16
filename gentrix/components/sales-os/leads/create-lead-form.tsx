"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function CreateLeadForm() {
  const router = useRouter();
  const [company, setCompany] = useState("");
  const [source, setSource] = useState("");
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
    setBusy(true);
    try {
      const res = await fetch("/api/admin/sales-os/leads", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_name: name,
          ...(source.trim() ? { source: source.trim() } : {}),
        }),
      });
      const j = (await res.json()) as { ok?: boolean; error?: string };
      if (!j.ok) {
        setErr(j.error ?? "Mislukt.");
        return;
      }
      setCompany("");
      setSource("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const field =
    "mt-1 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-neutral-950 focus:outline-none focus:ring-1 focus:ring-neutral-950/10 dark:border-zinc-600 dark:bg-zinc-800/80 dark:text-zinc-100 dark:focus:border-zinc-400 dark:focus:ring-zinc-400/20";

  return (
    <form
      onSubmit={(e) => void submit(e)}
      className="sales-os-create-lead mb-6 grid gap-3 rounded-2xl border border-neutral-200 bg-white p-4 sm:grid-cols-[minmax(0,1fr)_minmax(7.5rem,10rem)_auto] sm:items-end dark:border-zinc-600/80 dark:bg-zinc-900/60"
    >
      <div className="min-w-0">
        <label className="text-[10px] font-medium uppercase tracking-wide text-neutral-500 dark:text-zinc-400">Nieuwe lead</label>
        <input
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          placeholder="Bedrijfsnaam"
          className={field}
        />
      </div>
      <div className="min-w-0 sm:max-w-[12rem]">
        <label className="text-[10px] font-medium uppercase tracking-wide text-neutral-500 dark:text-zinc-400">Bron</label>
        <input
          value={source}
          onChange={(e) => setSource(e.target.value)}
          placeholder="Bron"
          className={field}
          aria-describedby="create-lead-source-hint"
        />
        <p id="create-lead-source-hint" className="mt-1 text-[10px] leading-snug text-neutral-500 dark:text-zinc-500">
          Waar komt deze lead vandaan? Laat leeg als je het nog niet weet (dan wordt “unknown” opgeslagen). Bijv. website, telefoon, LinkedIn.
        </p>
      </div>
      <button
        type="submit"
        disabled={busy}
        className="sales-os-glass-primary-btn h-[38px] shrink-0 rounded-lg border border-transparent bg-neutral-950 px-5 text-sm font-medium text-white transition-colors hover:bg-neutral-800 disabled:opacity-50 dark:border-transparent dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
      >
        {busy ? "…" : "Opslaan"}
      </button>
      {err ? (
        <p className="text-xs text-rose-600 dark:text-rose-400 sm:col-span-3">{err}</p>
      ) : null}
    </form>
  );
}

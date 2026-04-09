"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { SalesLeadRow } from "@/lib/data/sales-leads";
import { CheckCircle2, FileText, Sparkles, ThumbsDown, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

export function LeadsWorkspace({ leads }: { leads: SalesLeadRow[] }) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(leads[0]?.id ?? "");
  const [busy, setBusy] = useState<string | null>(null);
  const [followUp, setFollowUp] = useState("");

  const selected = leads.find((l) => l.id === selectedId) ?? leads[0];
  if (!selected) {
    return <p className="text-sm text-neutral-500 dark:text-zinc-400">Nog geen leads — voeg er een toe.</p>;
  }

  async function patchLead(id: string, body: Record<string, unknown>) {
    setBusy(id);
    try {
      const res = await fetch(`/api/admin/sales-os/leads/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = (await res.json()) as { ok?: boolean };
      if (j.ok) router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function convert(id: string) {
    setBusy(id);
    try {
      const res = await fetch(`/api/admin/sales-os/leads/${id}/convert`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const j = (await res.json()) as { ok?: boolean; data?: { deal?: { id: string } } };
      if (j.ok && j.data?.deal?.id) {
        router.push(`/admin/ops/deals/${j.data.deal.id}`);
        router.refresh();
      }
    } finally {
      setBusy(null);
    }
  }

  async function createClientFromLead(id: string) {
    setBusy(id);
    try {
      const res = await fetch(`/api/admin/sales-os/leads/${id}/create-client`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const j = (await res.json()) as { ok?: boolean; data?: { id: string }; error?: string };
      if (!j.ok) {
        alert(j.error ?? "Klant aanmaken mislukt.");
        return;
      }
      if (j.data?.id) {
        router.push(`/admin/quotes/new?client_id=${encodeURIComponent(j.data.id)}`);
        router.refresh();
      }
    } finally {
      setBusy(null);
    }
  }

  const inputClass =
    "mt-2 w-full rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-sm text-neutral-900 focus:border-neutral-950 focus:outline-none focus:ring-1 focus:ring-neutral-950/10 dark:border-zinc-600 dark:bg-zinc-800/80 dark:text-zinc-100 dark:focus:border-zinc-400 dark:focus:ring-zinc-400/20";

  const btnOutline =
    "flex w-full items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-left text-[12px] font-medium text-neutral-900 transition-colors hover:border-neutral-300 hover:bg-neutral-50 dark:border-zinc-600 dark:bg-zinc-800/40 dark:text-zinc-100 dark:hover:border-zinc-500 dark:hover:bg-zinc-800/70";

  return (
    <div
      className={cn(
        "leads-workspace-root grid min-h-[min(72vh,680px)] grid-cols-1 overflow-hidden rounded-2xl border border-neutral-200 bg-white",
        "lg:grid-cols-12 lg:items-stretch",
        "dark:border-zinc-600/80 dark:bg-zinc-900/60",
      )}
    >
      <aside className="flex flex-col border-b border-neutral-200 bg-neutral-50/60 dark:border-zinc-600/60 dark:bg-zinc-900/40 lg:col-span-3 lg:border-b-0 lg:border-r">
        <p className="shrink-0 border-b border-neutral-200 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-500 dark:border-zinc-600 dark:text-zinc-400">
          Leads
        </p>
        <ul className="min-h-0 flex-1 overflow-y-auto">
          {leads.map((l) => (
            <li key={l.id}>
              <button
                type="button"
                onClick={() => setSelectedId(l.id)}
                className={cn(
                  "flex w-full flex-col items-start gap-0.5 border-b border-neutral-100 px-3 py-2.5 text-left transition-colors dark:border-zinc-700/80",
                  selectedId === l.id
                    ? "bg-white ring-1 ring-inset ring-neutral-200 dark:bg-zinc-800/90 dark:ring-zinc-500/40"
                    : "hover:bg-neutral-100/90 dark:hover:bg-zinc-800/50",
                )}
              >
                <span className="text-[12px] font-medium text-neutral-900 dark:text-zinc-50">{l.company_name}</span>
                <span className="text-[10px] text-neutral-500 dark:text-zinc-400">{l.source}</span>
                <span className="text-[10px] text-neutral-600 dark:text-zinc-500">{l.status}</span>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <main className="flex flex-col border-b border-neutral-200 p-4 sm:p-5 dark:border-zinc-600/60 lg:col-span-6 lg:border-b-0 lg:border-r">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-zinc-50">{selected.company_name}</h2>
        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-[10px] uppercase tracking-wide text-neutral-500 dark:text-zinc-400">Contact</dt>
            <dd className="mt-0.5 text-neutral-800 dark:text-zinc-200">{selected.contact_name ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-wide text-neutral-500 dark:text-zinc-400">E-mail</dt>
            <dd className="mt-0.5 text-neutral-800 dark:text-zinc-200">{selected.email ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-wide text-neutral-500 dark:text-zinc-400">Budget</dt>
            <dd className="mt-0.5 text-neutral-800 dark:text-zinc-200">{selected.budget_estimate ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-wide text-neutral-500 dark:text-zinc-400">Status</dt>
            <dd className="mt-0.5 text-neutral-800 dark:text-zinc-200">{selected.status}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-[10px] uppercase tracking-wide text-neutral-500 dark:text-zinc-400">Notities</dt>
            <dd className="mt-0.5 whitespace-pre-wrap text-neutral-600 dark:text-zinc-300">
              {selected.notes ?? "—"}
            </dd>
          </div>
        </dl>
        <div className="mt-5 rounded-xl border border-neutral-200 bg-neutral-50/80 p-3 dark:border-zinc-600 dark:bg-zinc-800/40">
          <p className="text-[10px] font-semibold uppercase text-neutral-500 dark:text-zinc-400">Follow-up plannen</p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <input
                type="datetime-local"
                value={followUp}
                onChange={(e) => setFollowUp(e.target.value)}
                className={inputClass.replace("mt-2 ", "")}
              />
            </div>
            <button
              type="button"
              disabled={busy === selected.id || !followUp}
              onClick={() => {
                void patchLead(selected.id, { next_follow_up_at: new Date(followUp).toISOString() });
                setFollowUp("");
              }}
              className="shrink-0 rounded-lg border border-neutral-200 bg-white px-4 py-2 text-xs font-semibold text-neutral-900 transition-colors hover:border-neutral-300 hover:bg-neutral-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-600"
            >
              Datum opslaan
            </button>
          </div>
        </div>
      </main>

      <aside className="flex flex-col bg-neutral-50/40 p-4 sm:p-5 dark:bg-zinc-900/30 lg:col-span-3">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-zinc-400">Acties</p>
        <div className="mt-3 flex flex-col gap-2">
          <button
            type="button"
            disabled={busy === selected.id || selected.status === "converted"}
            onClick={() => void patchLead(selected.id, { status: "qualified" })}
            className={btnOutline}
          >
            <CheckCircle2 className="size-4 text-neutral-500 dark:text-zinc-400" />
            Kwalificeren
          </button>
          <button
            type="button"
            disabled={busy === selected.id || selected.status === "converted"}
            onClick={() => void convert(selected.id)}
            className={btnOutline}
          >
            <FileText className="size-4 text-neutral-500 dark:text-zinc-400" />
            Converteren naar deal
          </button>
          <button
            type="button"
            disabled={busy === selected.id || selected.status === "converted"}
            onClick={() => void createClientFromLead(selected.id)}
            className="flex w-full items-center gap-2 rounded-lg border border-violet-300/80 bg-violet-50/90 px-3 py-2.5 text-left text-[12px] font-medium text-violet-950 transition-colors hover:border-violet-400 hover:bg-violet-50 dark:border-violet-500/40 dark:bg-violet-950/40 dark:text-violet-100 dark:hover:bg-violet-950/60"
          >
            <FileText className="size-4 text-violet-600 dark:text-violet-300" />
            Klant aanmaken en offerte starten
          </button>
          <button
            type="button"
            disabled={busy === selected.id}
            onClick={() => void patchLead(selected.id, { status: "lost" })}
            className={btnOutline}
          >
            <ThumbsDown className="size-4 text-neutral-500 dark:text-zinc-400" />
            Markeer als verloren
          </button>
          <button
            type="button"
            disabled
            title="Koppel agenda-integratie om dit te automatiseren."
            className="flex cursor-not-allowed items-center gap-2 rounded-lg border border-neutral-100 bg-neutral-50 px-3 py-2.5 text-left text-[12px] text-neutral-400 dark:border-zinc-700 dark:bg-zinc-800/30 dark:text-zinc-500"
          >
            <Calendar className="size-4" />
            Geplande follow-up (extern)
          </button>
          <Link
            href="/admin/ops/studio"
            className="sales-os-glass-primary-btn flex items-center justify-center gap-2 rounded-lg border border-transparent bg-neutral-950 py-2.5 text-[12px] font-medium text-white transition-colors hover:bg-neutral-800 dark:border-transparent dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            <Sparkles className="size-4" />
            Site-studio
          </Link>
        </div>
      </aside>
    </div>
  );
}

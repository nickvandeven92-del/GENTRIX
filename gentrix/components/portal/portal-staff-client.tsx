"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Trash2, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

export type StaffMember = {
  id: string;
  name: string;
  sort_order: number;
  color_hex: string | null;
  is_active: boolean;
  created_at: string;
};

type Props = { slug: string };

export function PortalStaffClient({ slug }: Props) {
  const enc = encodeURIComponent(slug);
  const base = `/api/portal/clients/${enc}/staff`;

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setErr(null);
    const res = await fetch(base, { credentials: "include" });
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; staff?: StaffMember[]; error?: string };
    if (!res.ok || !json.ok) {
      setErr(json.error ?? "Laden mislukt.");
      setStaff([]);
      return;
    }
    setStaff(json.staff ?? []);
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

  async function addMember(e: React.FormEvent) {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    setAdding(true);
    setErr(null);
    try {
      const res = await fetch(base, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: n }),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setErr(json.error ?? "Toevoegen mislukt.");
        return;
      }
      setName("");
      await load();
    } finally {
      setAdding(false);
    }
  }

  async function toggleActive(m: StaffMember) {
    setErr(null);
    const res = await fetch(`${base}/${encodeURIComponent(m.id)}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !m.is_active }),
    });
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    if (!res.ok || !json.ok) {
      setErr(json.error ?? "Bijwerken mislukt.");
      return;
    }
    await load();
  }

  async function removeMember(m: StaffMember) {
    if (!window.confirm(`“${m.name}” verwijderen? Geplande diensten van deze medewerker gaan ook weg.`)) return;
    setErr(null);
    const res = await fetch(`${base}/${encodeURIComponent(m.id)}`, { method: "DELETE", credentials: "include" });
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    if (!res.ok || !json.ok) {
      setErr(json.error ?? "Verwijderen mislukt.");
      return;
    }
    await load();
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Medewerkers laden…
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

      <form onSubmit={addMember} className="flex flex-wrap items-end gap-2">
        <div className="min-w-[12rem] flex-1">
          <label htmlFor="new-staff-name" className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Nieuwe medewerker
          </label>
          <input
            id="new-staff-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Naam"
            className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            maxLength={120}
          />
        </div>
        <button
          type="submit"
          disabled={adding || !name.trim()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {adding ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" aria-hidden />}
          Toevoegen
        </button>
      </form>

      <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white dark:divide-zinc-700 dark:border-zinc-800 dark:bg-zinc-900">
        {staff.length === 0 ? (
          <li className="px-4 py-8 text-center text-sm text-zinc-500">Nog geen medewerkers. Voeg iemand toe om te kunnen plannen.</li>
        ) : (
          staff.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="flex items-center gap-2">
                <UserRound className="size-4 text-zinc-400" aria-hidden />
                <span className={cn("font-medium text-zinc-900 dark:text-zinc-50", !m.is_active && "text-zinc-400 line-through")}>
                  {m.name}
                </span>
                {!m.is_active ? <span className="text-xs text-zinc-500">(inactief)</span> : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => toggleActive(m)}
                  className="rounded-lg border border-zinc-200 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  {m.is_active ? "Deactiveren" : "Activeren"}
                </button>
                <button
                  type="button"
                  onClick={() => removeMember(m)}
                  className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40"
                >
                  <Trash2 className="size-3.5" aria-hidden />
                  Verwijderen
                </button>
              </div>
            </li>
          ))
        )}
      </ul>

      <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Tip: op <strong>Planning</strong> zet je met <strong>Taak inplannen</strong> werktijden neer (ook voor meerdere dagen); die kunnen meewegen voor online boeken, afhankelijk van je instellingen.
      </p>
    </div>
  );
}

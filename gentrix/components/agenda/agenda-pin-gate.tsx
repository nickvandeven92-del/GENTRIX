"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

function storageKey(clientId: string) {
  return `gentrix_agenda_unlock_v1_${clientId}`;
}

type Props = {
  clientId: string;
  slug: string;
  children: React.ReactNode;
};

/**
 * Optionele tweede stap na Supabase-login: 4–6 cijfers, alleen op dit apparaat (sessionStorage).
 * Geen vervanging van Auth; alleen om gedeelde tablets te “ontgrendelen” na de echte login.
 */
export function AgendaPinGate({ clientId, slug, children }: Props) {
  const enc = encodeURIComponent(decodeURIComponent(slug));
  const [phase, setPhase] = useState<"loading" | "open" | "locked">("loading");
  const [pin, setPin] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const refresh = useCallback(async () => {
    setPhase("loading");
    setErr(null);
    try {
      const res = await fetch(`/api/portal/clients/${enc}/agenda-pin`, { credentials: "include" });
      const json = (await res.json()) as { ok?: boolean; pinSet?: boolean };
      if (!res.ok || !json.ok) {
        setPhase("open");
        return;
      }
      if (!json.pinSet) {
        setPhase("open");
        return;
      }
      if (typeof window !== "undefined" && window.sessionStorage.getItem(storageKey(clientId)) === "1") {
        setPhase("open");
        return;
      }
      setPhase("locked");
    } catch {
      setPhase("open");
    }
  }, [clientId, enc]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function submitPin(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/portal/clients/${enc}/agenda-pin/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ pin }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setErr(json.error ?? "Controle mislukt.");
        return;
      }
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(storageKey(clientId), "1");
      }
      setPin("");
      setPhase("open");
    } catch {
      setErr("Netwerkfout.");
    } finally {
      setSubmitting(false);
    }
  }

  if (phase === "loading") {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-sm text-zinc-500">
        <Loader2 className="size-5 animate-spin" aria-hidden />
        Beveiliging laden…
      </div>
    );
  }

  if (phase === "locked") {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-md flex-col justify-center px-4 py-12">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">PIN voor deze agenda</h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Je bent ingelogd met hetzelfde account als het Gentrix-portaal. Voer de agenda-PIN in (4–6 cijfers) die de
            zaak-eigenaar heeft ingesteld — alleen nodig op dit apparaat.
          </p>
          <form onSubmit={(e) => void submitPin(e)} className="mt-6 space-y-4">
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              PIN
              <input
                type="password"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="\d*"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-lg tracking-widest dark:border-zinc-600 dark:bg-zinc-950"
                placeholder="••••"
              />
            </label>
            {err ? <p className="text-sm text-red-600 dark:text-red-400">{err}</p> : null}
            <button
              type="submit"
              disabled={submitting || pin.length < 4}
              className="w-full rounded-lg bg-emerald-700 py-2.5 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
            >
              {submitting ? "…" : "Ontgrendelen"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export function clearAgendaPinUnlock(clientId: string) {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(storageKey(clientId));
}

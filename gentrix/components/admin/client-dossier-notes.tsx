"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import type { ClientDossierNoteRow } from "@/lib/data/list-client-dossier-notes";
import { cn } from "@/lib/utils";

type Props = {
  subfolderSlug: string;
  initialNotes: ClientDossierNoteRow[];
};

export function ClientDossierNotes({ subfolderSlug, initialNotes }: Props) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(async () => {
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/clients/${encodeURIComponent(subfolderSlug)}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ body }),
      });
      const j = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !j?.ok) {
        setError(j?.error ?? `HTTP ${res.status}`);
        return;
      }
      setText("");
      router.refresh();
    } catch {
      setError("Netwerkfout.");
    } finally {
      setBusy(false);
    }
  }, [text, busy, subfolderSlug, router]);

  return (
    <section className="sales-os-glass-panel rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Notities</h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Interne tijdlijn per klant. Elke notitie toont wie hem heeft toegevoegd (ingelogde gebruiker).
      </p>

      <div className="mt-4 space-y-3">
        <label className="sr-only" htmlFor="dossier-note-input">
          Nieuwe notitie
        </label>
        <textarea
          id="dossier-note-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          maxLength={8000}
          placeholder="Typ een notitie…"
          className={cn(
            "w-full resize-y rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900",
            "placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400/30",
            "dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500",
          )}
        />
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void submit()}
            disabled={busy || !text.trim()}
            className={cn(
              "sales-os-glass-primary-btn rounded-lg border border-transparent bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800",
              "disabled:pointer-events-none disabled:opacity-50",
              "dark:border-transparent dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white",
            )}
          >
            {busy ? "Opslaan…" : "Notitie toevoegen"}
          </button>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">{text.length} / 8000</span>
        </div>
        {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
      </div>

      {initialNotes.length > 0 ? (
        <ul className="mt-6 space-y-4 border-t border-zinc-100 pt-6 dark:border-zinc-800">
          {initialNotes.map((n) => (
            <li key={n.id} className="rounded-lg border border-zinc-100 bg-zinc-50/80 p-3 dark:border-zinc-800 dark:bg-zinc-900/50">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                <span className="font-medium text-zinc-700 dark:text-zinc-300">{n.created_by_label}</span>
                <span className="mx-1.5">·</span>
                {new Date(n.created_at).toLocaleString("nl-NL", { dateStyle: "short", timeStyle: "short" })}
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-800 dark:text-zinc-200">{n.body}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-6 border-t border-zinc-100 pt-6 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          Nog geen notities. Voeg hierboven de eerste toe.
        </p>
      )}
    </section>
  );
}

"use client";

import { useCallback, useState } from "react";
import { BookCheck, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type SectionInput = { id: string; html: string };

type SpellIssue = {
  sectionId: string;
  message: string;
  offsetInChunk: number;
  length: number;
  suggestion: string | null;
  highlightedSnippet: string;
};

type DutchSpellcheckPanelProps = {
  sections: SectionInput[];
  className?: string;
};

export function DutchSpellcheckPanel({ sections, className }: DutchSpellcheckPanelProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<SpellIssue[] | null>(null);
  const [truncated, setTruncated] = useState(false);

  const runCheck = useCallback(async () => {
    setError(null);
    setIssues(null);
    setTruncated(false);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/spellcheck-dutch", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sections }),
      });
      const json = (await res.json()) as
        | { ok: true; issues: SpellIssue[]; truncated?: boolean }
        | { ok: false; error?: string };
      if (!res.ok || !json.ok) {
        setError("error" in json && json.error ? json.error : `HTTP ${res.status}`);
        return;
      }
      setIssues(json.issues);
      setTruncated(Boolean(json.truncated));
    } catch {
      setError("Netwerkfout bij spellingscontrole.");
    } finally {
      setLoading(false);
    }
  }, [sections]);

  if (sections.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-800 shadow-sm",
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="font-medium text-slate-900">Nederlandse spelling en grammatica</p>
          <p className="text-xs text-slate-600">
            Optionele controle via LanguageTool (extern). Toont alleen suggesties:{" "}
            <strong className="font-medium text-slate-800">de site-JSON wordt niet automatisch gewijzigd</strong>.
            Merknamen en vakjargon kunnen vals alarm geven.
          </p>
        </div>
        <button
          type="button"
          onClick={runCheck}
          disabled={loading}
          className={cn(
            "inline-flex shrink-0 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 shadow-sm",
            "hover:border-indigo-300 hover:bg-indigo-50/60 disabled:cursor-not-allowed disabled:opacity-60",
          )}
        >
          {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <BookCheck className="size-4" aria-hidden />}
          {loading ? "Bezig…" : "Controleer teksten"}
        </button>
      </div>

      {error ? (
        <p className="mt-3 text-xs text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      {issues && issues.length === 0 ? (
        <p className="mt-3 text-xs font-medium text-emerald-800">Geen opmerkingen gevonden in de geëxtraheerde tekst.</p>
      ) : null}

      {issues && issues.length > 0 ? (
        <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto text-xs">
          {issues.map((it, i) => (
            <li
              key={`${it.sectionId}-${i}-${it.offsetInChunk}`}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-slate-800"
            >
              <span className="font-mono text-[10px] text-slate-500">{it.sectionId}</span>
              <p className="mt-0.5 text-slate-700">{it.message}</p>
              {it.suggestion ? (
                <p className="mt-1 text-slate-600">
                  Suggestie: <span className="font-medium text-slate-900">{it.suggestion}</span>
                </p>
              ) : null}
              <p className="mt-1 font-mono text-[10px] leading-relaxed text-slate-500 break-all">
                …{it.highlightedSnippet}…
              </p>
            </li>
          ))}
        </ul>
      ) : null}

      {truncated ? (
        <p className="mt-2 text-[11px] text-slate-500">Lijst ingekort; los eerst de bovenste punten op en controleer opnieuw.</p>
      ) : null}
    </div>
  );
}

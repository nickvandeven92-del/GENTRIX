"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Loader2, Save } from "lucide-react";
import { cn } from "@/lib/utils";

type SectionRow = { key: string; sectionName: string; html: string };

type Props = {
  slug: string;
};

export function PortalDraftSectionsEditor({ slug }: Props) {
  const enc = encodeURIComponent(decodeURIComponent(slug));
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [documentTitle, setDocumentTitle] = useState("");
  const [rows, setRows] = useState<SectionRow[]>([]);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadErr(null);
    try {
      const res = await fetch(`/api/portal/clients/${enc}/draft-sections`);
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        data?: { documentTitle?: string | null; sections?: SectionRow[] };
      };
      if (!res.ok || !json.ok || !json.data?.sections) {
        setLoadErr(json.error ?? "Laden mislukt.");
        setRows([]);
        return;
      }
      setDocumentTitle(json.data.documentTitle?.trim() ?? "");
      setRows(json.data.sections);
      const o: Record<string, boolean> = {};
      json.data.sections.forEach((_, i) => {
        if (i < 3) o[json.data!.sections![i]!.key] = true;
      });
      setOpen(o);
    } catch {
      setLoadErr("Netwerkfout bij laden.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [enc]);

  useEffect(() => {
    void load();
  }, [load]);

  const setHtml = useCallback((key: string, html: string) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, html } : r)));
  }, []);

  const onSave = useCallback(async () => {
    setSaving(true);
    setSaveMsg(null);
    setSaveErr(null);
    try {
      const res = await fetch(`/api/portal/clients/${enc}/draft-sections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentTitle: documentTitle.trim() || undefined,
          patches: rows.map((r) => ({ key: r.key, html: r.html })),
        }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string; data?: { snapshot_id?: string } };
      if (!res.ok || !json.ok) {
        setSaveErr(json.error ?? "Opslaan mislukt.");
        return;
      }
      setSaveMsg("Concept opgeslagen. Gebruik “Zet huidige versie live” om bezoekers de wijziging te tonen.");
      await load();
    } catch {
      setSaveErr("Netwerkfout bij opslaan.");
    } finally {
      setSaving(false);
    }
  }, [documentTitle, enc, load, rows]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-zinc-500">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Secties laden…
      </div>
    );
  }

  if (loadErr) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
        {loadErr}
        <p className="mt-2 text-xs text-amber-900/80 dark:text-amber-200/90">
          Alleen <strong>Tailwind</strong>-sites (project snapshot) zijn hier te bewerken. Vraag je studio om legacy- of
          React-sites te migreren.
        </p>
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Teksten &amp; secties</h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Pas HTML per sectie aan (koppen, paragrafen, knoppen). Gevaarlijke tags worden automatisch gefilterd. Sla op als
        concept; daarna kun je publiceren naar de live site.
      </p>

      <div className="mt-4">
        <label className="block text-xs font-medium uppercase tracking-wide text-zinc-500">Browsertitel (tab)</label>
        <input
          value={documentTitle}
          onChange={(e) => setDocumentTitle(e.target.value)}
          className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          placeholder="Naam van de site in de tab"
        />
      </div>

      <div className="mt-5 space-y-2">
        {rows.map((r) => {
          const isOpen = open[r.key] ?? false;
          return (
            <div key={r.key} className="rounded-xl border border-zinc-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setOpen((o) => ({ ...o, [r.key]: !isOpen }))}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800/80"
              >
                <span className="min-w-0 truncate">
                  <code className="text-xs text-zinc-500">{r.key}</code> · {r.sectionName}
                </span>
                {isOpen ? <ChevronDown className="size-4 shrink-0" /> : <ChevronRight className="size-4 shrink-0" />}
              </button>
              {isOpen ? (
                <div className="border-t border-zinc-100 p-3 dark:border-zinc-800">
                  <textarea
                    value={r.html}
                    onChange={(e) => setHtml(r.key, e.target.value)}
                    spellCheck={false}
                    className={cn(
                      "font-mono text-xs leading-relaxed",
                      "min-h-[220px] w-full resize-y rounded-lg border border-zinc-200 bg-zinc-50 p-2",
                      "dark:border-zinc-700 dark:bg-zinc-950",
                    )}
                  />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={saving}
          onClick={() => void onSave()}
          className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        >
          {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Save className="size-4" aria-hidden />}
          Opslaan als concept
        </button>
      </div>
      {saveErr ? <p className="mt-3 text-sm text-red-700 dark:text-red-300">{saveErr}</p> : null}
      {saveMsg ? <p className="mt-3 text-sm text-emerald-800 dark:text-emerald-200">{saveMsg}</p> : null}
    </section>
  );
}

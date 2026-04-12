"use client";

import { BookmarkPlus, RotateCcw, Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { defaultFlyerCopyForTemplate } from "@/lib/flyer/flyer-studio-defaults";
import type { FlyerPdfTemplateId, FlyerPreset, FlyerStudioPersisted } from "@/lib/flyer/flyer-studio-schema";
import { cn } from "@/lib/utils";

type Props = {
  slug: string;
  initialStudio: FlyerStudioPersisted;
};

const TEMPLATE_OPTIONS: { id: FlyerPdfTemplateId; label: string; hint: string }[] = [
  { id: "gentrix", label: "Gentrix · donker", hint: "Gradient, logo, paarse accenten" },
  { id: "modern", label: "Modern · donker", hint: "Strak kader, witte QR-rand" },
  { id: "minimal", label: "Rustig · licht", hint: "Zwart op licht papier" },
];

export function FlyerStudioEditor({ slug, initialStudio }: Props) {
  const router = useRouter();
  const [studio, setStudio] = useState<FlyerStudioPersisted>(initialStudio);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [presetName, setPresetName] = useState("");

  useEffect(() => {
    setStudio(initialStudio);
  }, [initialStudio]);

  const applyDefaultsForTemplate = useCallback((t: FlyerPdfTemplateId) => {
    const d = defaultFlyerCopyForTemplate(t);
    setStudio((s) => ({
      ...s,
      pdfTemplate: d.pdfTemplate,
      badge: d.badge,
      headline: d.headline,
      headlineHighlight: d.headlineHighlight,
      body: d.body,
    }));
    setErr(null);
    setMsg(null);
  }, []);

  const save = useCallback(async () => {
    setErr(null);
    setMsg(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/clients/${encodeURIComponent(slug)}/flyer-studio`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studio }),
      });
      const j = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !j.ok) {
        setErr(j.error ?? "Opslaan mislukt.");
        return;
      }
      setMsg("Opgeslagen.");
      router.refresh();
    } catch {
      setErr("Netwerkfout bij opslaan.");
    } finally {
      setSaving(false);
    }
  }, [router, slug, studio]);

  const savePreset = useCallback(() => {
    const name = presetName.trim();
    if (!name) {
      setErr("Geef je template een korte naam.");
      setMsg(null);
      return;
    }
    if (studio.presets.length >= 8) {
      setErr("Maximaal 8 opgeslagen templates.");
      setMsg(null);
      return;
    }
    const id = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `p-${Date.now()}`;
    const preset: FlyerPreset = {
      id,
      name,
      pdfTemplate: studio.pdfTemplate,
      badge: studio.badge,
      headline: studio.headline,
      headlineHighlight: studio.headlineHighlight,
      body: studio.body,
    };
    setStudio((s) => ({ ...s, presets: [...s.presets, preset] }));
    setPresetName("");
    setErr(null);
    setMsg("Template toegevoegd — vergeet niet op Opslaan te klikken.");
  }, [presetName, studio]);

  const removePreset = useCallback((id: string) => {
    setStudio((s) => ({ ...s, presets: s.presets.filter((p) => p.id !== id) }));
    setMsg(null);
  }, []);

  const loadPreset = useCallback((p: FlyerPreset) => {
    setStudio((s) => ({
      ...s,
      pdfTemplate: p.pdfTemplate,
      badge: p.badge,
      headline: p.headline,
      headlineHighlight: p.headlineHighlight,
      body: p.body,
    }));
    setErr(null);
    setMsg(null);
  }, []);

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Flyerstudio</h3>
          <p className="mt-1 max-w-xl text-xs text-zinc-600 dark:text-zinc-400">
            Bewerk de teksten voor de PDF-flyers. Elke download gebruikt dezelfde flyer-QR; je kunt meerdere vaste
            sjablonen bewaren (bijv. seizoenscampagnes) en die met één klik in het formulier laden.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          <Save className="size-4" aria-hidden />
          {saving ? "Bezig…" : "Opslaan"}
        </button>
      </div>

      {msg ? <p className="mt-3 text-sm text-emerald-700 dark:text-emerald-400">{msg}</p> : null}
      {err ? <p className="mt-3 text-sm text-red-700 dark:text-red-400">{err}</p> : null}

      <div className="mt-6 space-y-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Voorkeur layout</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {TEMPLATE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setStudio((s) => ({ ...s, pdfTemplate: opt.id }))}
                className={cn(
                  "rounded-xl border px-3 py-2 text-left text-xs transition",
                  studio.pdfTemplate === opt.id
                    ? "border-violet-500 bg-violet-50 text-violet-950 dark:border-violet-500/60 dark:bg-violet-950/40 dark:text-violet-100"
                    : "border-zinc-200 bg-zinc-50 text-zinc-800 hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-600",
                )}
              >
                <span className="font-semibold">{opt.label}</span>
                <span className="mt-0.5 block text-[11px] opacity-80">{opt.hint}</span>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => applyDefaultsForTemplate(studio.pdfTemplate)}
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-violet-700 underline-offset-2 hover:underline dark:text-violet-300"
          >
            <RotateCcw className="size-3.5" aria-hidden />
            Standaardtekst voor deze layout
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
            Label / pill (bovenkop)
            <input
              value={studio.badge}
              onChange={(e) => setStudio((s) => ({ ...s, badge: e.target.value }))}
              className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
              maxLength={72}
              autoComplete="off"
            />
          </label>
          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
            Accentregel (kleur, naast kop — optioneel)
            <input
              value={studio.headlineHighlight}
              onChange={(e) => setStudio((s) => ({ ...s, headlineHighlight: e.target.value }))}
              className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
              maxLength={100}
              autoComplete="off"
            />
          </label>
        </div>

        <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
          Hoofdkop
          <input
            value={studio.headline}
            onChange={(e) => setStudio((s) => ({ ...s, headline: e.target.value }))}
            className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
            maxLength={140}
            autoComplete="off"
          />
        </label>

        <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
          Bodytekst
          <textarea
            value={studio.body}
            onChange={(e) => setStudio((s) => ({ ...s, body: e.target.value }))}
            rows={5}
            className="mt-1.5 w-full resize-y rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
            maxLength={900}
          />
        </label>

        <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
          <p className="text-xs font-medium text-zinc-800 dark:text-zinc-200">Opgeslagen templates</p>
          <p className="mt-1 text-[11px] text-zinc-600 dark:text-zinc-400">
            Voeg de huidige teksten toe als preset, sla op, en laad ze later hier weer in.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <input
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="Naam (bijv. Wintermailing)"
              className="min-w-[12rem] flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              maxLength={80}
            />
            <button
              type="button"
              onClick={savePreset}
              className="inline-flex items-center gap-1.5 rounded-lg border border-violet-300 bg-violet-50 px-3 py-2 text-sm font-medium text-violet-950 hover:bg-violet-100 dark:border-violet-800 dark:bg-violet-950/50 dark:text-violet-100 dark:hover:bg-violet-950/80"
            >
              <BookmarkPlus className="size-4" aria-hidden />
              Toevoegen
            </button>
          </div>
          {studio.presets.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {studio.presets.map((p) => (
                <li
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                >
                  <span className="font-medium text-zinc-800 dark:text-zinc-100">{p.name}</span>
                  <span className="text-xs text-zinc-500">{p.pdfTemplate}</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => loadPreset(p)}
                      className="text-xs font-medium text-violet-700 hover:underline dark:text-violet-300"
                    >
                      Laden
                    </button>
                    <button
                      type="button"
                      onClick={() => removePreset(p.id)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-red-700 hover:underline dark:text-red-400"
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                      Verwijderen
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-xs text-zinc-500">Nog geen eigen templates.</p>
          )}
        </div>
      </div>
    </div>
  );
}

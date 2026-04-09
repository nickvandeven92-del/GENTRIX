"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, Pencil, Plus, Trash2, X } from "lucide-react";
import {
  AI_KNOWLEDGE_CATEGORIES,
  AI_KNOWLEDGE_MANUAL_CATEGORIES,
  KNOWLEDGE_JOURNAL_CATEGORY,
  type AiKnowledgeCategory,
  type AiKnowledgeManualCategory,
} from "@/lib/ai/knowledge-categories";
import { MAX_REFERENCE_IMAGES_PER_ROW, type AiKnowledgeRow } from "@/lib/data/ai-knowledge-shared";
type Props = {
  initialRows: AiKnowledgeRow[];
};

function isKnownCategory(c: string): c is AiKnowledgeCategory {
  return (AI_KNOWLEDGE_CATEGORIES as readonly string[]).includes(c);
}

export function AiKnowledgeAdminPanel({ initialRows }: Props) {
  const [rows, setRows] = useState<AiKnowledgeRow[]>(initialRows);
  const formSectionRef = useRef<HTMLElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const screenshotInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setRows(initialRows);
  }, [initialRows]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [formCategory, setFormCategory] = useState<AiKnowledgeCategory>("Design Regels");
  const [formTitle, setFormTitle] = useState("");
  const [formBody, setFormBody] = useState("");
  const [formActive, setFormActive] = useState(true);
  const [formSort, setFormSort] = useState(0);
  const [formReferenceUrls, setFormReferenceUrls] = useState<string[]>([]);
  const [imageUploadBusy, setImageUploadBusy] = useState(false);

  const resetForm = useCallback(() => {
    setFormCategory("Design Regels");
    setFormTitle("");
    setFormBody("");
    setFormActive(true);
    setFormSort(0);
    setFormReferenceUrls([]);
    setEditingId(null);
    setCreating(false);
  }, []);

  const openCreate = (presetCategory?: AiKnowledgeManualCategory) => {
    setFormCategory(presetCategory ?? "Design Regels");
    setFormTitle("");
    setFormBody("");
    setFormActive(true);
    setFormSort(0);
    setFormReferenceUrls([]);
    setEditingId(null);
    setCreating(true);
    setError(null);
  };

  const openEdit = (row: AiKnowledgeRow) => {
    setCreating(false);
    setEditingId(row.id);
    setFormCategory(isKnownCategory(row.category) ? row.category : "Overig");
    setFormTitle(row.title);
    setFormBody(row.body);
    setFormActive(row.is_active);
    setFormSort(row.sort_order);
    setFormReferenceUrls(row.reference_image_urls ?? []);
    setError(null);
  };

  const uploadKnowledgeScreenshot = async (file: File) => {
    if (formReferenceUrls.length >= MAX_REFERENCE_IMAGES_PER_ROW) return;
    setImageUploadBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload/knowledge-screenshot", {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      const json = (await res.json()) as { ok?: boolean; error?: string; url?: string };
      if (!res.ok || !json.ok || !json.url) {
        setError(json.error ?? "Upload mislukt.");
        return;
      }
      setFormReferenceUrls((prev) =>
        [...prev, json.url!].slice(0, MAX_REFERENCE_IMAGES_PER_ROW),
      );
    } catch {
      setError("Netwerkfout bij upload.");
    } finally {
      setImageUploadBusy(false);
      if (screenshotInputRef.current) screenshotInputRef.current.value = "";
    }
  };

  const editingRow = editingId ? rows.find((r) => r.id === editingId) : undefined;
  const isJournalEdit = editingRow?.category === KNOWLEDGE_JOURNAL_CATEGORY;

  const showForm = creating || editingId !== null;

  useEffect(() => {
    if (!showForm) return;
    formSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    const t = window.setTimeout(() => titleInputRef.current?.focus(), 200);
    return () => window.clearTimeout(t);
  }, [showForm, creating, editingId]);

  const grouped = useMemo(() => {
    const buckets = new Map<string, AiKnowledgeRow[]>();
    for (const c of AI_KNOWLEDGE_CATEGORIES) buckets.set(c, []);
    for (const r of rows) {
      const key = isKnownCategory(r.category) ? r.category : "Overig";
      const list = buckets.get(key);
      if (list) list.push(r);
      else buckets.get("Overig")!.push(r);
    }
    return AI_KNOWLEDGE_CATEGORIES.map((c) => ({ category: c, items: buckets.get(c) ?? [] }));
  }, [rows]);

  const submitCreate = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/ai-knowledge", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: formCategory,
          title: formTitle.trim(),
          body: formBody.trim(),
          is_active: formActive,
          sort_order: formSort,
          reference_image_urls: formReferenceUrls,
        }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string; data?: AiKnowledgeRow };
      if (!res.ok || !json.ok || !json.data) {
        setError(json.error ?? "Opslaan mislukt.");
        return;
      }
      setRows((prev) => [...prev, json.data!].sort(compareRows));
      resetForm();
    } catch {
      setError("Netwerkfout bij opslaan.");
    } finally {
      setSaving(false);
    }
  };

  const submitUpdate = async () => {
    if (!editingId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/ai-knowledge/${editingId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: formCategory,
          title: formTitle.trim(),
          body: formBody.trim(),
          is_active: formActive,
          sort_order: formSort,
          reference_image_urls: formReferenceUrls,
        }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setError(json.error ?? "Bijwerken mislukt.");
        return;
      }
      setRows((prev) =>
        prev
          .map((r) =>
            r.id === editingId
              ? {
                  ...r,
                  category: formCategory,
                  title: formTitle.trim(),
                  body: formBody.trim(),
                  is_active: formActive,
                  sort_order: formSort,
                  reference_image_urls: [...formReferenceUrls],
                }
              : r,
          )
          .sort(compareRows),
      );
      resetForm();
    } catch {
      setError("Netwerkfout bij bijwerken.");
    } finally {
      setSaving(false);
    }
  };

  const removeRow = async (id: string) => {
    if (!window.confirm("Deze instructie permanent verwijderen?")) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/ai-knowledge/${id}`, { method: "DELETE", credentials: "include" });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setError(json.error ?? "Verwijderen mislukt.");
        return;
      }
      setRows((prev) => prev.filter((r) => r.id !== id));
      if (editingId === id) resetForm();
    } catch {
      setError("Netwerkfout bij verwijderen.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">AI-kennisbank</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            <strong>Actieve instructies</strong> (andere categorieën dan “Claude activiteit”) gaan als system-context mee
            naar Claude; optionele <strong>referentie-screenshots</strong> (high-end voorbeelden) worden als
            vision-input in hetzelfde verzoek meegegeven zodat het model compositie en stijl kan overnemen — niet
            1-op-1 klonen. Onder <strong>Claude activiteit</strong> verschijnen{" "}
            <strong>automatische logs</strong> na een geslaagde site-generatie, AI-editor-run of een site-chat die de
            HTML wijzigt: inactief, puur ter inzicht. Die logs worden <strong>nooit</strong> in de prompt gemerged, ook
            niet als je ze per ongeluk op actief zet. Uitzetten:{" "}
            <code className="rounded bg-zinc-200 px-1 text-xs dark:bg-zinc-800">CLAUDE_ACTIVITY_JOURNAL=false</code> in{" "}
            <code className="rounded bg-zinc-200 px-1 text-xs dark:bg-zinc-800">.env</code>.
          </p>
        </div>
        <button
          type="button"
          onClick={() => openCreate()}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-900 px-4 py-2 text-sm font-medium text-white hover:bg-blue-950 dark:bg-blue-700 dark:hover:bg-blue-600"
        >
          <Plus className="size-4" aria-hidden />
          Nieuwe instructie
        </button>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      ) : null}

      {showForm ? (
        <section
          ref={formSectionRef}
          className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
        >
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            {editingId ? "Instructie bewerken" : "Nieuwe instructie"}
          </h2>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Vul <strong className="font-medium text-zinc-600 dark:text-zinc-300">titel</strong> en{" "}
            <strong className="font-medium text-zinc-600 dark:text-zinc-300">inhoud</strong> in; daarna wordt{" "}
            {editingId ? "Opslaan" : "Toevoegen"} actief.
          </p>
          <div className="mt-4 grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1.5 text-sm">
                <span className="font-medium text-zinc-700 dark:text-zinc-300">Categorie</span>
                {isJournalEdit ? (
                  <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                    {formCategory}
                    <span className="mt-1 block text-xs font-normal text-zinc-500">
                      Categorie van logregels is vast; je kunt titel en inhoud wel aanpassen.
                    </span>
                  </div>
                ) : (
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as AiKnowledgeCategory)}
                    className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                  >
                    {AI_KNOWLEDGE_MANUAL_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                )}
              </label>
              <label className="grid gap-1.5 text-sm">
                <span className="font-medium text-zinc-700 dark:text-zinc-300">Sorteervolgorde</span>
                <input
                  type="number"
                  min={-999999999}
                  max={999999999}
                  value={formSort}
                  onChange={(e) => setFormSort(Number(e.target.value) || 0)}
                  className="rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                />
              </label>
            </div>
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium text-zinc-700 dark:text-zinc-300">Titel</span>
              <input
                ref={titleInputRef}
                type="text"
                maxLength={200}
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                placeholder="Korte naam voor deze regel"
              />
            </label>
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium text-zinc-700 dark:text-zinc-300">Inhoud (Markdown toegestaan)</span>
              <textarea
                value={formBody}
                onChange={(e) => setFormBody(e.target.value)}
                rows={12}
                className="font-mono text-sm leading-relaxed rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                placeholder="Beschrijf de instructie of les voor de AI…"
              />
            </label>
            <div className="grid gap-2 text-sm">
              <span className="font-medium text-zinc-700 dark:text-zinc-300">
                Referentie-screenshots (optioneel, max. {MAX_REFERENCE_IMAGES_PER_ROW})
              </span>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Upload schermafbeeldingen van sterke referentiesites. Claude ziet ze bij genereren, editor en
                site-chat; combineer met tekstuele regels in de inhoud hierboven.
              </p>
              <input
                ref={screenshotInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void uploadKnowledgeScreenshot(f);
                }}
              />
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={
                    imageUploadBusy ||
                    saving ||
                    formReferenceUrls.length >= MAX_REFERENCE_IMAGES_PER_ROW
                  }
                  onClick={() => screenshotInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-900"
                >
                  <ImagePlus className="size-3.5" aria-hidden />
                  {imageUploadBusy ? "Uploaden…" : "Screenshot toevoegen"}
                </button>
                <span className="text-xs text-zinc-500">
                  {formReferenceUrls.length}/{MAX_REFERENCE_IMAGES_PER_ROW} geplaatst
                </span>
              </div>
              {formReferenceUrls.length > 0 ? (
                <ul className="mt-1 flex flex-wrap gap-2">
                  {formReferenceUrls.map((url, idx) => (
                    <li
                      key={`${url}-${idx}`}
                      className="group relative overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="" className="h-20 w-32 object-cover object-top" />
                      <button
                        type="button"
                        title="Verwijderen"
                        onClick={() => setFormReferenceUrls((prev) => prev.filter((_, i) => i !== idx))}
                        className="absolute right-1 top-1 rounded bg-zinc-900/80 p-0.5 text-white opacity-0 transition group-hover:opacity-100"
                      >
                        <X className="size-3.5" aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
              <input
                type="checkbox"
                checked={formActive}
                onChange={(e) => setFormActive(e.target.checked)}
                className="size-4 rounded border-zinc-300"
              />
              Actief (meegeven aan Claude)
            </label>
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={saving || !formTitle.trim() || !formBody.trim()}
              onClick={() => (editingId ? submitUpdate() : submitCreate())}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
            >
              {saving ? "Bezig…" : editingId ? "Opslaan" : "Toevoegen"}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={resetForm}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-900"
            >
              Annuleren
            </button>
          </div>
        </section>
      ) : null}

      <div className="space-y-8">
        {grouped.map(({ category, items }) => (
          <section key={category} className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex flex-col gap-3 border-b border-zinc-200 bg-zinc-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800 dark:bg-zinc-900/80">
              <div className="min-w-0">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{category}</h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {items.length} {items.length === 1 ? "item" : "items"}
                {category === KNOWLEDGE_JOURNAL_CATEGORY ? (
                  <span className="mt-1 block text-amber-800 dark:text-amber-200/90">
                    Automatisch aangemaakt door een tweede, kleine Claude-call op basis van feiten (geen echte
                    geheugenbank).
                  </span>
                ) : null}
              </p>
              </div>
              {category !== KNOWLEDGE_JOURNAL_CATEGORY ? (
                <button
                  type="button"
                  onClick={() => openCreate(category as AiKnowledgeManualCategory)}
                  className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  <Plus className="size-3.5" aria-hidden />
                  Regel in deze categorie
                </button>
              ) : null}
            </div>
            {items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-zinc-500">Geen instructies in deze categorie.</p>
            ) : (
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {items.map((row) => (
                  <li key={row.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-medium text-zinc-900 dark:text-zinc-50">{row.title}</h3>
                        {!row.is_active ? (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-950/60 dark:text-amber-200">
                            Inactief
                          </span>
                        ) : null}
                        {row.auto_generated ? (
                          <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-900 dark:bg-violet-950/60 dark:text-violet-200">
                            Auto
                          </span>
                        ) : null}
                        {row.journal_source ? (
                          <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200">
                            {row.journal_source}
                          </span>
                        ) : null}
                        <span className="text-xs text-zinc-400">#{row.sort_order}</span>
                        {(row.reference_image_urls?.length ?? 0) > 0 ? (
                          <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-900 dark:bg-sky-950/60 dark:text-sky-200">
                            {row.reference_image_urls!.length} referentieafbeelding
                            {row.reference_image_urls!.length === 1 ? "" : "en"}
                          </span>
                        ) : null}
                      </div>
                      {(row.reference_image_urls?.length ?? 0) > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {row.reference_image_urls!.slice(0, 4).map((url) => (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              key={url}
                              src={url}
                              alt=""
                              className="h-12 w-20 rounded border border-zinc-200 object-cover object-top dark:border-zinc-700"
                            />
                          ))}
                        </div>
                      ) : null}
                      <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-zinc-50 p-3 font-mono text-xs text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                        {row.body}
                      </pre>
                    </div>
                    <div className="flex shrink-0 gap-2 sm:flex-col">
                      <button
                        type="button"
                        onClick={() => openEdit(row)}
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
                      >
                        <Pencil className="size-3.5" aria-hidden />
                        Bewerken
                      </button>
                      <button
                        type="button"
                        onClick={() => removeRow(row.id)}
                        disabled={saving}
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-800 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40"
                      >
                        <Trash2 className="size-3.5" aria-hidden />
                        Verwijderen
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>

    </div>
  );
}

function compareRows(a: AiKnowledgeRow, b: AiKnowledgeRow): number {
  const ca = a.category.localeCompare(b.category);
  if (ca !== 0) return ca;
  if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
  return a.title.localeCompare(b.title);
}

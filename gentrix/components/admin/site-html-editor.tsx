"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Eye,
  History,
  Loader2,
  Redo2,
  RefreshCw,
  Rocket,
  Save,
  Undo2,
} from "lucide-react";
import type { TailwindPageConfig, TailwindSection } from "@/lib/ai/tailwind-sections-schema";
import type { GeneratedLogoSet } from "@/types/logo";
import { SiteAiChatPanel } from "@/components/admin/site-ai-chat-panel";
import { SNAPSHOT_PAGE_TYPES, type SnapshotPageType } from "@/lib/site/snapshot-page-type";
import { TailwindSectionsPreview } from "@/components/site/tailwind-sections-preview";
import {
  createInitialSiteHistory,
  getCurrentSnapshot,
  siteHistoryReducer,
} from "@/lib/editor/site-history-reducer";
import { USER_SITE_CSS_MAX, USER_SITE_JS_MAX } from "@/lib/site/user-site-assets";
import { formatSlugForDisplay } from "@/lib/slug";
import { cn } from "@/lib/utils";

type SiteHtmlEditorProps = {
  subfolderSlug: string;
  initialName: string;
  initialDescription: string | null;
  initialStatus: "draft" | "active" | "paused" | "archived";
  initialSections: TailwindSection[];
  initialConfig: TailwindPageConfig | null | undefined;
  /** Zit in snapshot `composition.pageType` / wire `pageType`. */
  initialPageType?: SnapshotPageType;
  initialCustomCss?: string;
  initialCustomJs?: string;
  /** Bewaard bij opslaan (premium logo-pipeline). */
  initialLogoSet?: GeneratedLogoSet;
};

export function SiteHtmlEditor({
  subfolderSlug,
  initialName,
  initialDescription,
  initialStatus,
  initialSections,
  initialConfig,
  initialPageType,
  initialCustomCss = "",
  initialCustomJs = "",
  initialLogoSet,
}: SiteHtmlEditorProps) {
  const [hist, dispatch] = useReducer(
    siteHistoryReducer,
    undefined,
    () => createInitialSiteHistory(initialSections, initialConfig),
  );

  const snap = getCurrentSnapshot(hist);
  const sections = snap?.sections ?? [];
  const config = snap?.config;

  const [status, setStatus] = useState(initialStatus);
  const [activeIndex, setActiveIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [previewKey, setPreviewKey] = useState(0);
  const [codePanelOpen, setCodePanelOpen] = useState(false);
  const [stepsOpen, setStepsOpen] = useState(false);
  const [customCss, setCustomCss] = useState(() => initialCustomCss);
  const [customJs, setCustomJs] = useState(() => initialCustomJs);
  const [assetsPanelOpen, setAssetsPanelOpen] = useState(false);
  const [pageType, setPageType] = useState<SnapshotPageType>(initialPageType ?? "landing");
  const [publishing, setPublishing] = useState(false);
  const [publishMsg, setPublishMsg] = useState<string | null>(null);
  const snapshotSourceRef = useRef<"editor" | "ai_command">("editor");

  useEffect(() => {
    if (activeIndex >= sections.length) {
      setActiveIndex(Math.max(0, sections.length - 1));
    }
  }, [activeIndex, sections.length]);

  const active = sections[activeIndex];

  const updateActiveHtml = useCallback(
    (html: string) => {
      snapshotSourceRef.current = "editor";
      dispatch({ type: "patch-section-html", sectionIndex: activeIndex, html });
      setSaveMsg(null);
      setSaveError(null);
    },
    [activeIndex],
  );

  const updateActiveName = useCallback(
    (sectionName: string) => {
      snapshotSourceRef.current = "editor";
      dispatch({ type: "patch-section-name", sectionIndex: activeIndex, sectionName });
      setSaveMsg(null);
      setSaveError(null);
    },
    [activeIndex],
  );

  const payload = useMemo(
    () =>
      ({
        format: "tailwind_sections" as const,
        sections,
        pageType,
        ...(config ? { config } : {}),
        customCss,
        customJs,
        ...(initialLogoSet != null ? { logoSet: initialLogoSet } : {}),
      }) satisfies Record<string, unknown>,
    [sections, config, customCss, customJs, initialLogoSet, pageType],
  );

  const canUndo = hist.index > 0;
  const canRedo = hist.index < hist.entries.length - 1;

  const clientLabel = initialName.trim();
  const slugPretty = useMemo(() => formatSlugForDisplay(subfolderSlug), [subfolderSlug]);

  function undo() {
    if (!canUndo) return;
    dispatch({ type: "undo" });
    setSaveMsg(null);
    setSaveError(null);
    setPreviewKey((k) => k + 1);
  }

  function redo() {
    if (!canRedo) return;
    dispatch({ type: "redo" });
    setSaveMsg(null);
    setSaveError(null);
    setPreviewKey((k) => k + 1);
  }

  function jumpToStep(index: number) {
    dispatch({ type: "jump", index });
    setSaveMsg(null);
    setSaveError(null);
    setPreviewKey((k) => k + 1);
  }

  async function publishLive() {
    setPublishing(true);
    setSaveError(null);
    setPublishMsg(null);
    try {
      const res = await fetch(`/api/clients/${encodeURIComponent(subfolderSlug)}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setSaveError(data.error ?? "Publiceren mislukt.");
        return;
      }
      setPublishMsg("Live bijgewerkt met het huidige concept.");
    } catch {
      setSaveError("Netwerkfout bij publiceren.");
    } finally {
      setPublishing(false);
    }
  }

  async function save() {
    setSaving(true);
    setSaveError(null);
    setSaveMsg(null);
    setPublishMsg(null);
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: initialName,
          description: initialDescription,
          subfolder_slug: subfolderSlug,
          site_data_json: payload,
          status,
          snapshot_source: snapshotSourceRef.current,
        }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setSaveError(data.error ?? "Opslaan mislukt.");
        return;
      }
      snapshotSourceRef.current = "editor";
      setSaveMsg("Opgeslagen.");
      setPreviewKey((k) => k + 1);
    } catch {
      setSaveError("Netwerkfout.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={`/admin/clients/${encodeURIComponent(subfolderSlug)}`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Dossier
          </Link>
          <span className="text-zinc-300 dark:text-zinc-700">|</span>
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">HTML-editor</h1>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            {clientLabel ? (
              <>
                <span className="font-medium text-zinc-800 dark:text-zinc-200">{clientLabel}</span>
                <span className="text-zinc-400 dark:text-zinc-500" aria-hidden>
                  ·
                </span>
                <code
                  className="rounded bg-zinc-200 px-1.5 py-0.5 font-mono text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                  title="URL-slug (ongewijzigd in pad)"
                >
                  {subfolderSlug}
                </code>
              </>
            ) : (
              <>
                <span className="font-medium text-zinc-800 dark:text-zinc-200">{slugPretty}</span>
                <code
                  className="rounded bg-zinc-200 px-1.5 py-0.5 font-mono text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                  title="URL-slug"
                >
                  {subfolderSlug}
                </code>
              </>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!canUndo}
            onClick={undo}
            title="Vorige versie"
            className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 px-2.5 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            <Undo2 className="size-4" aria-hidden />
            Ongedaan
          </button>
          <button
            type="button"
            disabled={!canRedo}
            onClick={redo}
            title="Opnieuw"
            className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 px-2.5 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            <Redo2 className="size-4" aria-hidden />
            Opnieuw
          </button>
          <button
            type="button"
            onClick={() => setStepsOpen((o) => !o)}
            className={cn(
              "inline-flex items-center gap-1 rounded-lg border px-2.5 py-2 text-sm font-medium",
              stepsOpen
                ? "border-blue-800 bg-blue-50 text-blue-950 dark:border-blue-600 dark:bg-blue-950/40 dark:text-blue-100"
                : "border-zinc-300 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-900",
            )}
          >
            <History className="size-4" aria-hidden />
            Stappen ({hist.entries.length})
          </button>
          <label className="flex max-w-xs flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-400">
            <span>
              Klantstatus{" "}
              <span className="font-normal text-zinc-400 dark:text-zinc-500">
                (commercieel: /site/… alleen bij Actief)
              </span>
            </span>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as typeof status);
                setSaveMsg(null);
              }}
              className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-900"
            >
              <option value="draft">Concept</option>
              <option value="active">Actief</option>
              <option value="paused">Gepauzeerd</option>
              <option value="archived">Archief</option>
            </select>
          </label>
          <Link
            href={`/admin/clients/${encodeURIComponent(subfolderSlug)}/preview`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            <Eye className="size-4" aria-hidden />
            Concept-preview
          </Link>
          <Link
            href={`/admin/clients/${encodeURIComponent(subfolderSlug)}/snapshots`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            Snapshots
          </Link>
          <button
            type="button"
            onClick={() => setPreviewKey((k) => k + 1)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            <RefreshCw className="size-4" aria-hidden />
            Preview verversen
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-900 px-3 py-2 text-sm font-medium text-white hover:bg-blue-950 disabled:opacity-60 dark:bg-blue-800 dark:hover:bg-blue-900"
          >
            {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Save className="size-4" aria-hidden />}
            Concept opslaan
          </button>
          <button
            type="button"
            disabled={publishing || saving}
            onClick={() => void publishLive()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-800 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-900 disabled:opacity-60 dark:bg-emerald-700 dark:hover:bg-emerald-800"
            title="Zet live site op het huidige concept (published_snapshot_id)"
          >
            {publishing ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Rocket className="size-4" aria-hidden />
            )}
            Publiceren naar live
          </button>
        </div>
      </div>

      {stepsOpen && (
        <ol className="flex flex-wrap gap-2 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm dark:border-zinc-800 dark:bg-zinc-900/60">
          {hist.entries.map((e, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => jumpToStep(i)}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-left text-xs transition-colors",
                  i === hist.index
                    ? "border-blue-800 bg-blue-100 font-medium text-blue-950 dark:border-blue-600 dark:bg-blue-950/50 dark:text-blue-100"
                    : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-800",
                )}
              >
                <span className="font-mono text-[10px] text-zinc-500 dark:text-zinc-400">#{i + 1}</span>{" "}
                <span className="line-clamp-2 max-w-[200px]">{e.label}</span>
              </button>
            </li>
          ))}
        </ol>
      )}

      {saveError && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {saveError}
        </p>
      )}
      {saveMsg && (
        <p className="flex items-center gap-1.5 text-sm text-emerald-700 dark:text-emerald-400">
          <Check className="size-4" aria-hidden />
          {saveMsg}
        </p>
      )}
      {publishMsg && (
        <p className="flex items-center gap-1.5 text-sm text-emerald-800 dark:text-emerald-300">
          <Rocket className="size-4" aria-hidden />
          {publishMsg}
        </p>
      )}

      <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row lg:items-stretch">
        <aside className="flex w-full min-h-0 flex-col gap-2 lg:max-w-[min(100%,440px)] lg:flex-shrink-0">
          <div className="rounded-lg border border-zinc-200 bg-zinc-50/90 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900/50">
            <label htmlFor="page-type-select" className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Paginatype (opslag)
            </label>
            <select
              id="page-type-select"
              value={pageType}
              onChange={(e) => {
                setPageType(e.target.value as SnapshotPageType);
                setSaveMsg(null);
                snapshotSourceRef.current = "editor";
              }}
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-950"
            >
              {SNAPSHOT_PAGE_TYPES.map((pt) => (
                <option key={pt} value={pt}>
                  {pt === "landing"
                    ? "Landing / marketing"
                    : pt === "legal"
                      ? "Juridisch / policy"
                      : pt === "article"
                        ? "Artikel / longread"
                        : "Overig"}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
              Wordt mee opgeslagen in site-data; helpt bij context voor AI en kwaliteitschecks.
            </p>
          </div>
          <SiteAiChatPanel
            className="min-h-[min(520px,55vh)] flex-1 lg:min-h-0"
            subfolderSlug={subfolderSlug}
            sections={sections}
            config={config}
            disabled={sections.length === 0}
            onApplyAi={({ sections: nextSections, config: nextConfig, label }) => {
              snapshotSourceRef.current = "ai_command";
              dispatch({
                type: "push-ai",
                sections: nextSections,
                config: nextConfig,
                label,
              });
              setSaveMsg(null);
              setSaveError(null);
              setPreviewKey((k) => k + 1);
            }}
          />
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
          <div className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-zinc-50/80 p-3 dark:border-zinc-800 dark:bg-zinc-900/40 sm:flex-row sm:flex-wrap sm:items-end sm:gap-3">
          <div className="min-w-0 flex-1 sm:max-w-xs">
            <label htmlFor="section-select" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Sectie
            </label>
            <select
              id="section-select"
              value={activeIndex}
              onChange={(e) => setActiveIndex(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium dark:border-zinc-600 dark:bg-zinc-950"
            >
              {sections.map((s, i) => (
                <option key={i} value={i}>
                  {s.sectionName || `Sectie ${i + 1}`}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            aria-expanded={codePanelOpen}
            aria-controls="html-source-panel"
            onClick={() => setCodePanelOpen((o) => !o)}
            className={cn(
              "inline-flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium sm:w-auto",
              codePanelOpen
                ? "border-blue-800 bg-blue-50 text-blue-950 dark:border-blue-600 dark:bg-blue-950/50 dark:text-blue-100"
                : "border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900",
            )}
          >
            <ChevronDown
              className={cn("size-4 shrink-0 transition-transform", codePanelOpen && "rotate-180")}
              aria-hidden
            />
            {codePanelOpen ? "Verberg HTML-broncode" : "Toon HTML-broncode"}
          </button>
          </div>

          <div
            id="html-source-panel"
            hidden={!codePanelOpen}
            className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
          >
          <div className="border-b border-zinc-200 p-3 dark:border-zinc-800">
            <label htmlFor="section-label" className="block text-xs font-medium text-zinc-500">
              Sectienaam (label)
            </label>
            <input
              id="section-label"
              type="text"
              value={active?.sectionName ?? ""}
              onChange={(e) => updateActiveName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 font-mono text-sm dark:border-zinc-600 dark:bg-zinc-900"
            />
          </div>
          <label htmlFor="html-editor" className="sr-only">
            HTML fragment
          </label>
          <textarea
            id="html-editor"
            value={active?.html ?? ""}
            onChange={(e) => updateActiveHtml(e.target.value)}
            spellCheck={false}
            className={cn(
              "min-h-[240px] w-full resize-y border-0 bg-zinc-50 p-4 font-mono text-xs leading-relaxed text-zinc-900",
              "focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-800/30 dark:bg-zinc-950 dark:text-zinc-100 sm:min-h-[320px]",
            )}
            autoComplete="off"
          />
            <p className="border-t border-zinc-200 px-3 py-2 text-xs text-zinc-500 dark:border-zinc-800">
              Tailwind utility-classes; wijzigingen horen bij de huidige stap in <strong>Stappen</strong>. Het thema (
              <code>config</code>) kan Claude in de chat wijzigen (master-formaat). Daarna <strong>Opslaan</strong> naar
              Supabase.
            </p>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 dark:border-zinc-800 dark:bg-zinc-900/40">
            <button
              type="button"
              aria-expanded={assetsPanelOpen}
              onClick={() => setAssetsPanelOpen((o) => !o)}
              className={cn(
                "flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm font-medium",
                assetsPanelOpen
                  ? "text-blue-950 dark:text-blue-100"
                  : "text-zinc-700 dark:text-zinc-300",
              )}
            >
              <span>Eigen CSS &amp; JavaScript</span>
              <ChevronDown
                className={cn("size-4 shrink-0 transition-transform", assetsPanelOpen && "rotate-180")}
                aria-hidden
              />
            </button>
            {assetsPanelOpen && (
              <div className="space-y-3 border-t border-zinc-200 px-3 pb-3 pt-2 dark:border-zinc-800">
              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                Preview draait in een <strong>sandboxed iframe</strong> (geen same-origin). Op de <strong>live site</strong>{" "}
                draait JavaScript wel op jouw domein — alleen code gebruiken die je vertrouwt.{" "}
                <code>@import</code> in CSS wordt verwijderd; <code>&lt;script&gt;</code> hoort niet in deze velden (
                gebruik het JS-veld).
              </p>
              <div>
                <label htmlFor="custom-css" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  Custom CSS (max. {USER_SITE_CSS_MAX.toLocaleString("nl-NL")} tekens)
                </label>
                <textarea
                  id="custom-css"
                  value={customCss}
                  onChange={(e) => {
                    setCustomCss(e.target.value.slice(0, USER_SITE_CSS_MAX));
                    setSaveMsg(null);
                    setSaveError(null);
                  }}
                  spellCheck={false}
                  rows={5}
                  className="mt-1 w-full resize-y rounded-lg border border-zinc-300 bg-white p-2 font-mono text-xs dark:border-zinc-600 dark:bg-zinc-950"
                  autoComplete="off"
                />
              </div>
              <div>
                <label htmlFor="custom-js" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  Custom JavaScript (max. {USER_SITE_JS_MAX.toLocaleString("nl-NL")} tekens)
                </label>
                <textarea
                  id="custom-js"
                  value={customJs}
                  onChange={(e) => {
                    setCustomJs(e.target.value.slice(0, USER_SITE_JS_MAX));
                    setSaveMsg(null);
                    setSaveError(null);
                  }}
                  spellCheck={false}
                  rows={6}
                  className="mt-1 w-full resize-y rounded-lg border border-zinc-300 bg-white p-2 font-mono text-xs dark:border-zinc-600 dark:bg-zinc-950"
                  autoComplete="off"
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="border-b border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
            Live preview
          </div>
          <TailwindSectionsPreview
            key={previewKey}
            sections={sections}
            pageConfig={config}
            userCss={customCss}
            userJs={customJs}
            logoSet={initialLogoSet}
            publishedSlug={subfolderSlug}
            title={`Preview ${subfolderSlug}`}
            className="min-h-0 flex-1 rounded-none border-0 bg-white"
            frameClassName="min-h-[min(85vh,920px)] w-full flex-1 sm:min-h-[calc(100vh-11rem)]"
            autoResizeFromPostMessage
          />
        </div>
        </div>
      </div>
    </div>
  );
}

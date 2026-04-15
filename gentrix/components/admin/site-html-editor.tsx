"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  ExternalLink,
  Eye,
  History,
  Loader2,
  Maximize2,
  Minimize2,
  Monitor,
  PanelTop,
  Redo2,
  RefreshCw,
  Rocket,
  Save,
  Smartphone,
  Undo2,
} from "lucide-react";
import {
  slugifyToSectionId,
  type TailwindPageConfig,
  type TailwindSection,
} from "@/lib/ai/tailwind-sections-schema";
import type { GeneratedLogoSet } from "@/types/logo";
import { ResizableEditorPanels } from "@/components/admin/resizable-editor-panels";
import { SiteAiChatPanel } from "@/components/admin/site-ai-chat-panel";
import type { SnapshotPageType } from "@/lib/site/snapshot-page-type";
import { TailwindSectionsPreview } from "@/components/site/tailwind-sections-preview";
import type { ComposePublicMarketingPlan } from "@/lib/site/public-site-composition";
import type { SiteIrV1 } from "@/lib/site/site-ir-schema";
import {
  createInitialSiteHistory,
  getCurrentSnapshot,
  siteHistoryReducer,
} from "@/lib/editor/site-history-reducer";
import { formatSlugForDisplay, isValidSubfolderSlug } from "@/lib/slug";
import { buildStudioSiteOpenPreviewUrl } from "@/lib/site/build-studio-site-open-preview-url";
import { cn } from "@/lib/utils";

/** Debounce na laatste wijziging (undo/AI/…) voordat concept naar Supabase gaat — vergelijkbaar met Lovable. */
const AUTOSAVE_DEBOUNCE_MS = 2500;

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
  /** Klantmodules: preview en site-chat houden rekening met live `/site`-gedrag. */
  appointmentsEnabled?: boolean;
  webshopEnabled?: boolean;
  /** Uit concept-snapshot: compose-preview + optioneel opnieuw meesturen bij POST. */
  initialSiteIr?: SiteIrV1 | null;
  /** Alleen concept: iframe-nav zet `?token=` op `/site/…`-links (zelfde als publieke concept-URL). */
  draftPublicPreviewToken?: string | null;
  /** Gecompileerde Tailwind uit snapshot — preview zonder Play CDN als aanwezig. */
  initialTailwindCompiledCss?: string | null;
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
  appointmentsEnabled = true,
  webshopEnabled = true,
  initialSiteIr = null,
  draftPublicPreviewToken = null,
  initialTailwindCompiledCss = null,
}: SiteHtmlEditorProps) {
  const [hist, dispatch] = useReducer(
    siteHistoryReducer,
    undefined,
    () => createInitialSiteHistory(initialSections, initialConfig),
  );

  const snap = getCurrentSnapshot(hist);
  const sections = useMemo(() => snap?.sections ?? [], [snap]);
  const config = snap?.config;

  const [status, setStatus] = useState(initialStatus);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [previewFullscreen, setPreviewFullscreen] = useState(false);
  /** Na concept-opslag: waar je de opgeslagen site volledig kunt bekijken (los van de editor-preview). */
  const [postSaveDraftView, setPostSaveDraftView] = useState<{ clientPreviewTokenUrl: string | null } | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [autoSaveHint, setAutoSaveHint] = useState<string | null>(null);
  const [autoSaveError, setAutoSaveError] = useState<string | null>(null);
  const [autoSaving, setAutoSaving] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);
  /** Live preview: iframe-viewport (zie `TailwindSectionsPreview.viewportMode`). */
  const [previewViewportMode, setPreviewViewportMode] = useState<"auto" | "mobile" | "desktop">("auto");
  const [stepsOpen, setStepsOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishMsg, setPublishMsg] = useState<string | null>(null);
  const [publishErr, setPublishErr] = useState<string | null>(null);
  const customCss = initialCustomCss;
  const customJs = initialCustomJs;
  const [pageType] = useState<SnapshotPageType>(initialPageType ?? "landing");
  const snapshotSourceRef = useRef<"editor" | "ai_command">("editor");
  const lastSavedFingerprintRef = useRef("");
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persistInFlightRef = useRef(false);

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

  const persistFingerprint = useMemo(() => JSON.stringify({ p: payload, status }), [payload, status]);

  const composePlan: ComposePublicMarketingPlan | null = useMemo(() => {
    const sectionIdsOrdered = sections.map((s, i) => s.id ?? slugifyToSectionId(s.sectionName, i));
    if (initialSiteIr != null) {
      return { siteIr: { ...initialSiteIr, sectionIdsOrdered } };
    }
    return { sectionIdsOrdered };
  }, [sections, initialSiteIr]);

  const canUndo = hist.index > 0;
  const canRedo = hist.index < hist.entries.length - 1;

  const clientLabel = initialName.trim();
  const slugPretty = useMemo(() => formatSlugForDisplay(subfolderSlug), [subfolderSlug]);

  function undo() {
    if (!canUndo) return;
    dispatch({ type: "undo" });
    setSaveMsg(null);
    setSaveError(null);
    setAutoSaveError(null);
    setPreviewKey((k) => k + 1);
  }

  function redo() {
    if (!canRedo) return;
    dispatch({ type: "redo" });
    setSaveMsg(null);
    setSaveError(null);
    setAutoSaveError(null);
    setPreviewKey((k) => k + 1);
  }

  function jumpToStep(index: number) {
    dispatch({ type: "jump", index });
    setSaveMsg(null);
    setSaveError(null);
    setAutoSaveError(null);
    setPreviewKey((k) => k + 1);
  }

  const persistDraft = useCallback(
    async (opts: { silent: boolean; auto?: boolean }) => {
      if (opts.auto && persistInFlightRef.current) return;

      if (autoSaveTimerRef.current && !opts.auto) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }

      const fingerprintAtRun = JSON.stringify({ p: payload, status });
      if (opts.auto && fingerprintAtRun === lastSavedFingerprintRef.current) return;

      if (!opts.silent && persistInFlightRef.current) {
        const t0 = Date.now();
        while (persistInFlightRef.current && Date.now() - t0 < 30_000) {
          await new Promise((r) => setTimeout(r, 50));
        }
        if (persistInFlightRef.current) {
          setSaveError("Er wordt nog opgeslagen — even wachten en opnieuw proberen.");
          return;
        }
      }

      persistInFlightRef.current = true;
      if (opts.silent) setAutoSaving(true);
      else {
        setSaving(true);
        setSaveError(null);
        setSaveMsg(null);
        setPostSaveDraftView(null);
        setAutoSaveError(null);
        setAutoSaveHint(null);
      }

      try {
        const body: Record<string, unknown> = {
          name: initialName,
          description: initialDescription,
          subfolder_slug: subfolderSlug,
          site_data_json: payload,
          status,
          snapshot_source: snapshotSourceRef.current,
          ...(opts.auto
            ? {
                snapshot_label: "Auto-save",
                snapshot_notes: "Automatisch concept (studio)",
              }
            : {}),
          ...(initialSiteIr?.detectedIndustryId != null || initialSiteIr?.blueprintId != null
            ? {
                site_ir_hints: {
                  ...(initialSiteIr.detectedIndustryId != null && initialSiteIr.detectedIndustryId !== ""
                    ? { detected_industry_id: initialSiteIr.detectedIndustryId }
                    : {}),
                  ...(initialSiteIr.blueprintId != null && initialSiteIr.blueprintId !== ""
                    ? { blueprint_id: initialSiteIr.blueprintId }
                    : {}),
                },
              }
            : {}),
        };

        const res = await fetch("/api/clients", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = (await res.json()) as {
          ok: boolean;
          error?: string;
          data?: { preview_url?: string | null; status?: string };
        };
        if (!res.ok || !data.ok) {
          if (opts.silent) {
            setAutoSaveError(data.error ?? "Automatisch opslaan mislukt.");
            setAutoSaveHint(null);
          } else {
            setSaveError(data.error ?? "Opslaan mislukt.");
          }
          return;
        }

        lastSavedFingerprintRef.current = fingerprintAtRun;
        snapshotSourceRef.current = "editor";

        if (opts.silent) {
          setAutoSaveError(null);
          setAutoSaveHint(
            `Automatisch opgeslagen · ${new Date().toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`,
          );
        } else if (status === "draft") {
          setSaveMsg("Concept opgeslagen — volledige site staat in de database (werkversie / draft).");
          setPostSaveDraftView({
            clientPreviewTokenUrl:
              typeof data.data?.preview_url === "string" && data.data.preview_url.length > 0
                ? data.data.preview_url
                : null,
          });
        } else {
          setSaveMsg("Opgeslagen.");
          setPostSaveDraftView(null);
        }
        setPreviewKey((k) => k + 1);
      } catch {
        if (opts.silent) {
          setAutoSaveError("Netwerkfout bij automatisch opslaan.");
          setAutoSaveHint(null);
        } else {
          setSaveError("Netwerkfout.");
        }
      } finally {
        persistInFlightRef.current = false;
        if (opts.silent) setAutoSaving(false);
        else setSaving(false);
      }
    },
    [payload, status, initialName, initialDescription, subfolderSlug, initialSiteIr],
  );

  useEffect(() => {
    if (lastSavedFingerprintRef.current === "") {
      lastSavedFingerprintRef.current = persistFingerprint;
      return;
    }
    if (persistFingerprint === lastSavedFingerprintRef.current) return;
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    autoSaveTimerRef.current = setTimeout(() => {
      autoSaveTimerRef.current = null;
      void persistDraft({ silent: true, auto: true });
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
    };
  }, [persistFingerprint, persistDraft]);

  const canOpenSitePreviewTab = isValidSubfolderSlug(subfolderSlug);

  const openSitePreviewInNewTab = useCallback(() => {
    if (!isValidSubfolderSlug(subfolderSlug)) return;
    const href = buildStudioSiteOpenPreviewUrl(window.location.origin, subfolderSlug, draftPublicPreviewToken);
    window.open(href, "_blank", "noopener,noreferrer");
  }, [subfolderSlug, draftPublicPreviewToken]);

  useEffect(() => {
    if (!previewFullscreen) return;
    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") setPreviewFullscreen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [previewFullscreen]);

  async function save() {
    await persistDraft({ silent: false });
  }

  const publishLive = useCallback(async () => {
    setPublishErr(null);
    setPublishMsg(null);
    if (persistFingerprint !== lastSavedFingerprintRef.current) {
      await persistDraft({ silent: true });
      if (persistFingerprint !== lastSavedFingerprintRef.current) {
        setPublishErr("Kon het concept niet opslaan — probeer opnieuw of gebruik Concept opslaan.");
        return;
      }
    }
    setPublishing(true);
    try {
      const res = await fetch(`/api/clients/${encodeURIComponent(subfolderSlug)}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        data?: { visibility_hint?: string | null; is_publicly_visible?: boolean };
      };
      if (!res.ok || !json.ok) {
        setPublishErr(json.error ?? "Publiceren mislukt.");
        return;
      }
      setPublishMsg(
        json.data?.visibility_hint ??
          (json.data?.is_publicly_visible === false
            ? "Live-inhoud bijgewerkt. Publieke /site/… volgt zodra de klantstatus Actief is."
            : "Live-inhoud bijgewerkt — bezoekers zien deze snapshot op de publieke site."),
      );
      setPreviewKey((k) => k + 1);
    } catch {
      setPublishErr("Netwerkfout bij publiceren.");
    } finally {
      setPublishing(false);
    }
  }, [persistFingerprint, persistDraft, subfolderSlug]);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-white dark:bg-zinc-900">
      <div className="shrink-0 space-y-3 border-b border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900 md:px-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={`/admin/clients/${encodeURIComponent(subfolderSlug)}`}
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 shadow-sm hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900"
            aria-label="Editor verlaten, terug naar klantdossier"
          >
            <ArrowLeft className="size-4 shrink-0" aria-hidden />
            Terug naar dossier
          </Link>
          <Link
            href={`/admin/clients/${encodeURIComponent(subfolderSlug)}/flyer`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            Flyer & QR
          </Link>
          <span className="hidden text-zinc-300 sm:inline dark:text-zinc-700" aria-hidden>
            |
          </span>
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
                setPostSaveDraftView(null);
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
            disabled={saving || autoSaving || publishing}
            onClick={() => void save()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-900 px-3 py-2 text-sm font-medium text-white hover:bg-blue-950 disabled:opacity-60 dark:bg-blue-800 dark:hover:bg-blue-900"
          >
            {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Save className="size-4" aria-hidden />}
            Concept opslaan
          </button>
          <button
            type="button"
            disabled={saving || autoSaving || publishing}
            onClick={() => void publishLive()}
            title="Zet de huidige concept-snapshot live op /site/… (zelfde als klantportaal)"
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-700 bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60 dark:border-emerald-600 dark:bg-emerald-700 dark:hover:bg-emerald-600"
          >
            {publishing ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Rocket className="size-4" aria-hidden />
            )}
            Live zetten
          </button>
        </div>
        <p className="text-[11px] leading-snug text-zinc-500 dark:text-zinc-400">
          Wijzigingen worden na {AUTOSAVE_DEBOUNCE_MS / 1000} s stilte automatisch als concept opgeslagen (zoals Lovable).
          Handmatig opslaan blijft mogelijk; snapshots tonen label <span className="font-mono">Auto-save</span>.{" "}
          <strong className="font-medium text-zinc-600 dark:text-zinc-300">Live zetten</strong> publiceert het concept
          naar de publieke site (los van concept opslaan).
        </p>
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

      {(autoSaving || autoSaveHint || autoSaveError) && (
        <div className="flex flex-wrap items-center gap-2 px-4 text-[11px] md:px-5">
          {autoSaving ? (
            <span className="inline-flex items-center gap-1 text-zinc-500 dark:text-zinc-400">
              <Loader2 className="size-3 animate-spin" aria-hidden />
              Automatisch opslaan…
            </span>
          ) : null}
          {autoSaveHint ? (
            <span className="text-emerald-700 dark:text-emerald-400" role="status">
              {autoSaveHint}
            </span>
          ) : null}
          {autoSaveError ? (
            <span className="text-red-600 dark:text-red-400" role="alert">
              {autoSaveError}
            </span>
          ) : null}
        </div>
      )}
      {publishErr ? (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {publishErr}
        </p>
      ) : null}
      {publishMsg ? (
        <p className="text-sm text-emerald-800 dark:text-emerald-200" role="status">
          {publishMsg}
        </p>
      ) : null}
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
      {postSaveDraftView && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/95 px-3 py-2.5 text-sm text-emerald-950 dark:border-emerald-900/50 dark:bg-emerald-950/35 dark:text-emerald-50">
          <p className="font-medium text-emerald-950 dark:text-emerald-100">Volledige pagina bekijken (concept)</p>
          <ul className="mt-2 space-y-2 text-xs leading-relaxed text-emerald-900 dark:text-emerald-100/95">
            <li>
              <strong>Admin</strong> — zelfde werkversie als in de editor:{" "}
              <Link
                href={`/admin/clients/${encodeURIComponent(subfolderSlug)}/preview`}
                className="font-medium underline underline-offset-2 hover:text-emerald-950 dark:hover:text-white"
              >
                Concept-preview openen
              </Link>
              .
            </li>
            {postSaveDraftView.clientPreviewTokenUrl ? (
              <li>
                <strong>Deel met klant</strong> (niet geïndexeerd, met token):{" "}
                <a
                  href={postSaveDraftView.clientPreviewTokenUrl}
                  className="font-medium break-all underline underline-offset-2 hover:text-emerald-950 dark:hover:text-white"
                >
                  {postSaveDraftView.clientPreviewTokenUrl}
                </a>
              </li>
            ) : (
              <li className="text-emerald-800/90 dark:text-emerald-200/85">
                Geen publieke token-link (controleer of <code className="rounded bg-emerald-200/60 px-1 font-mono text-[11px] dark:bg-emerald-900/60">preview_secret</code>{" "}
                in Supabase staat voor deze klant).
              </li>
            )}
          </ul>
          <p className="mt-2 text-[11px] text-emerald-800/90 dark:text-emerald-200/85">
            Openbare <code className="rounded bg-emerald-200/50 px-1 font-mono dark:bg-emerald-900/50">/site/…</code> voor
            iedereen blijft uit zolang de klantstatus <strong>Concept</strong> is.
          </p>
        </div>
      )}
      </div>

      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col",
          previewFullscreen &&
            "fixed inset-0 z-[1000] gap-0 overflow-hidden bg-zinc-100 p-2 shadow-2xl dark:bg-zinc-950 sm:p-3",
        )}
      >
      <ResizableEditorPanels
        className={cn("min-h-0 flex-1", previewFullscreen && "min-h-0 overflow-hidden")}
        defaultSidebarPx={400}
        minSidebarPx={280}
        maxSidebarPx={560}
        minMainPx={520}
        sidebar={
          <>
            <SiteAiChatPanel
              className="flex min-h-[min(420px,50dvh)] flex-1 flex-col min-h-0 lg:min-h-0"
              subfolderSlug={subfolderSlug}
              sections={sections}
              config={config}
              appointmentsEnabled={appointmentsEnabled}
              webshopEnabled={webshopEnabled}
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
          </>
        }
        main={
          <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
            <div
              className={cn(
                "flex min-h-0 min-w-0 flex-1 flex-col rounded-xl border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 lg:min-h-[200px]",
                previewFullscreen && "lg:min-h-0",
              )}
            >
              <div className="sticky top-0 z-[1] shrink-0 border-b border-zinc-200 bg-zinc-100 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Live preview</span>
                    <div
                      className="inline-flex rounded-lg border border-zinc-300 bg-zinc-50 p-0.5 dark:border-zinc-600 dark:bg-zinc-900/80"
                      role="group"
                      aria-label="Weergave preview"
                    >
                      <button
                        type="button"
                        onClick={() => setPreviewViewportMode("auto")}
                        title="Automatisch: mobiel of desktop volgens je browservenster"
                        className={cn(
                          "inline-flex size-8 items-center justify-center rounded-md transition-colors",
                          previewViewportMode === "auto"
                            ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-50"
                            : "text-zinc-500 hover:bg-zinc-200/80 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100",
                        )}
                      >
                        <PanelTop className="size-4 shrink-0" aria-hidden />
                        <span className="sr-only">Automatisch</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewViewportMode("mobile")}
                        title="Mobiele weergave (smalle viewport)"
                        className={cn(
                          "inline-flex size-8 items-center justify-center rounded-md transition-colors",
                          previewViewportMode === "mobile"
                            ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-50"
                            : "text-zinc-500 hover:bg-zinc-200/80 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100",
                        )}
                      >
                        <Smartphone className="size-4 shrink-0" aria-hidden />
                        <span className="sr-only">Mobiel</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewViewportMode("desktop")}
                        title="Desktopweergave (brede layout in preview)"
                        className={cn(
                          "inline-flex size-8 items-center justify-center rounded-md transition-colors",
                          previewViewportMode === "desktop"
                            ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-50"
                            : "text-zinc-500 hover:bg-zinc-200/80 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100",
                        )}
                      >
                        <Monitor className="size-4 shrink-0" aria-hidden />
                        <span className="sr-only">Desktop</span>
                      </button>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={openSitePreviewInNewTab}
                      disabled={!canOpenSitePreviewTab}
                      title={
                        canOpenSitePreviewTab
                          ? "Open de site in een nieuw tabblad (/site/…)"
                          : "Ongeldige slug — kan /site niet openen"
                      }
                      className="inline-flex size-8 items-center justify-center rounded-lg text-zinc-600 transition-colors hover:bg-zinc-200/90 hover:text-zinc-900 disabled:pointer-events-none disabled:opacity-35 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                    >
                      <ExternalLink className="size-4 shrink-0" aria-hidden />
                      <span className="sr-only">Open preview in nieuw tabblad</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewFullscreen((v) => !v)}
                      title={previewFullscreen ? "Volledig scherm sluiten (Esc)" : "Volledig scherm"}
                      className="inline-flex size-8 items-center justify-center rounded-lg text-zinc-600 transition-colors hover:bg-zinc-200/90 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                    >
                      {previewFullscreen ? (
                        <Minimize2 className="size-4 shrink-0" aria-hidden />
                      ) : (
                        <Maximize2 className="size-4 shrink-0" aria-hidden />
                      )}
                      <span className="sr-only">
                        {previewFullscreen ? "Volledig scherm sluiten" : "Volledig scherm"}
                      </span>
                    </button>
                  </div>
                </div>
                <p className="mt-1.5 max-w-[56rem] text-[10px] leading-snug text-zinc-500 dark:text-zinc-400">
                  Preview toont je <strong>werkversie</strong>. Openbare{" "}
                  <code className="rounded bg-zinc-200/80 px-1 font-mono text-[9px] dark:bg-zinc-800/80">/site/…</code> zonder
                  token = <strong>gepubliceerde</strong> snapshot (niet automatisch het laatste concept). Desktop: bij een smalle
                  kolom <strong>horizontaal scrollen</strong> — de preview is 1280px breed zodat{" "}
                  <code className="font-mono text-[9px]">lg:</code>-nav klopt.
                </p>
              </div>
              <div className="min-h-0 flex-1 overflow-hidden overscroll-contain">
                <TailwindSectionsPreview
                  key={`${previewKey}-${previewViewportMode}`}
                  sections={sections}
                  pageConfig={config}
                  userCss={customCss}
                  userJs={customJs}
                  logoSet={initialLogoSet}
                  publishedSlug={subfolderSlug}
                  draftPublicPreviewToken={draftPublicPreviewToken}
                  appointmentsEnabled={appointmentsEnabled}
                  webshopEnabled={webshopEnabled}
                  composePlan={composePlan}
                  viewportMode={previewViewportMode}
                  compiledTailwindCss={initialTailwindCompiledCss}
                  title={`Preview ${subfolderSlug}`}
                  className="h-full min-h-0 w-full rounded-none border-0 bg-white"
                  frameClassName="h-full min-h-[280px] w-full"
                  autoResizeFromPostMessage
                  documentHeightMode="panel"
                  maxMeasuredHeight={3200}
                />
              </div>
            </div>
          </div>
        }
      />
      </div>
    </div>
  );
}

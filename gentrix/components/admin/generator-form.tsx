"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertCircle,
  ArrowLeft,
  Code2,
  Columns2,
  ExternalLink,
  ImagePlus,
  Loader2,
  Maximize2,
  Minimize2,
  Monitor,
  PanelLeft,
  PanelRight,
  Send,
  X,
} from "lucide-react";
import { StudioThemeStylesHint } from "@/components/admin/studio-theme-styles-hint";
import { DutchSpellcheckPanel } from "@/components/admin/dutch-spellcheck-panel";
import { GenerationDetailsBody } from "@/components/admin/generation-details-body";
import {
  GenerationFeedbackPanel,
  type StudioRightPaneMode,
} from "@/components/admin/generation-feedback-panel";
import { GeneratorStudioFaqLauncher } from "@/components/admin/generator-studio-faq-launcher";
import { SaveSitePanel } from "@/components/admin/save-site-panel";
import { ResizableEditorPanels } from "@/components/admin/resizable-editor-panels";
import { PublishedSiteView } from "@/components/site/published-site-view";
import { STUDIO_GENERATION_PACKAGE } from "@/lib/ai/generation-packages";
import { postProcessTailwindSectionsForStreamingPreview } from "@/lib/ai/generate-site-postprocess";
import {
  slugifyToSectionId,
  type GeneratedTailwindPage,
  type MasterPromptPageConfig,
  type TailwindPageConfig,
  type TailwindSection,
} from "@/lib/ai/tailwind-sections-schema";
import {
  tryExtractStreamingTailwindConfig,
} from "@/lib/ai/stream-json-section-extractor";
import { publishedPayloadFromParsed, type PublishedSitePayload } from "@/lib/site/project-published-payload";
import { tailwindSectionsPayloadFromPublishedTailwind } from "@/lib/data/tailwind-sections-payload-from-published";
import { buildSiteIrV1 } from "@/lib/site/site-ir-schema";
import { consumeGenerateSiteNdjsonBuffer } from "@/lib/api/generate-site-stream-events";
import type { DesignGenerationContract } from "@/lib/ai/design-generation-contract";
import {
  buildConceptRefinementInstruction,
  type ConceptRefinementDirection,
} from "@/lib/ai/concept-refinement-instructions";
import type { GenerateSiteStreamNdjsonEvent } from "@/lib/ai/generate-site-with-claude";
import type { GenerationPipelineFeedback } from "@/lib/api/generation-pipeline-feedback";
import { isValidSubfolderSlug } from "@/lib/slug";
import { buildStudioSiteOpenPreviewUrl } from "@/lib/site/build-studio-site-open-preview-url";
import { cn } from "@/lib/utils";

type StudioPanelLayout = "split" | "editor" | "preview";

/** `true` = oude NDJSON-stream naar de browser; default = server-job + polling (stabieler bij lange runs). */
const USE_LEGACY_NDJSON_STREAM = process.env.NEXT_PUBLIC_SITE_GENERATION_USE_STREAM === "true";

type ApiOk = { ok: true; outputFormat: "tailwind_sections"; data: GeneratedTailwindPage };
type ApiErr = { ok: false; error: string; rawText?: string };

const SITE_GENERATION_JOBS_MIGRATION_ERROR_RE = /site_generation_jobs|generatie-job aanmaken/i;

type GeneratorFormProps = {
  initialSubfolderSlug?: string;
  initialClientName?: string;
  initialClientDescription?: string | null;
  /** True als er al concept-site JSON in de DB staat (briefing lock). */
  existingDraftLocked?: boolean;
  /** Na geslaagde opslag vanuit SaveSitePanel (bijv. studio-workspace → terug naar bewerken). */
  onSiteSaved?: () => void;
  /** Concept: zelfde `?token=` als iframe voor `/site/…` in nieuw tabblad. */
  draftPublicPreviewToken?: string | null;
  /**
   * Zelfde schakels als `getPublishedSiteBySlug` → `/site/[slug]` (WYSIWYS-preview).
   * Default false i.p.v. PublishedSiteView-defaults, zodat studio = live bij ontbrekende DB-waarden.
   */
  appointmentsEnabled?: boolean;
  webshopEnabled?: boolean;
  /** True in Site-studio workspace: FAQ zit in de header, niet dubbel in het formulier. */
  hideFaqLauncher?: boolean;
};

export function GeneratorForm({
  initialSubfolderSlug,
  initialClientName,
  initialClientDescription,
  existingDraftLocked = false,
  onSiteSaved,
  draftPublicPreviewToken = null,
  appointmentsEnabled = false,
  webshopEnabled = false,
  hideFaqLauncher = false,
}: GeneratorFormProps) {
  const slugFromUrl = initialSubfolderSlug?.trim() || undefined;

  const [businessName, setBusinessName] = useState(() =>
    slugFromUrl ? (initialClientName?.trim() ?? "") : "",
  );
  const [description, setDescription] = useState(() =>
    slugFromUrl ? (initialClientDescription?.trim() ?? "") : "",
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rawFallback, setRawFallback] = useState<string | null>(null);
  const [streamLog, setStreamLog] = useState("");
  const [streamPhase, setStreamPhase] = useState<string | null>(null);
  const [generatedTailwind, setGeneratedTailwind] = useState<GeneratedTailwindPage | null>(null);
  const [showJson, setShowJson] = useState(false);
  const [pipelineFeedback, setPipelineFeedback] = useState<GenerationPipelineFeedback | null>(null);
  const [designRationale, setDesignRationale] = useState<string | null>(null);
  const [designRationaleLoading, setDesignRationaleLoading] = useState(false);
  const [designRationaleSkipReason, setDesignRationaleSkipReason] = useState<string | null>(null);
  const [designContract, setDesignContract] = useState<DesignGenerationContract | null>(null);
  const [designContractWarning, setDesignContractWarning] = useState<string | null>(null);
  const [conceptRefineLoading, setConceptRefineLoading] = useState(false);
  /** Stream stopte zonder `complete` (vaak timeout/proxy) — toch laatste secties tonen. */
  const [streamEndedWithoutComplete, setStreamEndedWithoutComplete] = useState(false);

  const streamJsonBufferRef = useRef("");
  const pollAbortRef = useRef(false);
  const lastPolledJobProgressRef = useRef<string | null>(null);
  const [streamingSections, setStreamingSections] = useState<TailwindSection[]>([]);
  const [streamingConfig, setStreamingConfig] = useState<TailwindPageConfig | null>(null);
  /** Tijdens generatie: status + secties (zonder live iframe-preview tot `complete`). */
  const [generationActivity, setGenerationActivity] = useState<{ id: string; text: string }[]>([]);
  const appendGenerationActivity = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setGenerationActivity((prev) => {
      if (prev.length > 0 && prev[prev.length - 1].text === trimmed) return prev;
      const id = `gen-act-${prev.length}-${trimmed.slice(0, 24)}`;
      return [...prev, { id, text: trimmed }];
    });
  }, []);

  const runConceptRefinement = useCallback(
    async (direction: ConceptRefinementDirection) => {
      const page = generatedTailwind;
      if (!page || loading) return;
      setConceptRefineLoading(true);
      setError(null);
      try {
        const instruction = buildConceptRefinementInstruction(direction, designContract);
        const res = await fetch("/api/ai-edit-site", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            instruction,
            sections: page.sections,
            config: page.config,
          }),
        });
        const json = (await res.json()) as {
          ok?: boolean;
          error?: string;
          data?: { sections: TailwindSection[]; config?: TailwindPageConfig | null };
        };
        if (!res.ok || json.ok !== true || !json.data?.sections) {
          setError(
            typeof json.error === "string" && json.error.trim()
              ? json.error.trim()
              : !res.ok
                ? "Conceptverfijning mislukt (serverfout)."
                : "Conceptverfijning mislukt.",
          );
          return;
        }
        setGeneratedTailwind((prev) =>
          prev
            ? {
                ...prev,
                sections: json.data!.sections,
                config: (json.data!.config ?? prev.config) as MasterPromptPageConfig,
              }
            : prev,
        );
      } catch {
        setError("Netwerkfout bij conceptverfijning.");
      } finally {
        setConceptRefineLoading(false);
      }
    },
    [generatedTailwind, designContract, loading],
  );

  const detectedIndustryId = pipelineFeedback?.interpreted?.detectedIndustryId;

  const streamingLivePreviewPayload = useMemo(() => {
    if (streamingSections.length === 0) return null;
    const previewSections = postProcessTailwindSectionsForStreamingPreview(streamingSections, streamingConfig);
    const sectionIdsOrdered = previewSections.map((s, i) => s.id ?? slugifyToSectionId(s.sectionName, i));
    return publishedPayloadFromParsed(
      {
        kind: "tailwind",
        sections: previewSections,
        ...(streamingConfig ? { config: streamingConfig } : {}),
        sectionIdsOrdered,
        siteIr: buildSiteIrV1({
          detectedIndustryId: detectedIndustryId ?? undefined,
          sectionIdsOrdered,
        }),
      },
      businessName.trim() || "Website",
      STUDIO_GENERATION_PACKAGE,
    );
  }, [streamingSections, streamingConfig, businessName, detectedIndustryId]);

  const completedGeneratorPreviewPayload = useMemo(() => {
    if (!generatedTailwind) return null;
    const sectionIdsOrdered = generatedTailwind.sections.map((s, i) =>
      s.id ?? slugifyToSectionId(s.sectionName, i),
    );
    return publishedPayloadFromParsed(
      {
        kind: "tailwind",
        sections: generatedTailwind.sections,
        config: generatedTailwind.config,
        ...(generatedTailwind.logoSet != null ? { logoSet: generatedTailwind.logoSet } : {}),
        ...(generatedTailwind.contactSections != null && generatedTailwind.contactSections.length > 0
          ? { contactSections: generatedTailwind.contactSections }
          : {}),
        ...(generatedTailwind.marketingPages != null && Object.keys(generatedTailwind.marketingPages).length > 0
          ? { marketingPages: generatedTailwind.marketingPages }
          : {}),
        sectionIdsOrdered,
        siteIr: buildSiteIrV1({
          detectedIndustryId: detectedIndustryId ?? undefined,
          sectionIdsOrdered,
          hasDedicatedContactPage: Boolean(
            generatedTailwind.contactSections != null && generatedTailwind.contactSections.length > 0,
          ),
        }),
      },
      businessName.trim() || "Website",
      STUDIO_GENERATION_PACKAGE,
    );
  }, [generatedTailwind, businessName, detectedIndustryId]);

  /**
   * Alleen volledige JSON in de iframe-preview (geen tussentijdse secties).
   * Uitzondering: stream viel weg vóór `complete` — dan tonen we de laatst ontvangen secties.
   */
  const activeStudioPreviewPayload = useMemo(() => {
    if (completedGeneratorPreviewPayload) return completedGeneratorPreviewPayload;
    if (streamEndedWithoutComplete && streamingLivePreviewPayload) return streamingLivePreviewPayload;
    return null;
  }, [completedGeneratorPreviewPayload, streamEndedWithoutComplete, streamingLivePreviewPayload]);

  /** Zelfde gecompileerde Tailwind als `/site` (geen Play CDN) zodra de server-build klaar is. */
  const [generatorPreviewCompiledCss, setGeneratorPreviewCompiledCss] = useState<string | null>(null);

  useEffect(() => {
    const p = activeStudioPreviewPayload;
    if (!p || p.kind !== "tailwind") {
      setGeneratorPreviewCompiledCss(null);
      return;
    }
    if (p.tailwindCompiledCss?.trim()) {
      setGeneratorPreviewCompiledCss(null);
      return;
    }

    const controller = new AbortController();
    let cancelled = false;

    void (async () => {
      try {
        const tw = tailwindSectionsPayloadFromPublishedTailwind(p);
        const { tailwindCompiledCss: _strip, ...payloadForCompile } = tw;
        void _strip;
        const res = await fetch("/api/admin/tailwind-compile-preview", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            documentTitle: p.clientName?.trim() || businessName.trim() || "Website",
            payload: payloadForCompile,
          }),
          signal: controller.signal,
        });
        const json = (await res.json()) as {
          ok?: boolean;
          tailwindCompiledCss?: string;
          error?: string;
        };
        if (cancelled || !json.ok || !json.tailwindCompiledCss?.trim()) return;
        setGeneratorPreviewCompiledCss(json.tailwindCompiledCss.trim());
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [activeStudioPreviewPayload, businessName]);

  const generatorViewPayload = useMemo((): PublishedSitePayload | null => {
    const base = activeStudioPreviewPayload;
    if (!base || base.kind !== "tailwind") return base;
    const mergedCss = generatorPreviewCompiledCss?.trim() || base.tailwindCompiledCss?.trim();
    if (!mergedCss) return base;
    if (base.tailwindCompiledCss?.trim() === mergedCss) return base;
    return { ...base, tailwindCompiledCss: mergedCss };
  }, [activeStudioPreviewPayload, generatorPreviewCompiledCss]);

  const previewIsStreaming = Boolean(streamEndedWithoutComplete && streamingSections.length > 0);
  const previewPendingUntilComplete = Boolean(loading && !generatedTailwind && !streamEndedWithoutComplete);

  const [clientImages, setClientImages] = useState<{ url: string; label: string; uploading?: boolean }[]>([]);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  const [referenceStyleUrl, setReferenceStyleUrl] = useState("");
  /** Geen marketingPages + contact in één run — merkbaar korter (minder timeout-risico). */
  const [landingPageOnly, setLandingPageOnly] = useState(false);
  /** Chat + preview over heel scherm (Lovable-achtig), zonder iframe te herladen. */
  const [previewFullscreen, setPreviewFullscreen] = useState(false);
  /** `split` = twee kolommen; `editor` / `preview` = één paneel op volle breedte (binnen de studio-shell). */
  const [panelLayout, setPanelLayout] = useState<StudioPanelLayout>("split");
  /** Rechter paneel: live preview of uitgebreid logboek (Lovable-achtig). */
  const [rightPaneMode, setRightPaneMode] = useState<StudioRightPaneMode>("preview");
  const [portalReady, setPortalReady] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setPortalReady(true), []);

  const handleRightPaneModeChange = useCallback((mode: StudioRightPaneMode) => {
    setRightPaneMode(mode);
    if (mode === "details" && panelLayout === "editor") {
      setPanelLayout("split");
    }
  }, [panelLayout]);

  const descriptionLocked = existingDraftLocked || generatedTailwind != null;

  const canOpenSitePreviewTab = Boolean(slugFromUrl && isValidSubfolderSlug(slugFromUrl));

  const openSitePreviewInNewTab = useCallback(() => {
    if (!slugFromUrl || !isValidSubfolderSlug(slugFromUrl)) return;
    const href = buildStudioSiteOpenPreviewUrl(window.location.origin, slugFromUrl, draftPublicPreviewToken);
    window.open(href, "_blank", "noopener,noreferrer");
  }, [slugFromUrl, draftPublicPreviewToken]);

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

  const uploadFile = useCallback(
    async (file: File) => {
      if (descriptionLocked) return;
      if (file.size > 5 * 1024 * 1024) {
        setImageUploadError("Bestand te groot (max. 5 MB).");
        return;
      }
      const allowed = ["image/png", "image/jpeg", "image/webp", "image/gif"];
      if (!allowed.includes(file.type)) {
        setImageUploadError("Alleen PNG, JPEG, WebP of GIF toegestaan.");
        return;
      }
      setImageUploadError(null);
      const placeholder = { url: "", label: file.name, uploading: true };
      setClientImages((prev) => [...prev, placeholder]);

      try {
        const form = new FormData();
        form.append("file", file);
        form.append("subfolder_slug", slugFromUrl || "studio-uploads");
        const res = await fetch("/api/upload/site-asset", { method: "POST", credentials: "include", body: form });
        const json = (await res.json()) as { ok: boolean; url?: string; error?: string };
        if (!json.ok || !json.url) {
          setClientImages((prev) => prev.filter((img) => img !== placeholder));
          setImageUploadError(json.error ?? "Upload mislukt.");
          return;
        }
        setClientImages((prev) =>
          prev.map((img) => (img === placeholder ? { url: json.url!, label: file.name, uploading: false } : img)),
        );
      } catch {
        setClientImages((prev) => prev.filter((img) => img !== placeholder));
        setImageUploadError("Upload mislukt (netwerkfout).");
      }
    },
    [slugFromUrl, descriptionLocked],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (descriptionLocked) return;
      const files = Array.from(e.dataTransfer.files).slice(0, 8 - clientImages.length);
      for (const f of files) uploadFile(f);
    },
    [uploadFile, clientImages.length, descriptionLocked],
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (descriptionLocked) return;
      const files = Array.from(e.target.files ?? []).slice(0, 8 - clientImages.length);
      for (const f of files) uploadFile(f);
      e.target.value = "";
    },
    [uploadFile, clientImages.length, descriptionLocked],
  );

  useEffect(() => {
    if (!slugFromUrl) return;
    setBusinessName(initialClientName?.trim() ?? "");
    if (existingDraftLocked) return;
    setDescription(initialClientDescription?.trim() ?? "");
  }, [slugFromUrl, initialClientName, initialClientDescription, existingDraftLocked]);

  useEffect(() => {
    return () => {
      pollAbortRef.current = true;
    };
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setRawFallback(null);
    setGeneratedTailwind(null);
    setStreamLog("");
    streamJsonBufferRef.current = "";
    setStreamingSections([]);
    setStreamingConfig(null);
    setStreamPhase(null);
    setPipelineFeedback(null);
    setDesignRationale(null);
    setDesignRationaleLoading(false);
    setDesignRationaleSkipReason(null);
    setDesignContract(null);
    setDesignContractWarning(null);
    setStreamEndedWithoutComplete(false);
    setGenerationActivity([]);
    setRightPaneMode("preview");
    setLoading(true);
    try {
      const readyImages = clientImages.filter((img) => img.url && !img.uploading);
      const body: Record<string, unknown> = {
        businessName,
        description,
        ...(readyImages.length > 0
          ? { clientImages: readyImages.map((img) => ({ url: img.url, label: img.label || undefined })) }
          : {}),
      };
      if (slugFromUrl && isValidSubfolderSlug(slugFromUrl)) {
        body.subfolder_slug = slugFromUrl;
      }
      const refTrim = referenceStyleUrl.trim();
      if (refTrim.length > 0) {
        body.reference_style_url = refTrim;
      }
      body.landing_page_only = landingPageOnly;

      if (!USE_LEGACY_NDJSON_STREAM) {
        const startRes = await fetch("/api/generate-site/jobs", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const startPayload = (await startRes.json()) as
          | { ok: true; jobId: string }
          | { ok: false; error: string };
        if (!startRes.ok || !startPayload.ok || !("jobId" in startPayload)) {
          const fallbackToStream =
            !startPayload.ok && SITE_GENERATION_JOBS_MIGRATION_ERROR_RE.test(startPayload.error ?? "");
          if (!fallbackToStream) {
            setError(!startPayload.ok ? startPayload.error : "Job start mislukt.");
            return;
          }
          appendGenerationActivity(
            "Server-job queue niet beschikbaar (site_generation_jobs ontbreekt) — terugval naar directe stream.",
          );
          setStreamPhase("Terugvalmodus: directe stream");
        } else {
          appendGenerationActivity("Server-job gestart — verbinding blijft kort open; generatie draait op de server.");
          pollAbortRef.current = false;
          lastPolledJobProgressRef.current = null;
          /** Denklijn-tekst bestaat pas ná `generation_meta` + aparte rationale-API; tot die tijd geen “uitleg”-spinner i.v.m. wachtrij/prepare. */
          setDesignRationaleLoading(false);
          /** ~16 min: lange Claude-runs + zelfreview/Unsplash ruim boven client-timeout houden. */
          const maxJobPolls = 480;
          for (let i = 0; i < maxJobPolls; i++) {
            if (pollAbortRef.current) break;
            if (i > 0) await new Promise((r) => setTimeout(r, 2000));
            const jr = await fetch(`/api/generate-site/jobs/${startPayload.jobId}`, {
              credentials: "include",
              cache: "no-store",
            });
            const jp = (await jr.json()) as
              | {
                  ok: true;
                  job: {
                    status: string;
                    progress_message: string | null;
                    error_message: string | null;
                    result: GeneratedTailwindPage | null;
                    updated_at?: string;
                    pipeline_feedback_json?: unknown;
                    denklijn_text?: string | null;
                    denklijn_skip_reason?: string | null;
                    design_contract_json?: unknown;
                    design_contract_warning?: string | null;
                  };
                }
              | { ok: false; error: string };
            if (!jr.ok || !jp.ok) {
              setError(!jp.ok ? jp.error : "Jobstatus ophalen mislukt.");
              return;
            }
            const { job } = jp;
            if (job.pipeline_feedback_json != null && typeof job.pipeline_feedback_json === "object") {
              setPipelineFeedback(job.pipeline_feedback_json as GenerationPipelineFeedback);
            }
            const hasPipeline = job.pipeline_feedback_json != null && typeof job.pipeline_feedback_json === "object";
            const hasDenk = job.denklijn_text != null && job.denklijn_text.length > 0;
            const hasSkip = job.denklijn_skip_reason != null && job.denklijn_skip_reason.length > 0;
            if (hasDenk) {
              setDesignRationale(job.denklijn_text);
              setDesignRationaleSkipReason(null);
              setDesignRationaleLoading(false);
            } else if (hasSkip) {
              setDesignRationale(null);
              setDesignRationaleSkipReason(job.denklijn_skip_reason);
              setDesignRationaleLoading(false);
            } else if (job.status === "running" && hasPipeline) {
              setDesignRationaleLoading(true);
            } else if (job.status === "running" && !hasPipeline) {
              setDesignRationaleLoading(false);
            }
            if (job.design_contract_json != null && typeof job.design_contract_json === "object") {
              setDesignContract(job.design_contract_json as DesignGenerationContract);
              setDesignContractWarning(job.design_contract_warning?.trim() || null);
            }
            const msg = job.progress_message?.trim() ?? "";
            if (msg && msg !== lastPolledJobProgressRef.current) {
              lastPolledJobProgressRef.current = msg;
              setStreamPhase(msg);
              appendGenerationActivity(msg);
            } else if (job.status === "running" && job.updated_at && i > 0 && i % 5 === 0) {
              /** Geen nieuwe `progress_message` (bijv. lange Denklijn-API): niet elke poll een bijna-gelijke regel in het log — dat voelt als “hangen”. */
              const ageSec = Math.round((Date.now() - new Date(job.updated_at).getTime()) / 1000);
              if (ageSec > 35) {
                const baseline =
                  lastPolledJobProgressRef.current?.trim() ||
                  msg.trim() ||
                  "Server voert een lange stap uit (o.a. Denklijn of zware JSON-generatie).";
                setStreamPhase(
                  `${baseline} · laatste statussync ${ageSec}s geleden — gebruikelijk; harde timeout pas na ~16 min.`,
                );
              }
            }
            if (job.status === "succeeded" && job.result) {
              setGeneratedTailwind(job.result);
              setStreamPhase("Generatie voltooid");
              appendGenerationActivity("Klaar — resultaat geladen.");
              setDesignRationaleLoading(false);
              return;
            }
            if (job.status === "failed") {
              setError(job.error_message ?? "Generatie mislukt.");
              setDesignRationaleLoading(false);
              return;
            }
          }
          setError(
            "Polling gestopt (timeout na ~16 min). Controleer de job in de database of probeer opnieuw; voor maximale live-feedback: NEXT_PUBLIC_SITE_GENERATION_USE_STREAM.",
          );
          return;
        }
      }

      const res = await fetch("/api/generate-site/stream", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", Accept: "application/x-ndjson" },
        body: JSON.stringify(body),
      });

      const ct = res.headers.get("content-type") ?? "";
      if (!ct.includes("ndjson") && !ct.includes("x-ndjson")) {
        const payload = (await res.json()) as ApiOk | ApiErr;
        if (!res.ok || !payload.ok) {
          setError(!payload.ok ? payload.error : "Generatie mislukt.");
          if (!payload.ok && payload.rawText) setRawFallback(payload.rawText);
          return;
        }
        if (payload.outputFormat === "tailwind_sections") {
          setGeneratedTailwind(payload.data);
        }
        return;
      }

      if (!res.body) {
        setError("Geen response-stream van de server.");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let streamStopped = false;

      const handleNdjsonEvent = (ev: GenerateSiteStreamNdjsonEvent) => {
          if (ev.type === "keepalive") {
            return;
          }
          if (ev.type === "generation_meta") {
            setPipelineFeedback(ev.feedback);
            setDesignRationaleLoading(true);
            setDesignRationale(null);
            setDesignRationaleSkipReason(null);
            setDesignContract(null);
            setDesignContractWarning(null);
            appendGenerationActivity("Pipeline: briefing geïnterpreteerd (branche, stijl, structuur).");
          }
          if (ev.type === "design_rationale") {
            setDesignRationaleLoading(false);
            setDesignContract(ev.contract ?? null);
            setDesignContractWarning(ev.contractWarning ?? null);
            if (ev.text != null && ev.text.length > 0) {
              setDesignRationale(ev.text);
              setDesignRationaleSkipReason(null);
              appendGenerationActivity("Denklijn: rationale en designcontract ontvangen.");
            } else {
              setDesignRationale(null);
              setDesignRationaleSkipReason(ev.skipReason ?? "onbekend");
              appendGenerationActivity(
                `Denklijn overgeslagen${ev.skipReason ? `: ${ev.skipReason}` : ""}.`,
              );
            }
          }
          if (ev.type === "status") {
            setStreamPhase(ev.message);
            appendGenerationActivity(ev.message);
          }
          if (ev.type === "token") {
            streamJsonBufferRef.current += ev.content;
            setStreamLog((prev) => (prev + ev.content).slice(-120_000));
          }
          if (ev.type === "section_complete") {
            const s = ev.section;
            const sectionName = s.sectionName?.trim() || s.id;
            appendGenerationActivity(`Sectie ontvangen: ${sectionName}`);
            setStreamingSections((prev) => {
              if (prev.some((x) => x.id === s.id)) return prev;
              return [...prev, { id: s.id, html: s.html, sectionName }];
            });
            const cfg = tryExtractStreamingTailwindConfig(streamJsonBufferRef.current);
            if (cfg) setStreamingConfig(cfg);
          }
          if (ev.type === "complete") {
            setStreamEndedWithoutComplete(false);
            setStreamingSections([]);
            setStreamingConfig(null);
            streamJsonBufferRef.current = "";
            if (ev.outputFormat === "tailwind_sections") {
              setGeneratedTailwind(ev.data);
            }
            setDesignRationaleLoading(false);
            streamStopped = true;
          }
          if (ev.type === "error") {
            setStreamEndedWithoutComplete(false);
            setStreamingSections([]);
            setStreamingConfig(null);
            streamJsonBufferRef.current = "";
            setError(ev.message);
            if (ev.rawText) setRawFallback(ev.rawText);
            setDesignRationaleLoading(false);
            streamStopped = true;
          }
      };

      while (!streamStopped) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer = consumeGenerateSiteNdjsonBuffer(buffer, decoder.decode(value, { stream: true }), handleNdjsonEvent);
      }

      if (buffer.trim()) {
        buffer = consumeGenerateSiteNdjsonBuffer(buffer, "\n", handleNdjsonEvent);
      }

      if (!streamStopped) {
        setStreamEndedWithoutComplete(true);
        setError((prev) =>
          prev ??
          "De verbinding met de server werd verbroken vóór de generatie kon worden afgerond (vaak door een time-out of netwerkonderbreking). Hieronder staan de laatst ontvangen secties — genereer opnieuw om op te kunnen slaan.",
        );
      }

      await reader.cancel().catch(() => {});
    } catch {
      setError("Netwerkfout of server niet bereikbaar.");
    } finally {
      setLoading(false);
      setDesignRationaleLoading(false);
    }
  }

  const fieldClass =
    "mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20";
  const fieldLockedClass =
    "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-600 placeholder:text-slate-400 focus:border-slate-200 focus:ring-0";

  const visiblePanelsProp =
    panelLayout === "split" ? ("both" as const) : panelLayout === "editor" ? ("sidebar" as const) : ("main" as const);

  const layoutBtnCls = (mode: StudioPanelLayout) =>
    cn(
      "inline-flex size-8 items-center justify-center rounded-md transition-colors",
      panelLayout === mode
        ? "bg-indigo-100 text-indigo-900 dark:bg-indigo-950/80 dark:text-indigo-100"
        : "text-zinc-600 hover:bg-zinc-200/80 dark:text-zinc-400 dark:hover:bg-zinc-800",
    );

  const panelLayoutToggles = (
    <div
      className="flex items-center gap-0.5 rounded-lg border border-zinc-200 bg-white/95 p-0.5 shadow-sm dark:border-zinc-600 dark:bg-zinc-900/95"
      role="group"
      aria-label="Paneelweergave"
    >
      <button
        type="button"
        className={layoutBtnCls("split")}
        onClick={() => setPanelLayout("split")}
        title="Twee kolommen: briefing en preview"
      >
        <Columns2 className="size-4 shrink-0" aria-hidden />
        <span className="sr-only">Twee kolommen</span>
      </button>
      <button
        type="button"
        className={layoutBtnCls("editor")}
        onClick={() => setPanelLayout("editor")}
        title="Alleen briefing (tekstvelden)"
      >
        <PanelLeft className="size-4 shrink-0" aria-hidden />
        <span className="sr-only">Alleen briefing</span>
      </button>
      <button
        type="button"
        className={layoutBtnCls("preview")}
        onClick={() => setPanelLayout("preview")}
        title="Alleen live preview"
      >
        <PanelRight className="size-4 shrink-0" aria-hidden />
        <span className="sr-only">Alleen preview</span>
      </button>
    </div>
  );

  const editorFocusBar =
    panelLayout === "editor" && !previewFullscreen ? (
      <div className="sticky top-0 z-[2] -mx-0.5 mb-1 flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white/95 px-2 py-1.5 shadow-sm backdrop-blur-sm dark:border-zinc-700 dark:bg-zinc-900/95">
        <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300">Weergave</span>
        {panelLayoutToggles}
      </div>
    ) : null;

  const renderPanels = () => (
      <ResizableEditorPanels
        storageKey="gentrix-studio-generator-sidebar-px"
        className="min-h-0 flex-1"
        visiblePanels={visiblePanelsProp}
        defaultSidebarPx={420}
        minSidebarPx={280}
        maxSidebarPx={560}
        minMainPx={480}
        sidebar={
          <div className="flex min-h-0 flex-col gap-5 pr-1">
            {editorFocusBar}
            <form
              onSubmit={onSubmit}
              className="sales-os-glass-panel space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm md:p-8"
            >
        {!hideFaqLauncher ? (
          <div className="flex justify-end">
            <GeneratorStudioFaqLauncher />
          </div>
        ) : null}
        <p className="text-[11px] leading-snug text-slate-500">
          Korte of lange briefing: de Denklijn vult aan op de server. Uitgebreide uitleg:{" "}
          {hideFaqLauncher ? (
            <>
              zie <strong className="font-medium text-slate-600">FAQ generatie</strong> in de studio-balk.
            </>
          ) : (
            <>
              zie <strong className="font-medium text-slate-600">FAQ generatie</strong> (knop hierboven).
            </>
          )}
        </p>

        <div>
          <label htmlFor="businessName" className="block text-sm font-medium text-slate-700">
            Bedrijfsnaam
          </label>
          <input
            id="businessName"
            name="businessName"
            type="text"
            required
            maxLength={200}
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            className={fieldClass}
            placeholder="Bijv. Jouw Bedrijfsnaam BV"
          />
        </div>
        <div className="rounded-xl border border-indigo-100 bg-indigo-50/35 p-4 dark:border-indigo-900/40 dark:bg-indigo-950/25">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-indigo-900 dark:text-indigo-100">
            Referentie &amp; beelden
          </p>
          <div className="space-y-4">
            <div>
              <label htmlFor="referenceStyleUrl" className="block text-sm font-medium text-slate-700">
                Referentiesite <span className="font-normal text-slate-400">(optioneel)</span>
              </label>
              <input
                id="referenceStyleUrl"
                name="referenceStyleUrl"
                type="url"
                disabled={descriptionLocked}
                className={cn(fieldClass, descriptionLocked && fieldLockedClass)}
                value={referenceStyleUrl}
                onChange={(e) => setReferenceStyleUrl(e.target.value)}
                placeholder="https://… — stijl/structuur als hint"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Klantfoto&apos;s <span className="font-normal text-slate-400">(optioneel, max. 8)</span>
              </label>
              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                className={cn(
                  "mt-2 flex min-h-[72px] flex-wrap items-center gap-2 rounded-lg border-2 border-dashed border-slate-200 bg-white/80 p-3 dark:border-slate-600 dark:bg-zinc-900/40",
                  !descriptionLocked && clientImages.length < 8 && "hover:border-indigo-300",
                  descriptionLocked && "pointer-events-none opacity-60",
                )}
              >
                {clientImages.map((img, i) => (
                  <div key={img.url || i} className="group relative size-16 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                    {img.uploading ? (
                      <div className="flex size-full items-center justify-center">
                        <Loader2 className="size-4 animate-spin text-slate-400" />
                      </div>
                    ) : (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={img.url} alt={img.label} className="size-full object-cover" />
                        <button
                          type="button"
                          disabled={descriptionLocked}
                          onClick={() => setClientImages((prev) => prev.filter((_, idx) => idx !== i))}
                          className="absolute -right-1 -top-1 hidden rounded-full bg-red-500 p-0.5 text-white shadow-sm group-hover:block disabled:hidden"
                        >
                          <X className="size-3" />
                        </button>
                      </>
                    )}
                  </div>
                ))}
                {clientImages.length < 8 && (
                  <button
                    type="button"
                    disabled={descriptionLocked}
                    onClick={() => fileInputRef.current?.click()}
                    className="flex size-16 shrink-0 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-slate-300 text-slate-400 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <ImagePlus className="size-5" />
                    <span className="text-[10px] font-medium">Upload</span>
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  multiple
                  disabled={descriptionLocked}
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </div>
              {imageUploadError ? <p className="mt-1 text-xs text-red-600">{imageUploadError}</p> : null}
            </div>
          </div>
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <label htmlFor="description" className="block text-sm font-medium text-slate-700">
              Omschrijving
            </label>
            <StudioThemeStylesHint />
          </div>
          {descriptionLocked ? (
            <p className="mt-1 text-xs text-slate-500">
                  Briefing is beveiligd zodra er een concept-site is of je net hebt gegenereerd. Gebruik de tab{" "}
                  <strong className="font-medium text-slate-700">Bewerken</strong> in site-studio (zelfde URL met slug) voor
                  HTML-wijzigingen via AI-chat.
            </p>
          ) : null}
          <textarea
            id="description"
            name="description"
            required={!descriptionLocked}
            maxLength={4000}
            rows={8}
            value={description}
            onChange={(e) => {
              if (descriptionLocked) return;
              setDescription(e.target.value);
            }}
            readOnly={descriptionLocked}
            className={cn(fieldClass, descriptionLocked && fieldLockedClass)}
            placeholder="Kort of uitgebreid: doelgroep, aanbod, toon, CTA. Mag een zin; de Denklijn breidt uit op de server."
          />
        </div>
        <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50/80 p-3">
          <input
            id="landingPageOnly"
            type="checkbox"
            checked={landingPageOnly}
            onChange={(e) => setLandingPageOnly(e.target.checked)}
            disabled={descriptionLocked}
            className="mt-1 size-4 shrink-0 rounded border-slate-300 text-indigo-600"
          />
          <label htmlFor="landingPageOnly" className={cn("text-sm text-slate-700", descriptionLocked && "opacity-60")}>
            <span className="font-medium text-slate-800">Alleen landingspagina</span>
            <span className="mt-0.5 block text-xs font-normal text-slate-500">
              Sneldere run; subpagina&apos;s later uitbreiden.
            </span>
          </label>
        </div>

        <button
          type="submit"
          disabled={loading}
          className={cn(
            "inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm",
            "hover:bg-[#5558e8] disabled:cursor-not-allowed disabled:opacity-60",
          )}
        >
          {loading ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Genereren…
            </>
          ) : (
            <>
              <Send className="size-4" aria-hidden />
              Genereer site
            </>
          )}
        </button>
      </form>

      {loading ||
      pipelineFeedback != null ||
      generationActivity.length > 0 ||
      generatedTailwind != null ? (
        <GenerationFeedbackPanel
          feedback={pipelineFeedback}
          designRationale={designRationale}
          designRationaleLoading={designRationaleLoading}
          designRationaleSkipReason={designRationaleSkipReason}
          designContract={designContract}
          designContractWarning={designContractWarning}
          rightPaneMode={rightPaneMode}
          onRightPaneModeChange={handleRightPaneModeChange}
          activityLog={generationActivity}
          streamPhase={streamPhase}
          loading={loading}
          hasSiteOutput={generatedTailwind != null}
        />
      ) : null}

      {loading && (streamPhase != null || streamLog.length > 0) ? (
        <div className="space-y-4">
          {streamPhase ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
              <span className="font-medium">Fase:</span> {streamPhase}
            </div>
          ) : null}
          {streamLog.length > 0 ? (
            <details className="rounded-lg border border-slate-200 bg-slate-50">
              <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-slate-700">Ruwe model-output (JSON-stream)</summary>
              <pre className="max-h-56 overflow-auto border-t border-slate-200 p-3 font-mono text-[11px] text-slate-800">
                {streamLog}
              </pre>
            </details>
          ) : null}
        </div>
      ) : null}

      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          <div className="flex gap-2">
            <AlertCircle className="size-4 shrink-0 text-red-600" aria-hidden />
            <div>
              <p className="font-medium">Fout</p>
              <p className="mt-1">{error}</p>
            </div>
          </div>
          {rawFallback && (
            <details className="mt-3">
              <summary className="cursor-pointer text-xs font-medium text-red-800">Ruwe model-output</summary>
              <pre className="mt-2 max-h-48 overflow-auto rounded border border-red-100 bg-white p-2 text-xs text-slate-800">
                {rawFallback}
              </pre>
            </details>
          )}
        </div>
      )}

      {generatedTailwind ? (
        <section className="space-y-4 border-t border-slate-200 pt-6">
          <h2 className="text-sm font-semibold text-slate-900">Volgende stappen</h2>
          <p className="text-xs text-slate-600">
            Preview staat rechts — zelfde <code className="rounded bg-slate-100 px-1 font-mono text-[11px]">PublishedSiteView</code>{" "}
            als <code className="rounded bg-slate-100 px-1 font-mono text-[11px]">/site/…</code> na opslaan. Thema:{" "}
            <span className="font-mono">{generatedTailwind.config.theme.primary}</span> ·{" "}
            <span className="font-mono">{generatedTailwind.config.theme.accent}</span> ·{" "}
            {generatedTailwind.sections.length} secties
          </p>
          <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-3 dark:border-indigo-900/50 dark:bg-indigo-950/30">
            <p className="text-xs font-medium text-indigo-950 dark:text-indigo-100">Concept verfijnen</p>
            <p className="mt-1 text-[11px] leading-snug text-indigo-900/85 dark:text-indigo-200/90">
              Lichte tweede pass via de editor-API: zelfde sectie-<code className="font-mono text-[10px]">id</code>
              ’s, alleen HTML-aanpassingen. Alleen de huidige landingspagina (
              {generatedTailwind.sections.length} secties).
            </p>
            {conceptRefineLoading ? (
              <p className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-indigo-900 dark:text-indigo-100">
                <Loader2 className="size-3.5 shrink-0 animate-spin" aria-hidden />
                Bezig met verfijnen…
              </p>
            ) : null}
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={conceptRefineLoading || loading}
                onClick={() => void runConceptRefinement("strakker_zakelijk")}
                className="inline-flex items-center justify-center rounded-lg border border-indigo-200/90 bg-white px-2.5 py-1.5 text-[11px] font-medium text-indigo-950 shadow-sm hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-100 dark:hover:bg-indigo-900/80"
              >
                Strakker / zakelijk
              </button>
              <button
                type="button"
                disabled={conceptRefineLoading || loading}
                onClick={() => void runConceptRefinement("durfder_editorial")}
                className="inline-flex items-center justify-center rounded-lg border border-indigo-200/90 bg-white px-2.5 py-1.5 text-[11px] font-medium text-indigo-950 shadow-sm hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-100 dark:hover:bg-indigo-900/80"
              >
                Durfder / editorial
              </button>
              <button
                type="button"
                disabled={conceptRefineLoading || loading}
                onClick={() => void runConceptRefinement("meer_beweging")}
                className="inline-flex items-center justify-center rounded-lg border border-indigo-200/90 bg-white px-2.5 py-1.5 text-[11px] font-medium text-indigo-950 shadow-sm hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-100 dark:hover:bg-indigo-900/80"
              >
                Meer beweging
              </button>
            </div>
          </div>
          <DutchSpellcheckPanel
            sections={generatedTailwind.sections.map((s, i) => ({
              id: s.id ?? slugifyToSectionId(s.sectionName, i),
              html: s.html,
            }))}
          />
          <SaveSitePanel
            page={generatedTailwind}
            siteIrHints={
              detectedIndustryId ? { detectedIndustryId } : undefined
            }
            defaultName={businessName}
            defaultDescription={description}
            defaultSubfolderSlug={slugFromUrl}
            defaultPublishStatus="draft"
            generatorMode
            onSaved={onSiteSaved}
          />
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setShowJson((s) => !s)}
              className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-indigo-600"
            >
              <Code2 className="size-4" aria-hidden />
              {showJson ? "Verberg JSON" : "Toon volledige JSON"}
            </button>
            {showJson && (
              <pre className="mt-3 max-h-80 overflow-auto rounded-xl border border-slate-200 bg-slate-900 p-4 text-left text-xs text-slate-100">
                {JSON.stringify(generatedTailwind, null, 2)}
              </pre>
            )}
          </div>
        </section>
      ) : null}
          </div>
        }
        main={
          <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
            {rightPaneMode === "details" ? (
              <div className="sticky top-0 z-[1] shrink-0 border-b border-zinc-200 bg-zinc-100 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleRightPaneModeChange("preview")}
                      className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs font-medium text-zinc-800 shadow-sm hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
                    >
                      <ArrowLeft className="size-3.5 shrink-0" aria-hidden />
                      Terug naar preview
                    </button>
                    <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-100">
                      Details — Site genereren
                    </span>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-1">
                    {!previewFullscreen ? panelLayoutToggles : null}
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
              </div>
            ) : (
              <div className="sticky top-0 z-[1] shrink-0 border-b border-zinc-200 bg-zinc-100 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    <Monitor className="size-4 shrink-0 text-zinc-500 dark:text-zinc-400" aria-hidden />
                    <span>Live preview</span>
                    {previewPendingUntilComplete ? (
                      <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-900 dark:bg-indigo-950/80 dark:text-indigo-100">
                        na voltooiing
                      </span>
                    ) : null}
                    {previewIsStreaming ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-950 dark:bg-amber-950/50 dark:text-amber-100">
                        tussentijds
                      </span>
                    ) : null}
                    {generatedTailwind ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-900 dark:bg-emerald-950/80 dark:text-emerald-100">
                        definitief
                      </span>
                    ) : null}
                    {streamEndedWithoutComplete ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-950 dark:bg-amber-950/50 dark:text-amber-100">
                        stream afgebroken
                      </span>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-1">
                    {!previewFullscreen ? panelLayoutToggles : null}
                    <button
                      type="button"
                      onClick={openSitePreviewInNewTab}
                      disabled={!canOpenSitePreviewTab}
                      title={
                        canOpenSitePreviewTab
                          ? "Open de site in een nieuw tabblad (/site/…, zelfde als live preview na opslaan)"
                          : "Open studio via een klant met slug om /site in een tabblad te openen"
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
                {previewIsStreaming && streamingConfig == null ? (
                  <p className="mt-1 text-[11px] font-normal text-zinc-500 dark:text-zinc-400">
                    Wachten op <code className="font-mono">config</code> uit het model — tijdelijk placeholderkleuren tot de
                    stream die keys heeft uitgestuurd.
                  </p>
                ) : null}
              </div>
            )}
            {rightPaneMode === "preview" && streamEndedWithoutComplete ? (
              <p className="shrink-0 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/35 dark:text-amber-50">
                De verbinding werd verbroken vóór de server <strong>generatie voltooid</strong> meldde. Rechts de laatst
                ontvangen secties; gebruik <strong>Genereer opnieuw</strong> om op te kunnen slaan.
              </p>
            ) : null}
            <div
              className={cn(
                "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950",
                previewFullscreen && "rounded-lg border-zinc-300 dark:border-zinc-700",
              )}
            >
              {rightPaneMode === "details" ? (
                <GenerationDetailsBody
                  feedback={pipelineFeedback}
                  fallbackBrief={{ businessName: businessName.trim(), description: description.trim() }}
                  referenceStyleRequested={referenceStyleUrl.trim().length > 0}
                  designRationale={designRationale}
                  designRationaleLoading={designRationaleLoading}
                  designRationaleSkipReason={designRationaleSkipReason}
                  designContract={designContract}
                  designContractWarning={designContractWarning}
                  activityLog={generationActivity}
                  streamPhase={streamPhase}
                  loading={loading}
                />
              ) : (
              ((loading && !activeStudioPreviewPayload) ||
                (!activeStudioPreviewPayload && error && generationActivity.length > 0)) ? (
                <div className="flex min-h-[280px] flex-1 flex-col gap-0 overflow-hidden">
                  <div className="flex shrink-0 flex-col items-center gap-2 border-b border-zinc-100 bg-zinc-50/90 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-900/50">
                    {loading ? (
                      <Loader2 className="size-8 animate-spin text-indigo-500" aria-hidden />
                    ) : (
                      <AlertCircle className="size-8 text-red-500" aria-hidden />
                    )}
                    <p className="text-center text-sm font-medium text-zinc-800 dark:text-zinc-200">
                      {loading ? "Bezig met genereren…" : "Generatie gestopt"}
                    </p>
                    <p className="text-center text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                      De preview verschijnt hier pas als de run <strong className="font-medium text-zinc-800 dark:text-zinc-200">volledig</strong> klaar is.
                      Hieronder wat de server onderweg deed.
                      <span className="mt-2 block text-[11px] text-zinc-500 dark:text-zinc-500">
                        Weinig nieuwe regels in het log is normaal tijdens Denklijn of het grote model — dat betekent niet
                        dat de job vastloopt.
                      </span>
                    </p>
                    {streamPhase ? (
                      <p className="max-w-md text-center text-xs text-indigo-800 dark:text-indigo-200">
                        <span className="font-medium">Nu:</span> {streamPhase}
                      </p>
                    ) : null}
                    {streamingSections.length > 0 ? (
                      <p className="text-center text-[11px] text-zinc-500 dark:text-zinc-400">
                        {streamingSections.length} sectie{streamingSections.length === 1 ? "" : "s"} in model-output
                        geparset — nog niet in de preview getoond.
                      </p>
                    ) : null}
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                      Activiteiten
                    </p>
                    {generationActivity.length === 0 ? (
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">Wachten op eerste serverberichten…</p>
                    ) : (
                      <ol className="space-y-2 border-l border-zinc-200 pl-3 dark:border-zinc-700">
                        {generationActivity.map((row) => (
                          <li
                            key={row.id}
                            className="relative text-xs leading-snug text-zinc-700 before:absolute before:-left-3 before:top-1.5 before:size-1.5 before:rounded-full before:bg-indigo-400 before:content-[''] dark:text-zinc-300 dark:before:bg-indigo-500"
                          >
                            {row.text}
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                </div>
              ) : generatorViewPayload ? (
                <PublishedSiteView
                  payload={generatorViewPayload}
                  className="min-h-0 flex-1"
                  publishedSlug={slugFromUrl}
                  draftPublicPreviewToken={draftPublicPreviewToken}
                  appointmentsEnabled={appointmentsEnabled}
                  webshopEnabled={webshopEnabled}
                />
              ) : (
                <div className="flex min-h-[min(360px,50dvh)] flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
                  <Monitor className="size-10 text-zinc-300 dark:text-zinc-600" aria-hidden />
                  <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Nog geen preview</p>
                  <p className="max-w-sm text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                    Vul links de briefing in en klik op <strong className="text-zinc-800 dark:text-zinc-200">Genereer</strong>.
                    Hier komt dezelfde weergave als op de openbare site (<code className="font-mono text-[11px]">/site/…</code>
                    ), inclusief studio-tokens die naar echte paden worden omgezet zodra er een slug is.
                  </p>
                </div>
              ))}
            </div>
          </div>
        }
      />
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {portalReady && previewFullscreen
        ? createPortal(
            <div className="fixed inset-0 z-[1000] flex flex-col overflow-hidden bg-zinc-100 p-2 shadow-2xl dark:bg-zinc-950 sm:p-3">
              <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-zinc-200 bg-zinc-100 px-2 py-2 dark:border-zinc-800 dark:bg-zinc-900">
                <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Studio — volledig scherm</span>
                <div className="ml-auto flex flex-wrap items-center gap-2">
                  {panelLayoutToggles}
                  <button
                    type="button"
                    onClick={() => setPreviewFullscreen(false)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-800 shadow-sm hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
                  >
                    <Minimize2 className="size-3.5" aria-hidden />
                    Sluiten
                  </button>
                </div>
              </div>
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{renderPanels()}</div>
            </div>,
            document.body,
          )
        : (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{renderPanels()}</div>
          )}
    </div>
  );
}

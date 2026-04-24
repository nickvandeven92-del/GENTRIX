"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertCircle,
  ArrowLeft,
  ArrowUp,
  Check,
  ChevronRight,
  Code2,
  Columns2,
  ExternalLink,
  Loader2,
  Maximize2,
  Minimize2,
  Monitor,
  PanelLeft,
  PanelRight,
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
import { StudioSupportStrip } from "@/components/sales-os/studio-support-strip";
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
import { publishedPayloadFromParsed, type PublishedSitePayload } from "@/lib/site/project-published-payload";
import { tailwindSectionsPayloadFromPublishedTailwind } from "@/lib/data/tailwind-sections-payload-from-published";
import { buildSiteIrV1 } from "@/lib/site/site-ir-schema";
import type { DesignGenerationContract } from "@/lib/ai/design-generation-contract";
import { formatDesignContractHumanSummaryNl } from "@/lib/ai/design-contract-human-summary";
import {
  buildConceptRefinementInstruction,
  type ConceptRefinementDirection,
} from "@/lib/ai/concept-refinement-instructions";
import type { GenerationPipelineFeedback } from "@/lib/api/generation-pipeline-feedback";
import { isValidSubfolderSlug } from "@/lib/slug";
import { buildStudioSiteOpenPreviewUrl } from "@/lib/site/build-studio-site-open-preview-url";
import {
  consumeGenerateSiteNdjsonBuffer,
  type GenerateSiteStreamNdjsonEvent,
} from "@/lib/api/generate-site-stream-events";
import { cn } from "@/lib/utils";
import { deriveStudioBusinessNameFromBriefing } from "@/lib/studio/derive-studio-business-name";
import {
  displayStudioBrandNameForUi,
  isStudioUndecidedBrandName,
} from "@/lib/studio/studio-brand-sentinel";
import { STUDIO_HOMEPAGE_SUBFOLDER_SLUG } from "@/lib/slug";
type StudioPanelLayout = "split" | "editor" | "preview";

/** Laatste server-`stream_trace` (lokaal in `onSubmit`; TS volgt closure-mutaties niet → bij uitlezen expliciet verbreden). */
type SiteGenerationStreamTraceSnapshot = {
  runId: string;
  phase: string;
  offsetMs: number;
  detail?: string;
};

/** Max. ruwe JSON-log in tekens (token-stream); voorkomt geheugenproblemen in de browser. */
const SITE_STREAM_LOG_MAX_CHARS = 400_000;

/** Briefing-screenshots / referenties bij de opdracht — los van klantfoto's (max. in schema / API); server leest zichtbare tekst via vision. */
const BRIEFING_REF_IMAGES_MAX = 6;

function extractFirstHttpUrl(text: string): string | undefined {
  const m = text.match(/https?:\/\/[^\s<>"')]+/i);
  if (!m?.[0]) return undefined;
  return m[0].replace(/[.,;:!?)]+$/u, "").slice(0, 2000);
}

function allowedImageMime(t: string): boolean {
  return t === "image/png" || t === "image/jpeg" || t === "image/webp" || t === "image/gif";
}

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
  const normalizedUrlSlug = useMemo(() => {
    if (!slugFromUrl) return undefined;
    try {
      return decodeURIComponent(slugFromUrl);
    } catch {
      return slugFromUrl;
    }
  }, [slugFromUrl]);

  const [briefingText, setBriefingText] = useState(() => {
    if (!slugFromUrl) return "";
    const name = initialClientName?.trim() ?? "";
    const desc = (initialClientDescription ?? "").trim();
    if (name && desc) return `${name}\n\n${desc}`;
    return name || desc;
  });
  /** Laatst verzonden opdracht — blijft beschikbaar als het veld na verzenden leeg is (zoals Lovable). */
  const [sentBriefingSnapshot, setSentBriefingSnapshot] = useState<string | null>(null);
  /** Verzonden prompts als chatbellen boven het invoerveld. */
  const [submittedPromptTurns, setSubmittedPromptTurns] = useState<{ id: string; text: string }[]>([]);

  const briefingForDerivation = briefingText.trim() || sentBriefingSnapshot?.trim() || "";
  /** Optioneel vak bij de opdracht: voorkomt lange URL-slugs en vult merknaam i.p.v. alleen uit briefing te halen. */
  const [studioBedrijfsnaam, setStudioBedrijfsnaam] = useState(() => {
    const n = initialClientName?.trim() ?? "";
    if (!n) return "";
    const derived = deriveStudioBusinessNameFromBriefing(n);
    return isStudioUndecidedBrandName(derived) ? "" : n;
  });
  const resolvedBusinessName = useMemo(() => {
    const explicit = studioBedrijfsnaam.trim();
    if (explicit) return explicit;
    return deriveStudioBusinessNameFromBriefing(briefingForDerivation);
  }, [studioBedrijfsnaam, briefingForDerivation]);
  const previewClientLabel = useMemo(() => {
    const b = resolvedBusinessName.trim();
    if (isStudioUndecidedBrandName(b)) return "Concept";
    return b || "Website";
  }, [resolvedBusinessName]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rawFallback, setRawFallback] = useState<string | null>(null);
  const [streamLog, setStreamLog] = useState("");
  const [streamPhase, setStreamPhase] = useState<string | null>(null);
  const [generatedTailwind, setGeneratedTailwind] = useState<GeneratedTailwindPage | null>(null);
  const [showJson, setShowJson] = useState(false);
  const [pipelineFeedback, setPipelineFeedback] = useState<GenerationPipelineFeedback | null>(null);

  /** Auto-detect gegenereerde modules op basis van sectie-id's (voorkomt gefilterde preview). */
  const detectedModuleFlags = useMemo(() => {
    if (!generatedTailwind) {
      return { appointmentsEnabled: false, webshopEnabled: false };
    }
    const hasBooking = generatedTailwind.sections.some((s) => s.id?.trim().toLowerCase() === "booking");
    const hasShop = generatedTailwind.sections.some((s) => s.id?.trim().toLowerCase() === "shop");
    return {
      appointmentsEnabled: hasBooking,
      webshopEnabled: hasShop,
    };
  }, [generatedTailwind]);
  const [designRationale, setDesignRationale] = useState<string | null>(null);
  const [designRationaleLoading, setDesignRationaleLoading] = useState(false);
  const [designRationaleSkipReason, setDesignRationaleSkipReason] = useState<string | null>(null);
  const [designContract, setDesignContract] = useState<DesignGenerationContract | null>(null);
  const [designContractWarning, setDesignContractWarning] = useState<string | null>(null);
  const [conceptRefineLoading, setConceptRefineLoading] = useState(false);
  /** Stream stopte zonder `complete` (vaak timeout/proxy) — toch laatste secties tonen. */
  const [streamEndedWithoutComplete, setStreamEndedWithoutComplete] = useState(false);

  const streamJsonBufferRef = useRef("");
  const streamAbortRef = useRef<AbortController | null>(null);
  const [streamingSections, setStreamingSections] = useState<TailwindSection[]>([]);
  const [streamingConfig, setStreamingConfig] = useState<TailwindPageConfig | null>(null);
  /** Tijdens generatie: status + secties (zonder live iframe-preview tot `complete`). */
  const [generationActivity, setGenerationActivity] = useState<{ id: string; text: string }[]>([]);
  /** Beknopte milestone-weergave in het activiteitenpaneel (Lovable-achtig); ruwe tekst blijft bewaard. */
  const [compactActivityLog, setCompactActivityLog] = useState(true);
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
    const gentrixScrollNav = (initialSubfolderSlug?.trim() ?? "") === STUDIO_HOMEPAGE_SUBFOLDER_SLUG;
    const previewSections = postProcessTailwindSectionsForStreamingPreview(streamingSections, streamingConfig, {
      gentrixScrollNav,
    });
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
      previewClientLabel,
      STUDIO_GENERATION_PACKAGE,
    );
  }, [streamingSections, streamingConfig, previewClientLabel, detectedIndustryId]);

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
      previewClientLabel,
      STUDIO_GENERATION_PACKAGE,
    );
  }, [generatedTailwind, previewClientLabel, detectedIndustryId]);

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
            documentTitle: p.clientName?.trim() || previewClientLabel,
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
  }, [activeStudioPreviewPayload, previewClientLabel]);

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

  const [briefingImages, setBriefingImages] = useState<{ url: string; label: string; uploading?: boolean }[]>([]);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  /** Chat + preview over heel scherm (Lovable-achtig), zonder iframe te herladen. */
  const [previewFullscreen, setPreviewFullscreen] = useState(false);
  /** `split` = twee kolommen; `editor` / `preview` = één paneel op volle breedte (binnen de studio-shell). */
  const [panelLayout, setPanelLayout] = useState<StudioPanelLayout>("split");
  /** Rechter paneel: preview (na eerste run) of uitgebreid logboek. */
  const [rightPaneMode, setRightPaneMode] = useState<StudioRightPaneMode>("preview");
  const [portalReady, setPortalReady] = useState(false);
  /** Voor “bezig s”-indicator in het feedbackpaneel (Lovable-achtige doorlooptijd). */
  const [runStartedAtMs, setRunStartedAtMs] = useState<number | null>(null);
  /** Korte “Klaar!”-flash op de preview vóór de iframe (rustige overgang). */
  const [studioPreviewReadyFlash, setStudioPreviewReadyFlash] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const studioReadyFeedbackLine = useMemo(() => {
    if (designContract) {
      const human = formatDesignContractHumanSummaryNl(designContract, { maxChars: 320 }).trim();
      if (human) return human;
    }
    const r = designRationale?.trim();
    if (r) {
      const first = (r.split(/\n\n+/)[0] ?? r).trim();
      return first.length > 220 ? `${first.slice(0, 217)}…` : first;
    }
    const bits = designContract
      ? [designContract.paletteMode, designContract.motionLevel].filter(Boolean).join(" · ")
      : "";
    if (bits) return `Het ontwerp volgt je briefing (${bits}).`;
    return "Het concept staat zo in de preview.";
  }, [designRationale, designContract]);

  useEffect(() => {
    if (!studioPreviewReadyFlash) return;
    const id = window.setTimeout(() => setStudioPreviewReadyFlash(false), 1150);
    return () => window.clearTimeout(id);
  }, [studioPreviewReadyFlash]);

  useEffect(() => setPortalReady(true), []);

  useEffect(() => {
    const el = chatScrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [
    generationActivity,
    submittedPromptTurns,
    loading,
    streamPhase,
    error,
    generatedTailwind,
    designRationaleLoading,
    pipelineFeedback,
    streamLog,
    designRationale,
  ]);

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

  const uploadBriefingFile = useCallback(
    async (file: File) => {
      if (descriptionLocked) return;
      const busy = briefingImages.filter((i) => i.url || i.uploading).length;
      if (busy >= BRIEFING_REF_IMAGES_MAX) {
        setImageUploadError(`Maximaal ${BRIEFING_REF_IMAGES_MAX} briefing-beelden.`);
        return;
      }
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
      setBriefingImages((prev) => [...prev, placeholder]);

      try {
        const form = new FormData();
        form.append("file", file);
        form.append("subfolder_slug", slugFromUrl || "studio-uploads");
        const res = await fetch("/api/upload/site-asset", { method: "POST", credentials: "include", body: form });
        const json = (await res.json()) as { ok: boolean; url?: string; error?: string };
        if (!json.ok || !json.url) {
          setBriefingImages((prev) => prev.filter((img) => img !== placeholder));
          setImageUploadError(json.error ?? "Upload mislukt.");
          return;
        }
        setBriefingImages((prev) =>
          prev.map((img) => (img === placeholder ? { url: json.url!, label: file.name, uploading: false } : img)),
        );
      } catch {
        setBriefingImages((prev) => prev.filter((img) => img !== placeholder));
        setImageUploadError("Upload mislukt (netwerkfout).");
      }
    },
    [slugFromUrl, descriptionLocked, briefingImages],
  );

  const queueBriefingImageFiles = useCallback(
    (files: File[]) => {
      if (descriptionLocked) return;
      const busy = briefingImages.filter((i) => i.url || i.uploading).length;
      const room = Math.max(0, BRIEFING_REF_IMAGES_MAX - busy);
      for (const f of files.slice(0, room)) void uploadBriefingFile(f);
    },
    [descriptionLocked, briefingImages, uploadBriefingFile],
  );

  /** Referentie-/briefing-afbeeldingen: drop op het grote tekstveld (niet op klantfoto-zone). */
  const handleBriefingAreaDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (descriptionLocked) return;
      const files = Array.from(e.dataTransfer.files).filter((f) => allowedImageMime(f.type));
      if (files.length === 0) return;
      queueBriefingImageFiles(files);
    },
    [queueBriefingImageFiles, descriptionLocked],
  );

  const handleDescriptionPaste = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      if (descriptionLocked) return;
      const items = e.clipboardData?.items;
      if (!items?.length) return;
      const files: File[] = [];
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (it?.kind === "file") {
          const f = it.getAsFile();
          if (f && allowedImageMime(f.type)) files.push(f);
        }
      }
      if (files.length === 0) return;
      e.preventDefault();
      queueBriefingImageFiles(files);
    },
    [descriptionLocked, queueBriefingImageFiles],
  );

  useEffect(() => {
    if (!slugFromUrl) return;
    if (existingDraftLocked) return;
    const name = initialClientName?.trim() ?? "";
    const desc = (initialClientDescription ?? "").trim();
    setBriefingText(name && desc ? `${name}\n\n${desc}` : name || desc);
  }, [slugFromUrl, initialClientName, initialClientDescription, existingDraftLocked]);

  useEffect(() => {
    return () => {
      streamAbortRef.current?.abort();
    };
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const prompt = briefingText.trim();
    if (!prompt) return;

    if (!descriptionLocked) {
      setSentBriefingSnapshot(prompt);
      setSubmittedPromptTurns((prev) => [...prev, { id: crypto.randomUUID(), text: prompt }]);
      setBriefingText("");
    }

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
    setPanelLayout("split");
    setStudioPreviewReadyFlash(false);
    setLoading(true);
    setRunStartedAtMs(Date.now());
    try {
      const readyBriefing = briefingImages.filter((img) => img.url && !img.uploading);
      if (!descriptionLocked) {
        setBriefingImages([]);
      }
      const nameForApi = studioBedrijfsnaam.trim() || deriveStudioBusinessNameFromBriefing(prompt);
      const body: Record<string, unknown> = {
        businessName: nameForApi,
        description: prompt,
        ...(readyBriefing.length > 0
          ? {
              briefingReferenceImages: readyBriefing.map((img) => ({
                url: img.url,
                label: img.label || undefined,
              })),
            }
          : {}),
      };
      if (slugFromUrl && isValidSubfolderSlug(slugFromUrl)) {
        body.subfolder_slug = slugFromUrl;
      }
      body.appointments_enabled = appointmentsEnabled;
      body.webshop_enabled = webshopEnabled;
      const refFromBriefing = extractFirstHttpUrl(prompt);
      if (refFromBriefing) {
        body.reference_style_url = refFromBriefing;
      }

      const ac = new AbortController();
      streamAbortRef.current = ac;

      appendGenerationActivity("Generatie via NDJSON-stream naar deze pagina (geen job-poll).");
      setDesignRationaleLoading(false);

      const res = await fetch("/api/generate-site/stream", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/x-ndjson, application/json",
        },
        body: JSON.stringify(body),
        signal: ac.signal,
      });

      if (!res.ok) {
        let errText = `Generatie start mislukt (${res.status}).`;
        try {
          const j = (await res.json()) as { error?: string };
          if (typeof j.error === "string" && j.error.trim()) errText = j.error.trim();
        } catch {
          /* body was geen JSON */
        }
        setError(errText);
        return;
      }

      const ct = res.headers.get("content-type") ?? "";
      if (!ct.includes("ndjson") && !ct.includes("x-ndjson")) {
        try {
          const j = (await res.json()) as { error?: string };
          setError(
            typeof j.error === "string" && j.error.trim()
              ? j.error.trim()
              : "Onverwacht antwoordformaat (geen NDJSON-stream).",
          );
        } catch {
          setError("Onverwacht antwoordformaat van de server.");
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
      let sawComplete = false;
      let sawError = false;
      let pipelineSeen = false;
      let receivedAnySection = false;
      /** Laatste `stream_trace` in deze run (mutatie in `handleNdjsonEvent` ziet TS-CFA niet). */
      let lastStreamTrace: SiteGenerationStreamTraceSnapshot | null = null;

      const appendStreamLogChunk = (chunk: string) => {
        if (!chunk) return;
        setStreamLog((prev) => {
          const next = prev + chunk;
          return next.length <= SITE_STREAM_LOG_MAX_CHARS ? next : next.slice(next.length - SITE_STREAM_LOG_MAX_CHARS);
        });
      };

      const handleNdjsonEvent = (ev: GenerateSiteStreamNdjsonEvent) => {
        if (ev.type === "stream_trace") {
          lastStreamTrace = {
            runId: ev.runId,
            phase: ev.phase,
            offsetMs: ev.offsetMs,
            ...(ev.detail ? { detail: ev.detail } : {}),
          };
        }
        if (ev.type === "status") {
          const m = ev.message.trim();
          if (m) {
            setStreamPhase(m);
            appendGenerationActivity(m);
          }
        }
        if (ev.type === "generation_meta") {
          pipelineSeen = true;
          setPipelineFeedback(ev.feedback);
          setDesignRationaleLoading(true);
        }
        if (ev.type === "design_rationale") {
          const hasText = ev.text != null && ev.text.trim().length > 0;
          if (hasText) {
            setDesignRationale(ev.text!.trim());
            setDesignRationaleSkipReason(null);
          } else if (ev.skipReason?.trim()) {
            setDesignRationale(null);
            setDesignRationaleSkipReason(ev.skipReason.trim());
          }
          setDesignRationaleLoading(false);
          if (ev.contract != null) {
            setDesignContract(ev.contract);
            setDesignContractWarning(ev.contractWarning?.trim() || null);
          } else {
            setDesignContract(null);
            setDesignContractWarning(ev.contractWarning?.trim() || null);
          }
        }
        if (ev.type === "token") {
          streamJsonBufferRef.current += ev.content;
          appendStreamLogChunk(ev.content);
        }
        if (ev.type === "section_complete") {
          receivedAnySection = true;
          const sec = ev.section;
          const name = sec.sectionName?.trim() || sec.id;
          setStreamingSections((prev) => {
            const idx = prev.findIndex((s) => s.id === sec.id);
            const row: TailwindSection = { id: sec.id, sectionName: name, html: sec.html };
            if (idx >= 0) {
              const copy = [...prev];
              copy[idx] = { ...copy[idx], ...row };
              return copy;
            }
            return [...prev, row];
          });
        }
        if (ev.type === "complete") {
          if (ev.outputFormat === "tailwind_sections") {
            setGeneratedTailwind(ev.data);
            setStudioPreviewReadyFlash(true);
            setStreamEndedWithoutComplete(false);
            sawComplete = true;
            setStreamPhase("Generatie voltooid");
            appendGenerationActivity("Klaar — stream afgerond.");
          } else {
            sawError = true;
            setError("Alleen Tailwind-studio-output wordt in dit scherm ondersteund.");
          }
        }
        if (ev.type === "error") {
          sawError = true;
          setError(ev.message);
          if (ev.rawText) setRawFallback(ev.rawText);
        }
      };

      try {
        while (!sawComplete && !sawError) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer = consumeGenerateSiteNdjsonBuffer(
            buffer,
            decoder.decode(value, { stream: true }),
            handleNdjsonEvent,
          );
        }
        if (buffer.trim()) {
          buffer = consumeGenerateSiteNdjsonBuffer(buffer, "\n", handleNdjsonEvent);
        }
      } finally {
        await reader.cancel().catch(() => {});
        streamAbortRef.current = null;
      }

      if (!sawComplete && !sawError) {
        if (receivedAnySection) {
          setStreamEndedWithoutComplete(true);
          setStreamPhase("Stream gestopt vóór «klaar» — concept hieronder kan onvolledig zijn.");
          appendGenerationActivity("Geen complete-event; laatste tussentijdse secties worden getoond.");
          const tr = lastStreamTrace as SiteGenerationStreamTraceSnapshot | null;
          if (tr?.runId) {
            const detailSuffix =
              tr.detail != null && tr.detail.length > 0
                ? ` — ${tr.detail.length > 140 ? `${tr.detail.slice(0, 140)}…` : tr.detail}`
                : "";
            console.warn("[gentrix studio stream incomplete]", tr);
            appendGenerationActivity(
              `Diagnose (serverlogs): run ${tr.runId} — laatste fase «${tr.phase}» @ ${tr.offsetMs}ms${detailSuffix}. Zoek \`gentrix.generate_site_stream\` met dit id in Vercel/hosting.`,
            );
          } else {
            console.warn("[gentrix studio stream incomplete]", {
              noStreamTrace: true,
              pipelineSeen,
              receivedAnySection,
            });
            appendGenerationActivity(
              "Diagnose: geen stream-trace ontvangen — verbinding viel zeer vroeg af (netwerk/proxy/tab) of response werd afgebroken vóór de eerste trace.",
            );
          }
        } else {
          setError(
            pipelineSeen
              ? "Stream eindigde zonder resultaat (vaak time-out of netwerk). Probeer opnieuw of kort de briefing in."
              : "Stream eindigde onverwacht vóór interpretatie. Controleer netwerk en probeer opnieuw.",
          );
        }
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      if (e instanceof Error && e.name === "AbortError") return;
      setError("Netwerkfout of server niet bereikbaar.");
    } finally {
      streamAbortRef.current = null;
      setLoading(false);
      setDesignRationaleLoading(false);
      setRunStartedAtMs(null);
    }
  }

  const studioFollowUpSuggestions = useMemo(() => {
    if (!generatedTailwind || loading || conceptRefineLoading) return undefined;
    return [
      {
        id: "preview",
        label: "Bekijk preview",
        onClick: () => {
          setRightPaneMode("preview");
          setPanelLayout("split");
        },
      },
      {
        id: "strakker",
        label: "Strakker / zakelijk",
        onClick: () => {
          void runConceptRefinement("strakker_zakelijk");
        },
      },
      {
        id: "durf",
        label: "Durfder / editorial",
        onClick: () => {
          void runConceptRefinement("durfder_editorial");
        },
      },
      {
        id: "motion",
        label: "Meer beweging",
        onClick: () => {
          void runConceptRefinement("meer_beweging");
        },
      },
      {
        id: "transparante_navbar",
        label: "Transparante navbar",
        onClick: () => {
          void runConceptRefinement("transparante_navbar");
        },
      },
    ];
  }, [generatedTailwind, loading, conceptRefineLoading, runConceptRefinement]);

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

  const renderBriefingForm = (variant: "zen" | "studio") => {
    const zen = variant === "zen";
    const canSend = !descriptionLocked && briefingText.trim().length > 0 && !loading;
    const opdrachtBlock = (
      <div>
        {!loading ? (
          <div className="mb-2">
            <label
              htmlFor="studio-bedrijfsnaam"
              className="mb-0.5 block text-[11px] font-medium text-slate-600 dark:text-slate-400"
            >
              Bedrijfsnaam
            </label>
            <input
              id="studio-bedrijfsnaam"
              type="text"
              value={studioBedrijfsnaam}
              onChange={(e) => setStudioBedrijfsnaam(e.target.value)}
              disabled={descriptionLocked}
              autoComplete="organization"
              placeholder="bv. MoSham Barbershop"
              className={cn(
                "w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900 placeholder:text-slate-400",
                "focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20",
                "dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500",
                descriptionLocked && fieldLockedClass,
              )}
            />
            <p className="mt-0.5 text-[10px] leading-snug text-slate-500 dark:text-slate-500">
              Merknaam voor de AI en de <span className="font-medium">URL-slug</span> bij opslaan (kort, geen hele
              briefing).
            </p>
          </div>
        ) : null}
        {descriptionLocked ? (
          <p className="mt-1 text-xs text-slate-500">
            Briefing is beveiligd zodra er een concept-site is. HTML-aanpassingen: tab{" "}
            <strong className="font-medium text-slate-700 dark:text-slate-200">Bewerken</strong> (zelfde URL met slug).
          </p>
        ) : (
          <span id="studio-briefing-a11y-hint" className="sr-only">
            Plak URL&apos;s, tekst en referentie-afbeeldingen in het veld. Verstuur met de pijl-omhoog-knop of Ctrl+Enter.
          </span>
        )}
        <div
          onDrop={handleBriefingAreaDrop}
          onDragOver={(ev) => {
            if (!descriptionLocked) ev.preventDefault();
          }}
          className={cn(
            "relative mt-1.5 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-950",
            zen && "shadow-md",
            descriptionLocked && "opacity-90",
          )}
        >
          {!descriptionLocked ? (
            <div className="absolute right-2 top-2 z-[2]">
              <StudioThemeStylesHint />
            </div>
          ) : null}
          <div
            className={cn(
              "flex gap-2",
              !descriptionLocked ? "items-start pt-10 pr-14 pb-11 pl-2" : "p-2",
            )}
          >
            {!descriptionLocked && briefingImages.length > 0 ? (
              <div
                className="flex max-h-[min(160px,32vh)] shrink-0 flex-col gap-1.5 overflow-y-auto py-0.5"
                aria-label="Referentie-afbeeldingen bij deze opdracht"
              >
                {briefingImages.map((img, i) => (
                  <div
                    key={img.url || `b-${i}`}
                    className="group relative size-11 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-white dark:border-zinc-700"
                  >
                    {img.uploading ? (
                      <div className="flex size-full items-center justify-center">
                        <Loader2 className="size-3.5 animate-spin text-indigo-400" />
                      </div>
                    ) : (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={img.url} alt={img.label} className="size-full object-cover" />
                        <button
                          type="button"
                          disabled={descriptionLocked}
                          onClick={() => setBriefingImages((prev) => prev.filter((_, idx) => idx !== i))}
                          className="absolute -right-1 -top-1 rounded-full bg-zinc-900 p-0.5 text-white opacity-0 shadow hover:opacity-100 group-hover:opacity-100 dark:bg-zinc-100 dark:text-zinc-900"
                        >
                          <X className="size-3" />
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            ) : null}
            <textarea
              id="studioBriefing"
              name="studioBriefing"
              aria-describedby={descriptionLocked ? undefined : "studio-briefing-a11y-hint"}
              required={!descriptionLocked}
              maxLength={4000}
              rows={zen ? 8 : 5}
              value={briefingText}
              onChange={(e) => {
                if (descriptionLocked) return;
                setBriefingText(e.target.value);
              }}
              onPaste={handleDescriptionPaste}
              onKeyDown={(e) => {
                if (descriptionLocked || loading) return;
                if (e.key !== "Enter" || !(e.ctrlKey || e.metaKey)) return;
                e.preventDefault();
                if (!briefingText.trim()) return;
                e.currentTarget.form?.requestSubmit();
              }}
              readOnly={descriptionLocked}
              className={cn(
                "block min-w-0 flex-1 border-0 bg-transparent py-2.5 pl-1 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-zinc-100 dark:placeholder:text-zinc-500",
                !descriptionLocked ? "pr-1" : "pr-3",
                zen ? "min-h-[220px] resize-y" : "max-h-[min(36vh,220px)] min-h-[104px] resize-y overflow-y-auto",
                descriptionLocked && fieldLockedClass,
              )}
              placeholder={submittedPromptTurns.length > 0 ? "Volgende opdracht…" : "Ask GENTRIX…"}
            />
          </div>
          {!descriptionLocked ? (
            <button
              type="submit"
              disabled={!canSend}
              title={loading ? "Bezig met genereren…" : !briefingText.trim() ? "Vul eerst een opdracht in" : "Versturen"}
              aria-label={loading ? "Bezig met genereren" : "Verstuur opdracht"}
              className={cn(
                "absolute bottom-2 right-2 z-[2] inline-flex size-9 items-center justify-center rounded-full shadow-md transition-colors",
                "bg-indigo-600 text-white hover:bg-[#5558e8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white",
                "dark:focus-visible:ring-offset-zinc-950",
                (!canSend || loading) && "cursor-not-allowed opacity-50 hover:bg-indigo-600",
              )}
            >
              {loading ? (
                <Loader2 className="size-4 animate-spin shrink-0" aria-hidden />
              ) : (
                <ArrowUp className="size-4 shrink-0" aria-hidden />
              )}
            </button>
          ) : null}
        </div>
        {imageUploadError && !descriptionLocked ? (
          <p className="mt-1.5 text-xs text-red-600">{imageUploadError}</p>
        ) : null}
      </div>
    );

    return <form onSubmit={onSubmit}>{opdrachtBlock}</form>;
  };

  const showZenFirstRunComposer =
    !existingDraftLocked &&
    submittedPromptTurns.length === 0 &&
    !loading &&
    generatedTailwind == null;

  const renderPanels = () => (
      <ResizableEditorPanels
        storageKey="gentrix-studio-generator-sidebar-px"
        className="min-h-0 flex-1"
        visiblePanels={visiblePanelsProp}
        defaultSidebarPx={332}
        minSidebarPx={248}
        maxSidebarPx={4800}
        minMainPx={0}
        splitterTitle="Sleep naar rechts: smallere preview (tablet → mobiel); helemaal rechts verbergt de preview. Sleep naar links voor meer ruimte."
        sidebar={
          <div className="flex min-h-0 flex-1 flex-col gap-0 pr-1">
            {normalizedUrlSlug && isValidSubfolderSlug(normalizedUrlSlug) ? (
              <div className="mb-2 shrink-0">
                <StudioSupportStrip subfolderSlug={normalizedUrlSlug} />
              </div>
            ) : null}
            {editorFocusBar}
            <div
              ref={chatScrollRef}
              className="studio-sidebar-scroll-y min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-0.5 py-2"
              role="log"
              aria-label="Studio-gesprek: voortgang en opdrachten"
            >
              {!hideFaqLauncher ? (
                <div className="flex w-full justify-start">
                  <GeneratorStudioFaqLauncher />
                </div>
              ) : null}
              <div className="flex w-full justify-start">
                <p className="max-w-[min(100%,22rem)] text-[11px] leading-snug text-slate-500 dark:text-slate-400">
                  Korte of lange briefing: de Denklijn vult aan op de server. Uitgebreide uitleg:{" "}
                  {hideFaqLauncher ? (
                    <>
                      zie <strong className="font-medium text-slate-600 dark:text-slate-300">FAQ generatie</strong> in
                      de studio-balk.
                    </>
                  ) : (
                    <>
                      zie <strong className="font-medium text-slate-600 dark:text-slate-300">FAQ generatie</strong>{" "}
                      (knop hierboven).
                    </>
                  )}
                </p>
              </div>
              {submittedPromptTurns.map((turn) => (
                <div key={turn.id} className="flex w-full justify-end">
                  <div className="max-w-[min(100%,28rem)] whitespace-pre-wrap rounded-2xl rounded-br-md border border-indigo-100 bg-white px-3 py-2 text-sm leading-relaxed text-slate-900 shadow-sm dark:border-indigo-900/50 dark:bg-indigo-950/40 dark:text-zinc-100">
                    {turn.text}
                  </div>
                </div>
              ))}
              {loading ||
              pipelineFeedback != null ||
              generationActivity.length > 0 ||
              generatedTailwind != null ? (
                <div className="flex w-full justify-start">
                  <GenerationFeedbackPanel
                    surfaceVariant="conversation"
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
                    runStartedAtMs={runStartedAtMs}
                    followUpSuggestions={studioFollowUpSuggestions}
                  />
                </div>
              ) : null}
              {loading && (streamPhase != null || streamLog.length > 0) ? (
                <div className="flex w-full justify-start">
                  <button
                    type="button"
                    onClick={() => handleRightPaneModeChange("details")}
                    className="flex w-full max-w-[min(100%,26rem)] items-center gap-2 rounded-xl border border-zinc-200/70 bg-zinc-50/90 px-3 py-2.5 text-left text-xs text-zinc-800 shadow-sm transition-colors hover:bg-zinc-100/90 dark:border-zinc-700/80 dark:bg-zinc-900/70 dark:text-zinc-100 dark:hover:bg-zinc-800/80"
                  >
                    <span className="min-w-0 flex-1 leading-snug">
                      {streamPhase ? (
                        <>
                          <span className="font-medium text-zinc-600 dark:text-zinc-400">Fase</span>{" "}
                          <span className="text-zinc-900 dark:text-zinc-50">{streamPhase}</span>
                        </>
                      ) : streamLog.length > 0 ? (
                        <span className="text-zinc-700 dark:text-zinc-200">Ruwe stream actief — details rechts</span>
                      ) : (
                        <span className="text-zinc-700 dark:text-zinc-200">Bezig…</span>
                      )}
                    </span>
                    <ChevronRight
                      className="size-4 shrink-0 text-zinc-400 dark:text-zinc-500"
                      aria-hidden
                    />
                  </button>
                </div>
              ) : null}
              {error ? (
                <div className="flex w-full justify-start" role="alert">
                  <div className="w-full max-w-[min(100%,26rem)] space-y-2 rounded-2xl rounded-bl-md border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-50">
                    <div className="flex gap-2">
                      <AlertCircle className="size-4 shrink-0 text-red-600 dark:text-red-400" aria-hidden />
                      <div>
                        <p className="font-medium">Fout</p>
                        <p className="mt-1 text-xs leading-relaxed">{error}</p>
                      </div>
                    </div>
                    {rawFallback ? (
                      <details>
                        <summary className="cursor-pointer text-xs font-medium text-red-800 dark:text-red-200">
                          Ruwe model-output
                        </summary>
                        <pre className="mt-2 max-h-40 overflow-auto rounded border border-red-100 bg-white p-2 text-xs text-slate-800 dark:border-red-900/30 dark:bg-zinc-950 dark:text-zinc-100">
                          {rawFallback}
                        </pre>
                      </details>
                    ) : null}
                  </div>
                </div>
              ) : null}
              {generatedTailwind ? (
                <section className="w-full max-w-[min(100%,30rem)] space-y-4 border-t border-slate-200/80 pt-4 dark:border-zinc-700">
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">Volgende stappen</h2>
                  <p className="text-xs text-slate-600 dark:text-zinc-400">
                    Preview staat rechts — zelfde{" "}
                    <code className="rounded bg-slate-100 px-1 font-mono text-[11px] dark:bg-zinc-800">
                      PublishedSiteView
                    </code>{" "}
                    als <code className="rounded bg-slate-100 px-1 font-mono text-[11px] dark:bg-zinc-800">/site/…</code>{" "}
                    na opslaan. Thema:{" "}
                    <span className="font-mono">{generatedTailwind.config.theme.primary}</span> ·{" "}
                    <span className="font-mono">{generatedTailwind.config.theme.accent}</span> ·{" "}
                    {generatedTailwind.sections.length} secties
                  </p>
                  <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-3 dark:border-indigo-900/50 dark:bg-indigo-950/30">
                    <p className="text-xs font-medium text-indigo-950 dark:text-indigo-100">Concept verfijnen</p>
                    <p className="mt-1 text-[11px] leading-snug text-indigo-900/85 dark:text-indigo-200/90">
                      Lichte tweede pass via de editor-API: zelfde sectie-
                      <code className="font-mono text-[10px]">id</code>’s, alleen HTML-aanpassingen. Alleen de huidige
                      landingspagina ({generatedTailwind.sections.length} secties).
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
                      <button
                        type="button"
                        disabled={conceptRefineLoading || loading}
                        onClick={() => void runConceptRefinement("transparante_navbar")}
                        className="inline-flex items-center justify-center rounded-lg border border-indigo-200/90 bg-white px-2.5 py-1.5 text-[11px] font-medium text-indigo-950 shadow-sm hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-100 dark:hover:bg-indigo-900/80"
                      >
                        Transparante navbar
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
                    siteIrHints={detectedIndustryId ? { detectedIndustryId } : undefined}
                    defaultName={
                      studioBedrijfsnaam.trim() ||
                      (isStudioUndecidedBrandName(resolvedBusinessName) ? "" : resolvedBusinessName)
                    }
                    defaultDescription={briefingForDerivation}
                    defaultSubfolderSlug={slugFromUrl}
                    defaultPublishStatus="draft"
                    generatorMode
                    onSaved={onSiteSaved}
                  />
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => setShowJson((s) => !s)}
                      className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400"
                    >
                      <Code2 className="size-4" aria-hidden />
                      {showJson ? "Verberg JSON" : "Toon volledige JSON"}
                    </button>
                    {showJson && (
                      <pre className="mt-3 max-h-80 overflow-auto rounded-xl border border-slate-200 bg-slate-900 p-4 text-left text-xs text-slate-100 dark:border-zinc-700">
                        {JSON.stringify(generatedTailwind, null, 2)}
                      </pre>
                    )}
                  </div>
                </section>
              ) : null}
            </div>
            <div className="shrink-0 border-t border-slate-200 bg-white px-3 py-3 dark:border-zinc-800 dark:bg-zinc-950">
              {renderBriefingForm("studio")}
            </div>
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
                    <span>Preview</span>
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
                        live
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
                  fallbackBrief={{
                    businessName: displayStudioBrandNameForUi(resolvedBusinessName),
                    description: briefingForDerivation,
                  }}
                  referenceStyleRequested={Boolean(extractFirstHttpUrl(briefingForDerivation))}
                  designRationale={designRationale}
                  designRationaleLoading={designRationaleLoading}
                  designRationaleSkipReason={designRationaleSkipReason}
                  designContract={designContract}
                  designContractWarning={designContractWarning}
                  activityLog={generationActivity}
                  streamPhase={streamPhase}
                  loading={loading}
                  rawStreamLog={streamLog}
                  activityLogBrief={compactActivityLog}
                  onActivityLogBriefChange={setCompactActivityLog}
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
                      Bij de <strong className="font-medium text-zinc-800 dark:text-zinc-200">eerste</strong> generatie is
                      dit bewust geen live canvas — de preview vult pas als de run{" "}
                      <strong className="font-medium text-zinc-800 dark:text-zinc-200">volledig</strong> klaar is (zoals
                      o.a. Lovable).
                      <span className="mt-2 block text-[11px] text-zinc-500 dark:text-zinc-500">
                        Voortgang zie je in het <strong className="font-medium text-zinc-700 dark:text-zinc-300">gesprek links</strong>. Tik op <strong className="font-medium text-zinc-700 dark:text-zinc-300">›</strong> op de kaart voor tijdlijn en logboek rechts.
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
                  <div className="flex min-h-0 flex-1 items-center justify-center px-4 py-6">
                    <p className="max-w-sm text-center text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                      Zie het <span className="font-medium text-zinc-700 dark:text-zinc-300">gesprek links</span> voor
                      stap-voor-stap voortgang. Tik op <span className="font-medium text-zinc-700 dark:text-zinc-300">›</span>{" "}
                      op de kaart voor het volledige logboek rechts.
                    </p>
                  </div>
                </div>
              ) : generatorViewPayload ? (
                studioPreviewReadyFlash ? (
                  <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-5 px-6 py-12 text-center motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:duration-300">
                    <div className="flex size-16 items-center justify-center rounded-full bg-emerald-100 shadow-inner dark:bg-emerald-950/70">
                      <Check className="size-9 text-emerald-700 dark:text-emerald-300" strokeWidth={2.5} aria-hidden />
                    </div>
                    <div className="max-w-md space-y-2">
                      <p className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Klaar!</p>
                      <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{studioReadyFeedbackLine}</p>
                    </div>
                    <p className="text-xs font-medium text-indigo-700 dark:text-indigo-300">Preview opent zo…</p>
                  </div>
                ) : (
                  <div className="relative min-h-0 flex-1 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-500">
                    <PublishedSiteView
                      payload={generatorViewPayload}
                      className="min-h-0 flex-1"
                      publishedSlug={slugFromUrl}
                      draftPublicPreviewToken={draftPublicPreviewToken}
                      appointmentsEnabled={detectedModuleFlags.appointmentsEnabled}
                      webshopEnabled={detectedModuleFlags.webshopEnabled}
                    />
                  </div>
                )
              ) : (
                <div className="flex min-h-[min(360px,50dvh)] flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
                  <Monitor className="size-10 text-zinc-300 dark:text-zinc-600" aria-hidden />
                  <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Nog geen preview</p>
                  <p className="max-w-sm text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                    Vul links de opdracht in en tik op de <strong className="text-zinc-800 dark:text-zinc-200">pijl omhoog</strong>{" "}
                    (of Ctrl+Enter).
                    De eerste build vult dit paneel <strong className="text-zinc-800 dark:text-zinc-200">pas na afloop</strong>{" "}
                    (geen tussentijds canvas — vergelijkbaar met o.a. Lovable). Daarna: iteratief bewerken met directe
                    preview via tab <strong className="text-zinc-800 dark:text-zinc-200">Bewerken</strong> op dezelfde klant-slug.
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
      {showZenFirstRunComposer ? (
        <div className="flex min-h-0 flex-1 flex-col items-center overflow-auto bg-gradient-to-b from-zinc-50 via-white to-zinc-50/90 px-4 py-6 dark:from-zinc-950 dark:via-zinc-950 dark:to-zinc-950">
          <div className="w-full max-w-xl shrink-0 rounded-2xl border border-zinc-200/90 bg-white/95 p-6 shadow-md shadow-zinc-200/40 backdrop-blur-sm dark:border-zinc-700 dark:bg-zinc-900/90 dark:shadow-black/40">
            {renderBriefingForm("zen")}
          </div>
        </div>
      ) : portalReady && previewFullscreen
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

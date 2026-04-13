"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ChevronRight,
  Code2,
  ExternalLink,
  ImagePlus,
  Loader2,
  Maximize2,
  Minimize2,
  Monitor,
  Send,
  X,
} from "lucide-react";
import { StudioThemeStylesHint } from "@/components/admin/studio-theme-styles-hint";
import { DutchSpellcheckPanel } from "@/components/admin/dutch-spellcheck-panel";
import { GenerationFeedbackPanel } from "@/components/admin/generation-feedback-panel";
import { SaveSitePanel } from "@/components/admin/save-site-panel";
import { ResizableEditorPanels } from "@/components/admin/resizable-editor-panels";
import { PublishedSiteView } from "@/components/site/published-site-view";
import { STUDIO_GENERATION_PACKAGE } from "@/lib/ai/generation-packages";
import { postProcessTailwindSectionsForStreamingPreview } from "@/lib/ai/generate-site-postprocess";
import {
  slugifyToSectionId,
  type GeneratedTailwindPage,
  type TailwindPageConfig,
  type TailwindSection,
} from "@/lib/ai/tailwind-sections-schema";
import {
  tryExtractStreamingTailwindConfig,
} from "@/lib/ai/stream-json-section-extractor";
import { publishedPayloadFromParsed } from "@/lib/site/project-published-payload";
import { buildSiteIrV1 } from "@/lib/site/site-ir-schema";
import { consumeGenerateSiteNdjsonBuffer } from "@/lib/api/generate-site-stream-events";
import type { DesignGenerationContract } from "@/lib/ai/design-generation-contract";
import type { GenerateSiteStreamNdjsonEvent } from "@/lib/ai/generate-site-with-claude";
import type { GenerationPipelineFeedback } from "@/lib/api/generation-pipeline-feedback";
import { isValidSubfolderSlug } from "@/lib/slug";
import { buildStudioSiteOpenPreviewUrl } from "@/lib/site/build-studio-site-open-preview-url";
import { cn } from "@/lib/utils";

type ApiOk = { ok: true; outputFormat: "tailwind_sections"; data: GeneratedTailwindPage };
type ApiErr = { ok: false; error: string; rawText?: string };

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
};

export function GeneratorForm({
  initialSubfolderSlug,
  initialClientName,
  initialClientDescription,
  existingDraftLocked = false,
  onSiteSaved,
  draftPublicPreviewToken = null,
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
  /** Stream stopte zonder `complete` (vaak timeout/proxy) — toch laatste secties tonen. */
  const [streamEndedWithoutComplete, setStreamEndedWithoutComplete] = useState(false);

  const streamJsonBufferRef = useRef("");
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

  const previewIsStreaming = Boolean(streamEndedWithoutComplete && streamingSections.length > 0);
  const previewPendingUntilComplete = Boolean(loading && !generatedTailwind && !streamEndedWithoutComplete);

  const [clientImages, setClientImages] = useState<{ url: string; label: string; uploading?: boolean }[]>([]);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  const [referenceStyleUrl, setReferenceStyleUrl] = useState("");
  /** Geen marketingPages + contact in één run — merkbaar korter (minder timeout-risico). */
  const [landingPageOnly, setLandingPageOnly] = useState(false);
  /** Preview over heel scherm (Lovable-achtig), zonder iframe te herladen. */
  const [previewFullscreen, setPreviewFullscreen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    [slugFromUrl],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const files = Array.from(e.dataTransfer.files).slice(0, 8 - clientImages.length);
      for (const f of files) uploadFile(f);
    },
    [uploadFile, clientImages.length],
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []).slice(0, 8 - clientImages.length);
      for (const f of files) uploadFile(f);
      e.target.value = "";
    },
    [uploadFile, clientImages.length],
  );

  useEffect(() => {
    if (!slugFromUrl) return;
    setBusinessName(initialClientName?.trim() ?? "");
    if (existingDraftLocked) return;
    setDescription(initialClientDescription?.trim() ?? "");
  }, [slugFromUrl, initialClientName, initialClientDescription, existingDraftLocked]);

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
    setStreamEndedWithoutComplete(false);
    setGenerationActivity([]);
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
      const streamT0 = Date.now();
      const streamDiag = {
        counts: {} as Record<string, number>,
        sawComplete: false,
        sawErrorNdjson: false,
        lastType: "" as string,
      };
      const tickStreamDiag = (ev: GenerateSiteStreamNdjsonEvent) => {
        if (ev.type === "keepalive") return;
        streamDiag.lastType = ev.type;
        streamDiag.counts[ev.type] = (streamDiag.counts[ev.type] ?? 0) + 1;
        if (ev.type === "complete") streamDiag.sawComplete = true;
        if (ev.type === "error") streamDiag.sawErrorNdjson = true;
      };

      const handleNdjsonEvent = (ev: GenerateSiteStreamNdjsonEvent) => {
          tickStreamDiag(ev);
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

      // #region agent log
      void fetch("http://127.0.0.1:7380/ingest/00ec8e83-ff50-4a98-8102-2ae76b9c5e1c", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "688ece" },
        body: JSON.stringify({
          sessionId: "688ece",
          hypothesisId: streamDiag.sawComplete ? "OK" : "H2",
          location: "components/admin/generator-form.tsx:stream_reader_finished",
          message: "client NDJSON stream read loop exited",
          data: {
            streamStopped,
            sawComplete: streamDiag.sawComplete,
            sawErrorNdjson: streamDiag.sawErrorNdjson,
            resStatus: res.status,
            resOk: res.ok,
            elapsedMs: Date.now() - streamT0,
            counts: streamDiag.counts,
            lastType: streamDiag.lastType,
            bufferRemainderChars: buffer.length,
            endedWithoutComplete: !streamStopped,
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion

      await reader.cancel().catch(() => {});
    } catch (err) {
      // #region agent log
      void fetch("http://127.0.0.1:7380/ingest/00ec8e83-ff50-4a98-8102-2ae76b9c5e1c", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "688ece" },
        body: JSON.stringify({
          sessionId: "688ece",
          hypothesisId: "H3",
          location: "components/admin/generator-form.tsx:onSubmit_catch",
          message: "generate-site stream fetch/read threw",
          data: {
            errName: err instanceof Error ? err.name : "unknown",
            errMsg: err instanceof Error ? err.message.slice(0, 300) : String(err).slice(0, 300),
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
      setError("Netwerkfout of server niet bereikbaar.");
    } finally {
      setLoading(false);
      setDesignRationaleLoading(false);
    }
  }

  const descriptionLocked = existingDraftLocked || generatedTailwind != null;

  const fieldClass =
    "mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20";
  const fieldLockedClass =
    "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-600 placeholder:text-slate-400 focus:border-slate-200 focus:ring-0";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ResizableEditorPanels
        storageKey="gentrix-studio-generator-sidebar-px"
        className="min-h-0 flex-1"
        defaultSidebarPx={420}
        minSidebarPx={280}
        maxSidebarPx={560}
        minMainPx={480}
        sidebar={
          <div className="flex min-h-0 flex-col gap-5 pr-1">
            <form
              onSubmit={onSubmit}
              className="sales-os-glass-panel space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm md:p-8"
            >
        <p className="rounded-lg border border-emerald-100 bg-emerald-50/90 px-3 py-2 text-xs text-emerald-950">
          <strong>HTML + Tailwind</strong> — output is <code className="rounded bg-emerald-100 px-1">tailwind_sections</code>{" "}
          (secties met HTML); dezelfde weergave in studio, concept-preview en live{" "}
          <code className="rounded bg-emerald-100 px-1">/site/…</code>. Losse <strong>motion-promo</strong> (Remotion):{" "}
          <code className="rounded bg-emerald-100 px-1">npm run remotion:studio</code> · render:{" "}
          <code className="rounded bg-emerald-100 px-1">npm run remotion:render</code>.
        </p>

        <details className="group rounded-xl border border-slate-200 bg-slate-50/80 open:bg-slate-50">
          <summary className="cursor-pointer list-none px-3 py-2.5 text-sm font-medium text-slate-800 marker:hidden [&::-webkit-details-marker]:hidden">
            <span className="inline-flex items-center gap-2">
              <ChevronRight
                className="size-4 shrink-0 text-slate-500 transition-transform group-open:rotate-90"
                aria-hidden
              />
              FAQ: site genereren, blueprints &amp; studio-links
            </span>
          </summary>
          <div className="space-y-4 border-t border-slate-200 px-3 py-3 text-sm leading-relaxed text-slate-700">
            <section>
              <h3 className="text-sm font-semibold text-slate-900">Hoe genereer je?</h3>
              <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-xs">
                <li>
                  Vul <strong>bedrijfsnaam</strong> en <strong>omschrijving</strong> (briefing) in. Tip: gebruik het vraagteken
                  bij Omschrijving voor stijltermen en keywords.
                </li>
                <li>
                  Optioneel: <strong>klantfoto&apos;s</strong> en een <strong>referentiesite</strong> voor sfeer/layout.
                </li>
                <li>
                  Open je Site-studio via een klant (URL met <code className="rounded bg-slate-200 px-1 font-mono text-[11px]">slug</code>
                  )? Dan hoort die slug bij <strong>opslaan</strong> al te kloppen.
                </li>
                <li>
                  Klik <strong>Genereer site (HTML/Tailwind)</strong> en wacht tot de run klaar is; rechts zie je een{" "}
                  <strong>activiteitenlog</strong> en verschijnt de preview pas wanneer de generatie volledig afgerond is.
                </li>
                <li>
                  Controleer de preview rechts en sla op via het paneel linksonder (concept of publiceren). Zodra er een
                  concept is, wordt de briefing hier <strong>vastgezet</strong> — verdere tekstwijzigingen via de tab{" "}
                  <strong>Bewerken</strong> in site-studio.
                </li>
              </ol>
              <p className="mt-3 text-xs text-slate-600">
                <strong>Nieuwe volledige generaties</strong> (geen layout-upgrade) leveren een <strong>kleine site</strong>:
                homepage (<code className="font-mono text-[11px]">/site/…</code>) met vaste subpagina&apos;s + een{" "}
                <strong>aparte contactpagina</strong> met het formulier. De AI zet daarvoor o.a.{" "}
                <code className="font-mono text-[11px]">__STUDIO_SITE_BASE__</code> en{" "}
                <code className="font-mono text-[11px]">__STUDIO_CONTACT_PATH__</code> in de HTML; het platform vervangt
                die door echte paden. Ontbreekt het contactblok in de model-JSON, vult de server een veilige default aan —
                je ziet alsnog een werkende contactroute.
              </p>
            </section>
            <section>
              <h3 className="text-sm font-semibold text-slate-900">Blueprints vs. links in de HTML</h3>
              <p className="mt-2 text-xs text-slate-600">
                Dat loopt <strong>niet</strong> alleen via blueprints, en <strong>placeholders zijn niet weg</strong>: in
                opgeslagen sectie-HTML staan nog steeds vaste <strong>studio-tokens</strong> (zoals{" "}
                <code className="font-mono text-[11px]">__STUDIO_PORTAL_PATH__</code>,{" "}
                <code className="font-mono text-[11px]">__STUDIO_BOOKING_PATH__</code>,{" "}
                <code className="font-mono text-[11px]">__STUDIO_SHOP_PATH__</code> — en bij meerdere pagina&apos;s{" "}
                <code className="font-mono text-[11px]">__STUDIO_SITE_BASE__</code> /{" "}
                <code className="font-mono text-[11px]">__STUDIO_CONTACT_PATH__</code>).                 Met klant-slug in preview/live worden bestaande boek- en webshop-tokens in opgeslagen HTML omgezet naar{" "}
                <code className="font-mono text-[11px]">/boek/…</code> / <code className="font-mono text-[11px]">/winkel/…</code>{" "}
                (geen <code className="font-mono text-[11px]">#</code> daarvoor); CRM bepaalt of de module actief is of een inactive-pagina toont.{" "}
                <strong>Nieuwe generaties</strong> zetten die tokens niet meer automatisch in de output. Portaal kan bij export/preview nog{" "}
                <code className="font-mono text-[11px]">#</code> zijn.
              </p>
              <p className="mt-2 text-xs text-slate-600">
                Een <strong>blueprint</strong> in de project-snapshot (standaard{" "}
                <code className="font-mono text-[11px]">studio_marketing_single_page</code>) beschrijft daarnaast{" "}
                <strong>site-IR</strong>: welk type site + <strong>module-slots</strong> (o.a. portaal, boeken, webshop) —
                vooral <strong>structuur en validatie</strong>. Dat is <strong>geen</strong> vervanging van die tokens: IR en
                HTML lopen <strong>naast elkaar</strong>. Briefing + model bepalen nog steeds uitstraling en copy.
              </p>
            </section>
            <section>
              <h3 className="text-sm font-semibold text-slate-900">Boeken &amp; webshop — wat genereert de AI wél?</h3>
              <p className="mt-2 text-xs text-slate-600">
                De generator bouwt <strong>geen</strong> volledig maatwerk-checkout of agenda-app in HTML en voegt na de
                AI-run <strong>geen</strong> vaste secties <code className="font-mono text-[11px]">booking</code> /{" "}
                <code className="font-mono text-[11px]">shop</code> meer toe — die zet je per klant aan via{" "}
                <strong>Portaal-modules</strong> (schakelaars + knoppen “Standaard booking-/webshop-sectie”).{" "}
                <strong>Site-IR</strong> kan nog route-keys voor die modules bevatten voor validatie; CRM bepaalt zichtbaarheid en of{" "}
                <code className="font-mono text-[11px]">/boek/…</code> / <code className="font-mono text-[11px]">/winkel/…</code> actief is.
              </p>
            </section>
            <section>
              <h3 className="text-sm font-semibold text-slate-900">Wat zie je in de editor?</h3>
              <p className="mt-2 text-xs text-slate-600">
                In de <strong>bron</strong> (HTML-editor) blijven de <code className="font-mono text-[11px]">__STUDIO_…</code>
                -strings vaak <strong>zichtbaar</strong> in <code className="font-mono">href</code> — dat hoort zo. In{" "}
                <strong>preview en live</strong> worden ze omgezet; je ziet dan normale paden zoals{" "}
                <code className="font-mono text-[11px]">/portal/…</code>, <code className="font-mono text-[11px]">/boek/…</code>,{" "}
                <code className="font-mono text-[11px]">/winkel/…</code>. Zonder gepubliceerde slug kan de preview nog <code className="font-mono text-[11px]">#</code> tonen
                (geen klantcontext).
              </p>
            </section>
            <section>
              <h3 className="text-sm font-semibold text-slate-900">Wat doe jij ermee in de editor?</h3>
              <ul className="mt-2 list-disc space-y-1.5 pl-5 text-xs text-slate-600">
                <li>
                  <strong>Laat studio-tokens in href&apos;s staan</strong> (zoals <code className="font-mono text-[11px]">__STUDIO_BOOKING_PATH__</code>
                  ) als je wilt dat boek-, shop- en portaal-links automatisch naar het juiste pad voor <em>deze</em> klant blijven
                  wijzen na publicatie.
                </li>
                <li>
                  Alleen handmatig vervangen door concrete paden als je bewust één vaste link wilt; let op dat je dan geen
                  verkeerde slug gebruikt.
                </li>
                <li>
                  Zie je <code className="font-mono text-[11px]">#</code> in de preview: vaak omdat er nog geen klant-slug in de
                  context zit, of het gaat om portaal-export — niet als signaal dat boek/webshop-route &quot;weg&quot; is.
                </li>
              </ul>
            </section>
          </div>
        </details>

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
            rows={12}
            value={description}
            onChange={(e) => {
              if (descriptionLocked) return;
              setDescription(e.target.value);
            }}
            readOnly={descriptionLocked}
            className={cn(fieldClass, descriptionLocked && fieldLockedClass)}
            placeholder="Briefing: doelgroep, aanbod, USP’s, gewenste toon — wat moet de bezoeker doen (bellen, offerte, boeken)?"
          />
        </div>
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
            placeholder="https://…"
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
            <span className="font-medium text-slate-800">Compact: alleen landingspagina</span>
            <span className="mt-0.5 block text-xs font-normal text-slate-500">
              Sla de vaste vier marketing-subpagina&apos;s + contact-JSON over in deze run — veel korter en minder kans op
              stream-timeout. Subpagina&apos;s kun je later alsnog uitbreiden.
            </span>
          </label>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">
            Klantfoto&apos;s <span className="font-normal text-slate-400">(optioneel, max. 8)</span>
          </label>
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            className={cn(
              "mt-2 flex min-h-[72px] flex-wrap items-center gap-2 rounded-lg border-2 border-dashed border-slate-200 bg-slate-50/50 p-3",
              clientImages.length < 8 && "hover:border-indigo-300",
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
                      onClick={() => setClientImages((prev) => prev.filter((_, idx) => idx !== i))}
                      className="absolute -right-1 -top-1 hidden rounded-full bg-red-500 p-0.5 text-white shadow-sm group-hover:block"
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
                onClick={() => fileInputRef.current?.click()}
                className="flex size-16 shrink-0 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-slate-300 text-slate-400"
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
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>
          {imageUploadError ? <p className="mt-1 text-xs text-red-600">{imageUploadError}</p> : null}
        </div>

        <p className="rounded-lg border border-slate-200 bg-slate-50/90 px-3 py-2 text-xs text-slate-800">
          Output wordt gevalideerd tegen het <strong className="font-medium">tailwind_sections</strong>-schema; denklijn
          (rationale) gaat mee zoals voorheen. Optionele zelfreview staat standaard uit (
          <code className="rounded bg-slate-100 px-1">ENABLE_SITE_SELF_REVIEW=1</code>).
        </p>
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
              Genereer site (HTML/Tailwind)
            </>
          )}
        </button>
      </form>

      {pipelineFeedback ? (
        <GenerationFeedbackPanel
          feedback={pipelineFeedback}
          defaultOpen={loading || !generatedTailwind}
          designRationale={designRationale}
          designRationaleLoading={designRationaleLoading}
          designRationaleSkipReason={designRationaleSkipReason}
          designContract={designContract}
          designContractWarning={designContractWarning}
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
          <div
            className={cn(
              "flex min-h-0 min-w-0 flex-1 flex-col gap-2",
              previewFullscreen &&
                "fixed inset-0 z-[1000] gap-0 overflow-hidden bg-zinc-100 p-2 shadow-2xl dark:bg-zinc-950 sm:p-3",
            )}
          >
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
                <div className="flex shrink-0 items-center gap-1">
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
            {streamEndedWithoutComplete ? (
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
              {(loading && !activeStudioPreviewPayload) ||
              (!activeStudioPreviewPayload && error && generationActivity.length > 0) ? (
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
              ) : activeStudioPreviewPayload ? (
                <PublishedSiteView
                  payload={activeStudioPreviewPayload}
                  className="min-h-0 flex-1"
                  publishedSlug={slugFromUrl}
                  draftPublicPreviewToken={draftPublicPreviewToken}
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
              )}
            </div>
          </div>
        }
      />
    </div>
  );
}

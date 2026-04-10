"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, ChevronRight, Code2, ImagePlus, Loader2, Monitor, Send, X } from "lucide-react";
import { StudioThemeStylesHint } from "@/components/admin/studio-theme-styles-hint";
import { DutchSpellcheckPanel } from "@/components/admin/dutch-spellcheck-panel";
import { GenerationFeedbackPanel } from "@/components/admin/generation-feedback-panel";
import { SaveSitePanel } from "@/components/admin/save-site-panel";
import { PublishedSiteView } from "@/components/site/published-site-view";
import { STUDIO_GENERATION_PACKAGE } from "@/lib/ai/generation-packages";
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
import type { GenerateSiteStreamNdjsonEvent } from "@/lib/ai/generate-site-with-claude";
import type { GenerationPipelineFeedback } from "@/lib/api/generation-pipeline-feedback";
import { isValidSubfolderSlug } from "@/lib/slug";
import { cn } from "@/lib/utils";

type ApiOk = { ok: true; outputFormat: "tailwind_sections"; data: GeneratedTailwindPage };
type ApiErr = { ok: false; error: string; rawText?: string };

type GeneratorFormProps = {
  initialSubfolderSlug?: string;
  initialClientName?: string;
  initialClientDescription?: string | null;
  /** True als er al concept-site JSON in de DB staat (briefing lock). */
  existingDraftLocked?: boolean;
};

export function GeneratorForm({
  initialSubfolderSlug,
  initialClientName,
  initialClientDescription,
  existingDraftLocked = false,
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
  /** Stream stopte zonder `complete` (vaak timeout/proxy tijdens zelfreview) — toch laatste secties tonen. */
  const [streamEndedWithoutComplete, setStreamEndedWithoutComplete] = useState(false);

  const streamJsonBufferRef = useRef("");
  const [streamingSections, setStreamingSections] = useState<TailwindSection[]>([]);
  const [streamingConfig, setStreamingConfig] = useState<TailwindPageConfig | null>(null);

  const detectedIndustryId = pipelineFeedback?.interpreted?.detectedIndustryId;

  const streamingLivePreviewPayload = useMemo(() => {
    if (streamingSections.length === 0) return null;
    const sectionIdsOrdered = streamingSections.map((s, i) =>
      s.id ?? slugifyToSectionId(s.sectionName, i),
    );
    return publishedPayloadFromParsed(
      {
        kind: "tailwind",
        sections: streamingSections,
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

  const [clientImages, setClientImages] = useState<{ url: string; label: string; uploading?: boolean }[]>([]);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  const [referenceStyleUrl, setReferenceStyleUrl] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

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
          if (ev.type === "generation_meta") {
            setPipelineFeedback(ev.feedback);
            setDesignRationaleLoading(true);
            setDesignRationale(null);
            setDesignRationaleSkipReason(null);
          }
          if (ev.type === "design_rationale") {
            setDesignRationaleLoading(false);
            if (ev.text != null && ev.text.length > 0) {
              setDesignRationale(ev.text);
              setDesignRationaleSkipReason(null);
            } else {
              setDesignRationale(null);
              setDesignRationaleSkipReason(ev.skipReason ?? "onbekend");
            }
          }
          if (ev.type === "status") {
            setStreamPhase(ev.message);
          }
          if (ev.type === "token") {
            streamJsonBufferRef.current += ev.content;
            setStreamLog((prev) => (prev + ev.content).slice(-120_000));
          }
          if (ev.type === "section_complete") {
            const s = ev.section;
            const sectionName = s.sectionName?.trim() || s.id;
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
          "De verbinding met de server werd verbroken vóór de generatie kon worden afgerond (dit gebeurt soms tijdens de kwaliteitscontrole aan het eind). Hieronder staan de laatst ontvangen secties — genereer opnieuw om op te kunnen slaan.",
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

  const descriptionLocked = existingDraftLocked || generatedTailwind != null;

  const fieldClass =
    "mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20";
  const fieldLockedClass =
    "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-600 placeholder:text-slate-400 focus:border-slate-200 focus:ring-0";

  return (
    <div className="space-y-10">
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
              FAQ: zo genereer je een site & wat met placeholders?
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
                  Klik <strong>Genereer site (HTML/Tailwind)</strong> en wacht tot de stream klaar is; tijdens het genereren
                  kun je een live preview zien zodra secties binnenkomen.
                </li>
                <li>
                  Controleer de preview en sla op via het paneel onderaan (concept of publiceren). Zodra er een concept
                  is, wordt de briefing hier <strong>vastgezet</strong> — verdere tekstwijzigingen gaan via de{" "}
                  <strong>site-editor</strong>.
                </li>
              </ol>
            </section>
            <section>
              <h3 className="text-sm font-semibold text-slate-900">Slimme links (geen lelijke codes op de site)</h3>
              <p className="mt-2 text-xs text-slate-600">
                In de <code className="font-mono">href</code> van knoppen en menu&apos;s staan interne vaste tokens die het
                platform automatisch omzet naar het juiste pad per klant. In preview en live zie je dus normale URL&apos;s
                zoals <code className="font-mono text-[11px]">/portal/…</code>, <code className="font-mono text-[11px]">/boek/…</code>{" "}
                en <code className="font-mono text-[11px]">/winkel/…</code> — of een <code className="font-mono text-[11px]">#</code>{" "}
                als de bijbehorende module nog uit staat.
              </p>
            </section>
            <section>
              <h3 className="text-sm font-semibold text-slate-900">Wat doe jij ermee in de editor?</h3>
              <ul className="mt-2 list-disc space-y-1.5 pl-5 text-xs text-slate-600">
                <li>
                  <strong>Laat slimme links staan</strong> in de editor als je wilt dat portaal-, boek- en winkellinks
                  automatisch naar de juiste URL voor <em>deze</em> klant blijven wijzen.
                </li>
                <li>
                  Alleen handmatig vervangen door concrete paden als je bewust één vaste link wilt; let op dat je dan geen
                  verkeerde slug gebruikt.
                </li>
                <li>
                  Zie je <code className="font-mono text-[11px]">#</code> in de preview: vaak omdat een module (boeken/shop)
                  voor die site nog niet actief is — activeer de module of pas de copy/knoppen aan in de editor.
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
              Briefing is beveiligd zodra er een concept-site is of je net hebt gegenereerd. Gebruik de{" "}
              <strong className="font-medium text-slate-700">site-editor</strong> voor HTML-wijzigingen.
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
            placeholder="Briefing voor de studio…"
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
          (rationale) en zelfreview gaan mee zoals voorheen.
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
        />
      ) : null}

      {!generatedTailwind && streamingSections.length > 0 ? (
        <section className="space-y-3 border-t border-slate-200 pt-8">
          <div className="flex flex-wrap items-center gap-2">
            <Monitor className="size-5 text-indigo-500" aria-hidden />
            <h2 className="text-lg font-semibold text-slate-900">Live preview</h2>
            {loading ? (
              <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs text-indigo-900">tijdens generatie</span>
            ) : streamEndedWithoutComplete ? (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-950">stream afgebroken</span>
            ) : null}
          </div>
          {streamEndedWithoutComplete ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
              De verbinding werd verbroken vóór de server <strong>generatie voltooid</strong> meldde — vaak tijdens de
              kwaliteitscontrole (zelfreview) of net erna. Je ziet hieronder de laatst ontvangen secties; gebruik{" "}
              <strong>Genereer opnieuw</strong> om op te kunnen slaan.
            </p>
          ) : null}
          <p className="text-sm text-slate-600">
            Elke afgeronde sectie verschijnt hier in dezelfde web-preview als daarna. Zodra het model{" "}
            <code className="rounded bg-slate-100 px-1 text-xs">config</code> vóór{" "}
            <code className="rounded bg-slate-100 px-1 text-xs">sections</code> uitstuurt, worden thema en fonts
            meegenomen; anders tijdelijk neutrale defaults. Zelfreview en beeldverwerking aan het eind kunnen de finale
            pagina nog iets bijsturen.
          </p>
          <p className="text-xs text-slate-500">
            {streamingSections.length} sectie{streamingSections.length === 1 ? "" : "s"} binnen…
          </p>
          <div className="sales-os-glass-panel overflow-hidden rounded-xl border border-indigo-200 bg-white shadow-sm ring-1 ring-indigo-500/10">
            <PublishedSiteView
              payload={streamingLivePreviewPayload!}
              className="min-h-[min(70vh,800px)]"
              publishedSlug={slugFromUrl}
            />
          </div>
        </section>
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
        <section className="space-y-4 border-t border-slate-200 pt-10">
          <div className="flex flex-wrap items-center gap-2">
            <Monitor className="size-5 text-slate-500" aria-hidden />
            <h2 className="text-lg font-semibold text-slate-900">Preview</h2>
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-900">tailwind_sections</span>
          </div>
          <p className="text-sm text-slate-600">
            Zelfde weergave als <code className="rounded bg-slate-100 px-1 text-xs">/site/…</code> na opslaan.
          </p>
          <p className="text-xs text-slate-500">
            Primary <span className="font-mono">{generatedTailwind.config.theme.primary}</span> · accent{" "}
            <span className="font-mono">{generatedTailwind.config.theme.accent}</span> ·{" "}
            {generatedTailwind.sections.length} secties
          </p>
          <div className="sales-os-glass-panel overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <PublishedSiteView
              payload={completedGeneratorPreviewPayload!}
              className="min-h-[min(85vh,900px)]"
              publishedSlug={slugFromUrl}
            />
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
  );
}

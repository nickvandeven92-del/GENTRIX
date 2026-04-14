"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, Brain, Loader2, Sparkles, X } from "lucide-react";
import type { DesignGenerationContract } from "@/lib/ai/design-generation-contract";
import type { GenerationPipelineFeedback } from "@/lib/ai/generate-site-with-claude";

type GenerationFeedbackPanelProps = {
  feedback: GenerationPipelineFeedback;
  /** @deprecated Niet meer gebruikt; compacte weergave is standaard. */
  defaultOpen?: boolean;
  designRationale?: string | null;
  designRationaleLoading?: boolean;
  designRationaleSkipReason?: string | null;
  designContract?: DesignGenerationContract | null;
  designContractWarning?: string | null;
};

function buildCompactSummary(
  loading: boolean,
  rationale: string | null | undefined,
  skipReason: string | null | undefined,
  contract: DesignGenerationContract | null | undefined,
): string {
  if (loading) return "Denklijn wordt geschreven — even geduld.";
  if (rationale?.trim()) {
    const first = rationale.trim().split(/\n\n+/)[0] ?? rationale;
    return first.length > 280 ? `${first.slice(0, 277)}…` : first;
  }
  if (skipReason) return `Geen denklijn: ${skipReason}`;
  if (contract) {
    const bits = [contract.paletteMode, contract.motionLevel].filter(Boolean).join(" · ");
    return bits ? `Contract: ${bits}` : "Designcontract ontvangen.";
  }
  return "Pipeline geïnterpreteerd — open Details voor volledige Denklijn en contract.";
}

export function GenerationFeedbackPanel({
  feedback,
  designRationale = null,
  designRationaleLoading = false,
  designRationaleSkipReason = null,
  designContract = null,
  designContractWarning = null,
}: GenerationFeedbackPanelProps) {
  const { interpreted, model } = feedback;
  const [detailsOpen, setDetailsOpen] = useState(false);

  const summary = useMemo(
    () =>
      buildCompactSummary(
        designRationaleLoading,
        designRationale,
        designRationaleSkipReason,
        designContract,
      ),
    [designRationaleLoading, designRationale, designRationaleSkipReason, designContract],
  );

  useEffect(() => {
    if (!detailsOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDetailsOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [detailsOpen]);

  return (
    <>
      <div className="rounded-xl border border-indigo-200/80 bg-indigo-50/50 shadow-sm">
        <div className="flex items-start gap-3 px-3 py-3 sm:px-4">
          <Activity className="mt-0.5 size-4 shrink-0 text-indigo-600" aria-hidden />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-indigo-950">Denklijn</span>
              <span className="rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-normal text-indigo-800">
                {model}
              </span>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-indigo-950/90">{summary}</p>
          </div>
          <button
            type="button"
            onClick={() => setDetailsOpen(true)}
            className="shrink-0 rounded-lg border border-indigo-300/80 bg-white px-2.5 py-1.5 text-xs font-medium text-indigo-900 shadow-sm hover:bg-indigo-50"
          >
            Details
          </button>
        </div>
      </div>

      {detailsOpen ? (
        <div
          className="fixed inset-0 z-[200] flex justify-end bg-black/45 backdrop-blur-[1px]"
          role="presentation"
          onClick={() => setDetailsOpen(false)}
        >
          <div
            className="flex h-full w-full max-w-xl flex-col border-l border-indigo-200/80 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-950"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pipeline-details-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-indigo-200/70 px-4 py-3 dark:border-zinc-800">
              <h2 id="pipeline-details-title" className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
                Pipeline-details
              </h2>
              <button
                type="button"
                onClick={() => setDetailsOpen(false)}
                className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                aria-label="Sluiten"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              <p className="mb-4 text-xs text-indigo-900/85 dark:text-indigo-200/90">
                <strong className="font-medium">Denklijn</strong> en het{" "}
                <strong className="font-medium">designcontract</strong> worden in dezelfde run aan de generator (en
                zelfreview) gekoppeld — de briefing wint bij expliciete tegenstrijdigheid.
              </p>
              <div className="space-y-4">
                <section className="rounded-lg border border-violet-200/80 bg-violet-50/50 p-3 dark:border-violet-900/50 dark:bg-violet-950/30">
                  <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-violet-900 dark:text-violet-200">
                    <Brain className="size-3.5 shrink-0" aria-hidden />
                    Denklijn (AI)
                  </h3>
                  {designRationaleLoading ? (
                    <div className="mt-2 flex items-center gap-2 text-xs text-violet-900/80">
                      <Loader2 className="size-3.5 animate-spin shrink-0" aria-hidden />
                      Bezig met uitleg…
                    </div>
                  ) : designRationale ? (
                    <div className="mt-2 space-y-2 text-sm leading-relaxed text-violet-950 dark:text-violet-100">
                      {designRationale.split(/\n\n+/).map((para, i) => (
                        <p key={i}>{para.trim()}</p>
                      ))}
                    </div>
                  ) : designRationaleSkipReason ? (
                    <p className="mt-2 text-xs text-violet-800/90">
                      Geen denklijn: <span className="font-mono">{designRationaleSkipReason}</span>
                      {designRationaleSkipReason.includes("SKIP_DESIGN_RATIONALE") ? (
                        <span className="block pt-1 text-violet-700/80">
                          Tip: haal <code className="rounded bg-white/80 px-1 dark:bg-violet-900/50">SKIP_DESIGN_RATIONALE</code>{" "}
                          uit je env om dit weer aan te zetten.
                        </span>
                      ) : null}
                    </p>
                  ) : (
                    <p className="mt-2 text-xs text-violet-800/70">Nog geen denklijn voor deze run.</p>
                  )}
                  {designContractWarning ? (
                    <p className="mt-2 rounded-md border border-amber-200 bg-amber-50/90 px-2 py-1.5 text-xs text-amber-950">
                      Contractwaarschuwing: {designContractWarning}
                    </p>
                  ) : null}
                </section>

                {designContract ? (
                  <section className="rounded-lg border border-emerald-200/90 bg-emerald-50/40 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/25">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-emerald-950 dark:text-emerald-200">
                      Designcontract (bindend)
                    </h3>
                    <dl className="mt-2 grid gap-1.5 text-xs text-emerald-950 dark:text-emerald-100">
                      <div>
                        <dt className="text-emerald-800/80 dark:text-emerald-300/90">Hero-visueel</dt>
                        <dd className="font-medium">{designContract.heroVisualSubject}</dd>
                      </div>
                      {designContract.heroImageSearchHints ? (
                        <div>
                          <dt className="text-emerald-800/80 dark:text-emerald-300/90">Foto-zoekhints</dt>
                          <dd>{designContract.heroImageSearchHints}</dd>
                        </div>
                      ) : null}
                      <div>
                        <dt className="text-emerald-800/80 dark:text-emerald-300/90">Palett</dt>
                        <dd className="font-mono text-[11px]">
                          {designContract.paletteMode}
                          {designContract.primaryPaletteNotes ? ` — ${designContract.primaryPaletteNotes}` : ""}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-emerald-800/80 dark:text-emerald-300/90">Beeld MUST</dt>
                        <dd>{designContract.imageryMustReflect.join(", ")}</dd>
                      </div>
                      {designContract.imageryAvoid.length > 0 ? (
                        <div>
                          <dt className="text-emerald-800/80 dark:text-emerald-300/90">Beeld vermijden</dt>
                          <dd>{designContract.imageryAvoid.join(", ")}</dd>
                        </div>
                      ) : null}
                      <div>
                        <dt className="text-emerald-800/80 dark:text-emerald-300/90">Motion</dt>
                        <dd className="font-mono text-[11px]">{designContract.motionLevel}</dd>
                      </div>
                      {designContract.toneSummary ? (
                        <div>
                          <dt className="text-emerald-800/80 dark:text-emerald-300/90">Toon</dt>
                          <dd>{designContract.toneSummary}</dd>
                        </div>
                      ) : null}
                    </dl>
                    {designContract.referenceVisualAxes ? (
                      <div className="mt-3 border-t border-emerald-200/80 pt-3 dark:border-emerald-800/60">
                        <h4 className="text-[11px] font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                          Reference visual axes
                        </h4>
                        <dl className="mt-1.5 grid gap-1 text-[11px] text-emerald-950 dark:text-emerald-100">
                          <div className="grid grid-cols-[minmax(0,9rem)_1fr] gap-1">
                            <dt className="font-mono text-emerald-800/90">layoutRhythm</dt>
                            <dd className="font-mono">{designContract.referenceVisualAxes.layoutRhythm}</dd>
                          </div>
                          <div className="grid grid-cols-[minmax(0,9rem)_1fr] gap-1">
                            <dt className="font-mono text-emerald-800/90">themeMode</dt>
                            <dd className="font-mono">{designContract.referenceVisualAxes.themeMode}</dd>
                          </div>
                          <div className="sm:col-span-2">
                            <dt className="font-mono text-emerald-800/90">paletteIntent</dt>
                            <dd className="mt-0.5">{designContract.referenceVisualAxes.paletteIntent}</dd>
                          </div>
                          <div className="grid grid-cols-[minmax(0,9rem)_1fr] gap-1">
                            <dt className="font-mono text-emerald-800/90">typographyDirection</dt>
                            <dd className="font-mono">{designContract.referenceVisualAxes.typographyDirection}</dd>
                          </div>
                          <div className="sm:col-span-2">
                            <dt className="font-mono text-emerald-800/90">heroComposition</dt>
                            <dd className="mt-0.5">{designContract.referenceVisualAxes.heroComposition}</dd>
                          </div>
                          <div className="grid grid-cols-[minmax(0,9rem)_1fr] gap-1">
                            <dt className="font-mono text-emerald-800/90">sectionDensity</dt>
                            <dd className="font-mono">{designContract.referenceVisualAxes.sectionDensity}</dd>
                          </div>
                          <div className="grid grid-cols-[minmax(0,9rem)_1fr] gap-1">
                            <dt className="font-mono text-emerald-800/90">motionStyle</dt>
                            <dd className="font-mono">{designContract.referenceVisualAxes.motionStyle}</dd>
                          </div>
                          <div className="grid grid-cols-[minmax(0,9rem)_1fr] gap-1">
                            <dt className="font-mono text-emerald-800/90">borderTreatment</dt>
                            <dd className="font-mono">{designContract.referenceVisualAxes.borderTreatment}</dd>
                          </div>
                          <div className="grid grid-cols-[minmax(0,9rem)_1fr] gap-1">
                            <dt className="font-mono text-emerald-800/90">cardStyle</dt>
                            <dd className="font-mono">{designContract.referenceVisualAxes.cardStyle}</dd>
                          </div>
                        </dl>
                      </div>
                    ) : null}
                  </section>
                ) : null}

                <section className="rounded-lg border border-white/60 bg-white/70 p-3 dark:border-zinc-700 dark:bg-zinc-900/60">
                  <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-zinc-400">
                    <Sparkles className="size-3.5" aria-hidden />
                    Briefing (pipeline)
                  </h3>
                  <dl className="mt-2 grid gap-2 text-sm text-slate-800 dark:text-zinc-200 sm:grid-cols-2">
                    <div>
                      <dt className="text-xs text-slate-500 dark:text-zinc-500">Bedrijfsnaam</dt>
                      <dd className="text-xs font-medium">{interpreted.businessName}</dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="text-xs text-slate-500 dark:text-zinc-500">Beschrijving</dt>
                      <dd className="mt-0.5 whitespace-pre-wrap text-xs text-slate-700 dark:text-zinc-300">
                        {interpreted.description}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500 dark:text-zinc-500">Branche (pipeline)</dt>
                      <dd className="text-xs font-medium">
                        {interpreted.detectedIndustry ?? "—"}
                        {interpreted.detectedIndustryId ? (
                          <span className="ml-1 font-mono text-[11px] text-slate-500 dark:text-zinc-500">
                            ({interpreted.detectedIndustryId})
                          </span>
                        ) : null}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500 dark:text-zinc-500">Stijl (pipeline)</dt>
                      <dd className="text-xs font-medium">
                        {interpreted.detectedStyle ?? "—"}
                        {interpreted.detectedStyleId ? (
                          <span className="ml-1 font-mono text-[11px] text-slate-500 dark:text-zinc-500">
                            ({interpreted.detectedStyleId})
                          </span>
                        ) : null}
                      </dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="text-xs text-slate-500 dark:text-zinc-500">Stijl-bron</dt>
                      <dd className="font-mono text-[11px] text-slate-700 dark:text-zinc-300">
                        {interpreted.styleDetectionSource === "explicit_stijl_line"
                          ? "explicit_stijl_line — expliciete “Stijl …” in briefing"
                          : interpreted.styleDetectionSource === "keyword_match"
                            ? "keyword_match — trefwoorddetectie"
                            : interpreted.styleDetectionSource === "none"
                              ? "none — geen profiel (creatieve vrijheid)"
                              : "—"}
                      </dd>
                    </div>
                    {interpreted.referenceStyle ? (
                      <div className="sm:col-span-2">
                        <dt className="text-xs text-slate-500 dark:text-zinc-500">Referentiesite-URL</dt>
                        <dd className="break-all text-xs text-slate-800 dark:text-zinc-200">
                          <span className="font-mono text-[11px]">{interpreted.referenceStyle.requestedUrl}</span>
                          <span className="mt-1 block text-[11px] text-slate-600 dark:text-zinc-400">
                            {interpreted.referenceStyle.status === "ingested" ? (
                              <>
                                Ingelezen in prompt (~{interpreted.referenceStyle.excerptChars ?? "?"} tekens)
                                {interpreted.referenceStyle.finalUrl &&
                                interpreted.referenceStyle.finalUrl !== interpreted.referenceStyle.requestedUrl ? (
                                  <span className="block">Final URL: {interpreted.referenceStyle.finalUrl}</span>
                                ) : null}
                              </>
                            ) : (
                              <span className="text-amber-800 dark:text-amber-300">
                                Ophalen mislukt — {interpreted.referenceStyle.error ?? "onbekende fout"}
                              </span>
                            )}
                          </span>
                        </dd>
                      </div>
                    ) : null}
                    <div className="sm:col-span-2">
                      <dt className="text-xs text-slate-500 dark:text-zinc-500">Secties (volgorde)</dt>
                      <dd className="mt-0.5 font-mono text-xs">{interpreted.sections.join(" → ")}</dd>
                    </div>
                  </dl>
                </section>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

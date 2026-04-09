"use client";

import { Activity, Brain, Loader2, Sparkles } from "lucide-react";
import type { GenerationPipelineFeedback } from "@/lib/ai/generate-site-with-claude";

type GenerationFeedbackPanelProps = {
  feedback: GenerationPipelineFeedback;
  defaultOpen?: boolean;
  designRationale?: string | null;
  designRationaleLoading?: boolean;
  designRationaleSkipReason?: string | null;
};

export function GenerationFeedbackPanel({
  feedback,
  defaultOpen = true,
  designRationale = null,
  designRationaleLoading = false,
  designRationaleSkipReason = null,
}: GenerationFeedbackPanelProps) {
  const { interpreted, model } = feedback;

  return (
    <details
      open={defaultOpen}
      className="rounded-xl border border-indigo-200/80 bg-indigo-50/40 shadow-sm"
    >
      <summary className="cursor-pointer list-none px-4 py-3 [&::-webkit-details-marker]:hidden">
        <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-indigo-950">
          <Activity className="size-4 shrink-0 text-indigo-600" aria-hidden />
          Pipeline-feedback
          <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs font-normal text-indigo-800">
            {model}
          </span>
        </div>
        <p className="mt-1 text-xs font-normal text-indigo-900/80">
          Onder <strong className="font-medium">Denklijn</strong> staat hoe het
          model de briefing leest — handig om prompts gericht bij te sturen.
        </p>
      </summary>

      <div className="space-y-4 border-t border-indigo-200/60 px-4 pb-4 pt-3">
        <section className="rounded-lg border border-violet-200/80 bg-violet-50/50 p-3">
          <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-violet-900">
            <Brain className="size-3.5 shrink-0" aria-hidden />
            Denklijn (AI)
          </h3>
          {designRationaleLoading ? (
            <div className="mt-2 flex items-center gap-2 text-xs text-violet-900/80">
              <Loader2 className="size-3.5 animate-spin shrink-0" aria-hidden />
              Bezig met uitleg…
            </div>
          ) : designRationale ? (
            <div className="mt-2 space-y-2 text-sm leading-relaxed text-violet-950">
              {designRationale.split(/\n\n+/).map((para, i) => (
                <p key={i}>{para.trim()}</p>
              ))}
            </div>
          ) : designRationaleSkipReason ? (
            <p className="mt-2 text-xs text-violet-800/90">
              Geen denklijn: <span className="font-mono">{designRationaleSkipReason}</span>
              {designRationaleSkipReason.includes("SKIP_DESIGN_RATIONALE") ? (
                <span className="block pt-1 text-violet-700/80">
                  Tip: haal <code className="rounded bg-white/80 px-1">SKIP_DESIGN_RATIONALE</code> uit je env om dit
                  weer aan te zetten.
                </span>
              ) : null}
            </p>
          ) : (
            <p className="mt-2 text-xs text-violet-800/70">Nog geen denklijn voor deze run.</p>
          )}
        </section>

        <section className="rounded-lg border border-white/60 bg-white/70 p-3">
          <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
            <Sparkles className="size-3.5" aria-hidden />
            Briefing
          </h3>
          <dl className="mt-2 grid gap-2 text-sm text-slate-800 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-slate-500">Bedrijfsnaam</dt>
              <dd className="text-xs font-medium">{interpreted.businessName}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs text-slate-500">Beschrijving</dt>
              <dd className="mt-0.5 line-clamp-4 text-xs text-slate-700">{interpreted.description}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Branche (pipeline)</dt>
              <dd className="text-xs font-medium">
                {interpreted.detectedIndustry ?? "—"}
                {interpreted.detectedIndustryId ? (
                  <span className="ml-1 font-mono text-[11px] text-slate-500">({interpreted.detectedIndustryId})</span>
                ) : null}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Stijl (pipeline)</dt>
              <dd className="text-xs font-medium">
                {interpreted.detectedStyle ?? "—"}
                {interpreted.detectedStyleId ? (
                  <span className="ml-1 font-mono text-[11px] text-slate-500">({interpreted.detectedStyleId})</span>
                ) : null}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs text-slate-500">Stijl-bron</dt>
              <dd className="font-mono text-[11px] text-slate-700">
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
                <dt className="text-xs text-slate-500">Referentiesite-URL</dt>
                <dd className="break-all text-xs text-slate-800">
                  <span className="font-mono text-[11px]">{interpreted.referenceStyle.requestedUrl}</span>
                  <span className="mt-1 block text-[11px] text-slate-600">
                    {interpreted.referenceStyle.status === "ingested" ? (
                      <>
                        Ingelezen in prompt (~{interpreted.referenceStyle.excerptChars ?? "?"} tekens)
                        {interpreted.referenceStyle.finalUrl &&
                        interpreted.referenceStyle.finalUrl !== interpreted.referenceStyle.requestedUrl ? (
                          <span className="block">Final URL: {interpreted.referenceStyle.finalUrl}</span>
                        ) : null}
                      </>
                    ) : (
                      <span className="text-amber-800">
                        Ophalen mislukt — {interpreted.referenceStyle.error ?? "onbekende fout"}
                      </span>
                    )}
                  </span>
                </dd>
              </div>
            ) : null}
            <div className="sm:col-span-2">
              <dt className="text-xs text-slate-500">Secties (volgorde)</dt>
              <dd className="mt-0.5 font-mono text-xs">{interpreted.sections.join(" → ")}</dd>
            </div>
          </dl>
        </section>
      </div>
    </details>
  );
}

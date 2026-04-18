"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, Check, Circle, Sparkles } from "lucide-react";
import type { DesignGenerationContract } from "@/lib/ai/design-generation-contract";
import type { GenerationPipelineFeedback } from "@/lib/ai/generate-site-with-claude";

export type StudioRightPaneMode = "preview" | "details";

type GenerationFeedbackPanelProps = {
  feedback: GenerationPipelineFeedback | null;
  designRationale?: string | null;
  designRationaleLoading?: boolean;
  designRationaleSkipReason?: string | null;
  designContract?: DesignGenerationContract | null;
  designContractWarning?: string | null;
  /** Huidige modus van het rechterpaneel (preview vs details). */
  rightPaneMode: StudioRightPaneMode;
  onRightPaneModeChange: (mode: StudioRightPaneMode) => void;
  /** Server/stream logregels voor de kaart-subtitel. */
  activityLog?: { id: string; text: string }[];
  streamPhase?: string | null;
  loading?: boolean;
  /** Site succesvol ontvangen. */
  hasSiteOutput?: boolean;
  /** `Date.now()` bij start generatie — voor doorlooptijd-indicator. */
  runStartedAtMs?: number | null;
  /** Snelle vervolgacties na een geslaagde run (Lovable-achtige chips). */
  followUpSuggestions?: { id: string; label: string; onClick: () => void }[];
};

function buildCardSubtitle(
  loading: boolean,
  streamPhase: string | null | undefined,
  activityLog: { id: string; text: string }[] | undefined,
  rationale: string | null | undefined,
  skipReason: string | null | undefined,
  contract: DesignGenerationContract | null | undefined,
): string {
  if (streamPhase?.trim()) return streamPhase.trim();
  if (loading) return "Bezig met genereren…";
  const last = activityLog?.length ? activityLog[activityLog.length - 1]?.text?.trim() : "";
  if (last) return last.length > 200 ? `${last.slice(0, 197)}…` : last;
  if (rationale?.trim()) {
    const first = rationale.trim().split(/\n\n+/)[0] ?? rationale;
    return first.length > 160 ? `${first.slice(0, 157)}…` : first;
  }
  if (skipReason) return `Geen denklijn: ${skipReason}`;
  if (contract) {
    const bits = [contract.paletteMode, contract.motionLevel].filter(Boolean).join(" · ");
    return bits ? `Contract: ${bits}` : "Designcontract ontvangen.";
  }
  return "Volg de voortgang hieronder — Details opent het logboek rechts.";
}

export function GenerationFeedbackPanel({
  feedback,
  designRationale = null,
  designRationaleLoading = false,
  designRationaleSkipReason = null,
  designContract = null,
  designContractWarning = null,
  rightPaneMode,
  onRightPaneModeChange,
  activityLog = [],
  streamPhase = null,
  loading = false,
  hasSiteOutput = false,
  runStartedAtMs = null,
  followUpSuggestions,
}: GenerationFeedbackPanelProps) {
  const model = feedback?.model ?? "—";
  const [, setElapsedPulse] = useState(0);

  useEffect(() => {
    if (!loading || runStartedAtMs == null) return;
    const id = window.setInterval(() => setElapsedPulse((n) => n + 1), 500);
    return () => window.clearInterval(id);
  }, [loading, runStartedAtMs]);

  const elapsedSec =
    loading && runStartedAtMs != null
      ? Math.max(0, Math.floor((Date.now() - runStartedAtMs) / 1000))
      : null;

  const thinkingLabel =
    designRationaleLoading && elapsedSec != null
      ? `Denklijn… ${elapsedSec}s`
      : loading && elapsedSec != null && !hasSiteOutput
        ? `Bezig… ${elapsedSec}s`
        : null;

  const summary = useMemo(
    () =>
      buildCardSubtitle(
        loading,
        streamPhase,
        activityLog,
        designRationale,
        designRationaleSkipReason,
        designContract,
      ),
    [
      loading,
      streamPhase,
      activityLog,
      designRationale,
      designRationaleSkipReason,
      designContract,
    ],
  );

  const stepPipelineDone = Boolean(feedback);
  const stepDenklijnDone =
    !designRationaleLoading &&
    (Boolean(designRationale?.trim()) ||
      Boolean(designRationaleSkipReason) ||
      Boolean(designContract));
  const stepSiteDone = Boolean(hasSiteOutput);

  const checklist = [
    { id: "pipeline", label: "Briefing geïnterpreteerd (branche, stijl, structuur)", done: stepPipelineDone },
    { id: "denklijn", label: "Denklijn / designcontract", done: stepDenklijnDone },
    {
      id: "site",
      label: "Run afgerond (HTML + nabewerking)",
      done: stepSiteDone,
    },
  ] as const;

  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50/90 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/60">
      <div className="border-b border-zinc-200/90 px-3 py-2.5 dark:border-zinc-700">
        <div className="flex items-start gap-2">
          <Activity className="mt-0.5 size-4 shrink-0 text-indigo-600 dark:text-indigo-400" aria-hidden />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Site genereren</span>
              <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-normal text-zinc-600 shadow-sm dark:bg-zinc-800 dark:text-zinc-300">
                {model}
              </span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">{summary}</p>
            {thinkingLabel ? (
              <p className="mt-1.5 flex items-center gap-1.5 text-[11px] font-medium text-indigo-700 dark:text-indigo-300">
                <Sparkles className="size-3.5 shrink-0 text-indigo-500" aria-hidden />
                {thinkingLabel}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <ul className="space-y-2 px-3 py-3">
        {checklist.map((item) => (
          <li key={item.id} className="flex items-start gap-2 text-xs text-zinc-800 dark:text-zinc-200">
            <span className="mt-0.5 shrink-0" aria-hidden>
              {item.id === "denklijn" && designRationaleLoading ? (
                <Circle className="size-4 animate-pulse text-indigo-400" />
              ) : item.done ? (
                <Check className="size-4 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <Circle className="size-4 text-zinc-300 dark:text-zinc-600" />
              )}
            </span>
            <span className={item.done ? "text-zinc-800 dark:text-zinc-100" : "text-zinc-500 dark:text-zinc-400"}>
              {item.label}
            </span>
          </li>
        ))}
      </ul>

      {loading && !hasSiteOutput ? (
        <details className="mx-3 mb-2 text-[10px] text-zinc-500 dark:text-zinc-500">
          <summary className="cursor-pointer select-none text-zinc-600 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200">
            Technische stream
          </summary>
          <p className="mt-1 leading-snug">
            Het laatste vinkje volgt pas na nabewerking (o.a. stock). Lange stilte kan normaal zijn — de server werkt
            door.
          </p>
        </details>
      ) : null}

      {followUpSuggestions && followUpSuggestions.length > 0 ? (
        <div className="flex flex-wrap gap-2 border-t border-zinc-200/90 px-3 py-2.5 dark:border-zinc-700">
          {followUpSuggestions.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={s.onClick}
              className="rounded-full border border-indigo-200/90 bg-white px-3 py-1 text-[11px] font-medium text-indigo-950 shadow-sm transition-colors hover:bg-indigo-50 dark:border-indigo-800 dark:bg-zinc-900 dark:text-indigo-100 dark:hover:bg-indigo-950/80"
            >
              {s.label}
            </button>
          ))}
        </div>
      ) : null}

      {designContractWarning ? (
        <p className="mx-3 mb-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
          {designContractWarning}
        </p>
      ) : null}

      <div className="flex gap-2 border-t border-zinc-200/90 px-3 py-3 dark:border-zinc-700">
        <button
          type="button"
          onClick={() => onRightPaneModeChange("details")}
          className={cnPanelBtn(rightPaneMode === "details")}
        >
          Details
        </button>
        <button
          type="button"
          onClick={() => onRightPaneModeChange("preview")}
          className={cnPanelBtn(rightPaneMode === "preview", true)}
        >
          Preview
        </button>
      </div>
    </div>
  );
}

function cnPanelBtn(active: boolean, primary?: boolean) {
  return [
    "flex-1 rounded-lg px-3 py-2 text-center text-xs font-semibold transition-colors",
    primary
      ? active
        ? "bg-indigo-600 text-white shadow-sm hover:bg-indigo-500 dark:bg-indigo-600 dark:hover:bg-indigo-500"
        : "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
      : active
        ? "border border-indigo-300 bg-indigo-50 text-indigo-950 dark:border-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-100"
        : "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700",
  ].join(" ");
}

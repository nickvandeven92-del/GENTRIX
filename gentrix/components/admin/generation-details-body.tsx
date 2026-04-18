"use client";

import { Brain, Clock, Loader2, Sparkles } from "lucide-react";
import type { DesignGenerationContract } from "@/lib/ai/design-generation-contract";
import { SITE_SIGNATURE_ARCHETYPE_LABELS } from "@/lib/ai/site-signature-schema";
import type { GenerationPipelineFeedback } from "@/lib/ai/generate-site-with-claude";
import { briefGenerationActivityLabel } from "@/lib/studio/brief-generation-activity-label";

export type GenerationDetailsBodyProps = {
  feedback: GenerationPipelineFeedback | null;
  /** Als er nog geen `generation_meta` is (vroeg in de stream): toon formulierbriefing. */
  fallbackBrief?: { businessName: string; description: string };
  /** Zit er een optionele referentie-URL in het formulier (wel/niet referentiesite-fetch). */
  referenceStyleRequested?: boolean;
  designRationale?: string | null;
  designRationaleLoading?: boolean;
  designRationaleSkipReason?: string | null;
  designContract?: DesignGenerationContract | null;
  designContractWarning?: string | null;
  activityLog: { id: string; text: string }[];
  streamPhase?: string | null;
  loading?: boolean;
  /** Ruwe NDJSON/token-buffer (alleen tijdens stream); volledige weergave in dit paneel i.p.v. extra scroll in de sidebar. */
  rawStreamLog?: string | null;
  /** Beknopte milestone-regels i.p.v. volledige servertekst. */
  activityLogBrief?: boolean;
  onActivityLogBriefChange?: (brief: boolean) => void;
};

/**
 * Volledige inhoud voor het rechterpaneel “Details” (Lovable-achtige tijdlijn + Denklijn + contract + briefing).
 */
export function GenerationDetailsBody({
  feedback,
  fallbackBrief,
  referenceStyleRequested = false,
  designRationale = null,
  designRationaleLoading = false,
  designRationaleSkipReason = null,
  designContract = null,
  designContractWarning = null,
  activityLog,
  streamPhase,
  loading = false,
  rawStreamLog = null,
  activityLogBrief = false,
  onActivityLogBriefChange,
}: GenerationDetailsBodyProps) {
  const interpreted = feedback?.interpreted;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
      <p className="mb-4 text-xs text-indigo-900/85 dark:text-indigo-200/90">
        <strong className="font-medium">Denklijn</strong> en het <strong className="font-medium">designcontract</strong>{" "}
        worden in dezelfde run aan de generator (en zelfreview) gekoppeld — de briefing wint bij expliciete
        tegenstrijdigheid.
      </p>

      <div className="space-y-4">
        <section className="rounded-lg border border-slate-200 bg-slate-50/80 p-3 dark:border-zinc-700 dark:bg-zinc-900/50">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-zinc-300">
              <Clock className="size-3.5 shrink-0" aria-hidden />
              Tijdlijn
            </h3>
            {onActivityLogBriefChange ? (
              <label className="flex cursor-pointer select-none items-center gap-1.5 text-[10px] text-slate-600 dark:text-zinc-400">
                <input
                  type="checkbox"
                  className="size-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-zinc-600"
                  checked={activityLogBrief}
                  onChange={(e) => onActivityLogBriefChange(e.target.checked)}
                />
                Beknopt
              </label>
            ) : null}
          </div>
          {loading && activityLog.length === 0 ? (
            <div className="mt-2 flex items-center gap-2 text-xs text-slate-600 dark:text-zinc-400">
              <Loader2 className="size-3.5 animate-spin shrink-0" aria-hidden />
              Bezig met genereren…
            </div>
          ) : null}
          {streamPhase ? (
            <p className="mt-2 rounded-md bg-white/90 px-2 py-1.5 text-xs font-medium text-indigo-900 dark:bg-zinc-800/80 dark:text-indigo-100">
              Nu: {streamPhase}
            </p>
          ) : null}
          {rawStreamLog?.trim() ? (
            <details className="mt-3 rounded-md border border-slate-200 bg-white/90 dark:border-zinc-700 dark:bg-zinc-950/60">
              <summary className="cursor-pointer select-none px-2 py-1.5 text-[10px] font-medium text-slate-700 dark:text-zinc-300">
                Ruwe model-output (JSON-stream)
              </summary>
              <pre className="max-w-full overflow-x-auto whitespace-pre-wrap break-words border-t border-slate-200/80 p-2 font-mono text-[10px] leading-snug text-slate-800 dark:border-zinc-700 dark:text-zinc-200">
                {rawStreamLog}
              </pre>
            </details>
          ) : null}
          {activityLog.length === 0 && !loading ? (
            <p className="mt-2 text-xs text-slate-600 dark:text-zinc-400">Nog geen stappen — start een generatie.</p>
          ) : (
            <>
              <ol className="mt-2 space-y-2 border-l border-slate-200 pl-3 dark:border-zinc-600">
                {(activityLogBrief
                  ? activityLog
                      .map((row) => ({ id: row.id, text: briefGenerationActivityLabel(row.text) }))
                      .filter((row) => row.text.length > 0)
                  : activityLog
                ).map((row) => (
                  <li
                    key={row.id}
                    className="relative text-xs leading-snug text-slate-800 before:absolute before:-left-3 before:top-1.5 before:size-1.5 before:rounded-full before:bg-indigo-400 before:content-[''] dark:text-zinc-200 dark:before:bg-indigo-500"
                  >
                    {row.text}
                  </li>
                ))}
              </ol>
              {activityLogBrief && activityLog.length > 0 ? (
                <details className="mt-2 rounded-md border border-slate-200 bg-white/80 px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-900/40">
                  <summary className="cursor-pointer text-[10px] font-medium text-slate-600 dark:text-zinc-400">
                    Volledige serverregels ({activityLog.length})
                  </summary>
                  <ol className="mt-2 space-y-1.5 border-t border-slate-200/80 pt-2 dark:border-zinc-700">
                    {activityLog.map((row) => (
                      <li key={`full-${row.id}`} className="text-[10px] leading-snug text-slate-600 dark:text-zinc-400">
                        {row.text}
                      </li>
                    ))}
                  </ol>
                </details>
              ) : null}
            </>
          )}
        </section>

        <section className="rounded-lg border border-violet-200/80 bg-violet-50/50 p-3 dark:border-violet-900/50 dark:bg-violet-950/30">
          <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-violet-900 dark:text-violet-200">
            <Brain className="size-3.5 shrink-0" aria-hidden />
            Denklijn (AI)
          </h3>
          {designRationaleLoading ? (
            <div className="mt-2 space-y-2 text-xs text-violet-900/85 dark:text-violet-100/90">
              <div className="flex items-center gap-2">
                <Loader2 className="size-3.5 animate-spin shrink-0" aria-hidden />
                <span>
                  {interpreted
                    ? "Denklijn wordt uitgeschreven (aparte modelronde: NL-uitleg + JSON-designcontract)…"
                    : referenceStyleRequested
                      ? "Server bereidt de briefing voor (wachtrij, referentiesite, prompt); daarna volgt de denklijn…"
                      : "Server bereidt de briefing voor (wachtrij, prompt); daarna volgt de denklijn…"}
                </span>
              </div>
              {streamPhase ? (
                <p className="rounded-md bg-white/70 px-2 py-1.5 text-[11px] font-medium text-violet-950 dark:bg-violet-950/40 dark:text-violet-100">
                  Stap: {streamPhase}
                </p>
              ) : null}
              <p className="leading-relaxed text-violet-900/80 dark:text-violet-200/85">
                De tekst verschijnt <strong className="font-medium">in één keer</strong> zodra die ronde klaar is — er is
                (nog) geen woord-voor-woord live stream van de denklijn. De tijdlijn hierboven en{" "}
                <strong className="font-medium">Stap:</strong> komen uit dezelfde NDJSON-stream als de site-generatie.
              </p>
              {interpreted ? (
                <p className="leading-relaxed text-violet-900/80 dark:text-violet-200/85">
                  Je kunt nu al sturen op basis van <strong className="font-medium">Briefing (pipeline)</strong>{" "}
                  hieronder (branche, sectievolgorde, referentie) — dat is dezelfde interpretatie die straks aan de
                  bouw-prompt hangt.
                </p>
              ) : null}
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
                  Deze skip-melding hoort bij een oude omgevingsinstelling; de studio draait de Denklijn standaard weer
                  volledig. Vernieuw de pagina na deploy of negeer deze regel.
                </span>
              ) : null}
            </p>
          ) : (
            <p className="mt-2 text-xs text-violet-800/70">
              Nog geen denklijn zichtbaar. Bij de standaardmodus (job op de server) wordt de tekst eerst weggeschreven en
              verschijnt hij hier na de volgende sync — even geduld. Live woord-voor-woord kan, als beheer de
              stream-modus op de server inschakelt.
            </p>
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
            {designContract.siteSignature ? (
              <div className="mt-3 border-t border-emerald-200/80 pt-3 dark:border-emerald-800/60">
                <h4 className="text-[11px] font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                  Site-signatuur
                </h4>
                <dl className="mt-1.5 grid gap-1.5 text-[11px] text-emerald-950 dark:text-emerald-100">
                  <div>
                    <dt className="text-emerald-800/80 dark:text-emerald-300/90">Archetype</dt>
                    <dd className="font-mono text-[11px]">{designContract.siteSignature.archetype}</dd>
                    <dd className="mt-0.5 text-emerald-900/95 dark:text-emerald-100/95">
                      {SITE_SIGNATURE_ARCHETYPE_LABELS[designContract.siteSignature.archetype]}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-emerald-800/80 dark:text-emerald-300/90">Commitment</dt>
                    <dd className="mt-0.5 leading-snug">{designContract.siteSignature.commitment_nl}</dd>
                  </div>
                  {designContract.siteSignature.anti_templates_nl.length > 0 ? (
                    <div>
                      <dt className="text-emerald-800/80 dark:text-emerald-300/90">Anti-templates</dt>
                      <dd>
                        <ul className="mt-0.5 list-inside list-disc space-y-0.5 leading-snug">
                          {designContract.siteSignature.anti_templates_nl.map((line, i) => (
                            <li key={i}>{line}</li>
                          ))}
                        </ul>
                      </dd>
                    </div>
                  ) : null}
                </dl>
              </div>
            ) : null}
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

        {interpreted ? (
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
        ) : fallbackBrief ? (
          <section className="rounded-lg border border-amber-200/80 bg-amber-50/50 p-3 dark:border-amber-900/40 dark:bg-amber-950/25">
            <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-950 dark:text-amber-200">
              <Sparkles className="size-3.5" aria-hidden />
              Briefing (formulier)
            </h3>
            <p className="mt-2 text-xs text-amber-950/90 dark:text-amber-100/90">
              Er is nog geen pipeline-interpretatie (JSON) van de server binnengekomen — bijvoorbeeld net na start of
              vóór het eerste stream-event. Hieronder wat je in het formulier hebt ingevuld.
            </p>
            <dl className="mt-2 grid gap-2 text-sm text-slate-800 dark:text-zinc-200">
              <div>
                <dt className="text-xs text-slate-500 dark:text-zinc-500">Bedrijfsnaam</dt>
                <dd className="text-xs font-medium">{fallbackBrief.businessName}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500 dark:text-zinc-500">Beschrijving</dt>
                <dd className="mt-0.5 whitespace-pre-wrap text-xs text-slate-700 dark:text-zinc-300">
                  {fallbackBrief.description}
                </dd>
              </div>
            </dl>
          </section>
        ) : null}
      </div>
    </div>
  );
}

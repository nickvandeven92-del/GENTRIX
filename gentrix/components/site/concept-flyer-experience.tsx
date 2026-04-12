"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";

type ConceptFlyerExperienceProps = {
  siteLabel: string;
  slug: string;
  appointmentsEnabled: boolean;
  webshopEnabled: boolean;
};

function readFlyerEnv() {
  return {
    meetingUrl: process.env.NEXT_PUBLIC_STUDIO_MEETING_URL?.trim() ?? "",
    quoteUrl: process.env.NEXT_PUBLIC_STUDIO_QUOTE_URL?.trim() ?? "",
    email: process.env.NEXT_PUBLIC_STUDIO_CONTACT_EMAIL?.trim() ?? "",
  };
}

export function ConceptFlyerExperience({
  siteLabel,
  slug,
  appointmentsEnabled,
  webshopEnabled,
}: ConceptFlyerExperienceProps) {
  const { meetingUrl, quoteUrl, email } = readFlyerEnv();
  const storageKey = useMemo(() => `gentrix-flyer-tour-${slug}`, [slug]);
  const [dismissedBar, setDismissedBar] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(storageKey) === "1") {
        setStep(-1);
      }
    } catch {
      /* ignore */
    }
  }, [storageKey]);

  const finishTour = useCallback(() => {
    try {
      sessionStorage.setItem(storageKey, "1");
    } catch {
      /* ignore */
    }
    setStep(-1);
  }, [storageKey]);

  const mailStudio = useCallback(
    (subject: string) => {
      if (!email) return;
      window.location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}`;
    },
    [email],
  );

  const hasAnyCta = Boolean(meetingUrl || quoteUrl || email);

  const steps: { title: string; body: string }[] = [
    {
      title: "Welkom bij je concept",
      body: `Dit is een voorbeeld van ${siteLabel}. Zo ziet de site er ongeveer uit voor bezoekers.`,
    },
    {
      title: "Rondkijken",
      body: "Scroll door de pagina en gebruik het menu zoals je klanten dat zouden doen. Dit is nog geen definitieve live-versie.",
    },
    ...(appointmentsEnabled || webshopEnabled
      ? [
          {
            title: "Extra’s",
            body: [
              appointmentsEnabled ? "Online afspraken/boeken kan ingeschakeld zijn." : null,
              webshopEnabled ? "Een webshop-link kan onderdeel zijn van je pakket." : null,
            ]
              .filter(Boolean)
              .join(" "),
          },
        ]
      : []),
    {
      title: "Volgende stap",
      body: "Plan een gesprek of vraag een offerte aan — dan maken we het samen af.",
    },
  ];

  const showOverlay = step >= 0 && step < steps.length;

  const ctaClass =
    "rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700";
  const ctaPrimaryClass =
    "rounded-lg border border-emerald-600/40 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-950 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100 dark:hover:bg-emerald-950/70";

  return (
    <>
      {!dismissedBar ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex justify-center p-3 sm:p-4">
          <div className="pointer-events-auto flex max-w-lg flex-col gap-2 rounded-2xl border border-zinc-200 bg-white/95 p-4 shadow-lg backdrop-blur-sm dark:border-zinc-700 dark:bg-zinc-900/95">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Concept-preview</p>
              <button
                type="button"
                className="rounded-lg p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                aria-label="Balk sluiten"
                onClick={() => setDismissedBar(true)}
              >
                <X className="size-4" />
              </button>
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              Scan je deze pagina via een flyer-QR? Start de korte rondleiding of ga direct naar contact.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-lg bg-zinc-900 px-3 py-2 text-xs font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
                onClick={() => setStep(0)}
              >
                Start rondleiding
              </button>
              {meetingUrl ? (
                <a href={meetingUrl} target="_blank" rel="noopener noreferrer" className={ctaClass}>
                  Gesprek plannen
                </a>
              ) : email ? (
                <button type="button" className={ctaClass} onClick={() => mailStudio("Gesprek aanvragen — website concept")}>
                  Gesprek aanvragen
                </button>
              ) : null}
              {quoteUrl ? (
                <a href={quoteUrl} target="_blank" rel="noopener noreferrer" className={ctaPrimaryClass}>
                  Offerte / kopen
                </a>
              ) : email ? (
                <button type="button" className={ctaPrimaryClass} onClick={() => mailStudio("Offerte / aankoop website")}>
                  Offerte / kopen
                </button>
              ) : null}
            </div>
            {!hasAnyCta ? (
              <p className="text-[11px] text-amber-800 dark:text-amber-200">
                Zet <code className="rounded bg-amber-100/80 px-1 dark:bg-amber-900/50">NEXT_PUBLIC_STUDIO_MEETING_URL</code>,{" "}
                <code className="rounded bg-amber-100/80 px-1 dark:bg-amber-900/50">NEXT_PUBLIC_STUDIO_QUOTE_URL</code> of{" "}
                <code className="rounded bg-amber-100/80 px-1 dark:bg-amber-900/50">NEXT_PUBLIC_STUDIO_CONTACT_EMAIL</code>{" "}
                voor knoppen hier.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {showOverlay ? (
        <div
          className="fixed inset-0 z-[110] flex items-end justify-center bg-black/45 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="flyer-tour-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">
            <h2 id="flyer-tour-title" className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              {steps[step]?.title}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">{steps[step]?.body}</p>
            {step === steps.length - 1 && hasAnyCta ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {meetingUrl ? (
                  <a href={meetingUrl} target="_blank" rel="noopener noreferrer" className={ctaClass}>
                    Gesprek plannen
                  </a>
                ) : email ? (
                  <button type="button" className={ctaClass} onClick={() => mailStudio("Gesprek — website concept")}>
                    Gesprek mailen
                  </button>
                ) : null}
                {quoteUrl ? (
                  <a href={quoteUrl} target="_blank" rel="noopener noreferrer" className={ctaPrimaryClass}>
                    Offerte / kopen
                  </a>
                ) : email ? (
                  <button type="button" className={ctaPrimaryClass} onClick={() => mailStudio("Offerte / aankoop website")}>
                    Offerte mailen
                  </button>
                ) : null}
              </div>
            ) : null}
            <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                className="text-sm font-medium text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                onClick={finishTour}
              >
                Overslaan
              </button>
              <div className="flex gap-2">
                {step > 0 ? (
                  <button
                    type="button"
                    className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-100 dark:hover:bg-zinc-800"
                    onClick={() => setStep((s) => Math.max(0, s - 1))}
                  >
                    Terug
                  </button>
                ) : null}
                {step < steps.length - 1 ? (
                  <button
                    type="button"
                    className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
                    onClick={() => setStep((s) => s + 1)}
                  >
                    Volgende
                  </button>
                ) : (
                  <button
                    type="button"
                    className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
                    onClick={finishTour}
                  >
                    Klaar
                  </button>
                )}
              </div>
            </div>
            <p className="mt-3 text-center text-xs text-zinc-400">
              Stap {step + 1} van {steps.length}
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}

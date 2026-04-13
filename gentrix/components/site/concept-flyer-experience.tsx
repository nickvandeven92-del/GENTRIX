"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { Calendar, HelpCircle, ShoppingBag, X } from "lucide-react";
import { PUBLIC_STUDIO_CONTACT_EMAIL } from "@/lib/constants";
import { buildPublicStudioOrderHref } from "@/lib/studio-order/build-public-order-href";

type ConceptFlyerExperienceProps = {
  siteLabel: string;
  slug: string;
  appointmentsEnabled: boolean;
  webshopEnabled: boolean;
  /** Concept-previewtoken (zelfde als `?token=` op de site) voor link naar bestelpagina. */
  previewToken?: string | null;
  /** `flyer=1` behouden op bestel-URL (flyer-flow). */
  preserveFlyerQuery?: boolean;
};

export type FlyerStudioCtaConfig = {
  meetingUrl: string;
  /** Bestel-/checkout-link; leeg = val terug op `quoteUrl`. */
  checkoutUrl: string;
  quoteUrl: string;
  /** Effectief mailto-adres (env of `PUBLIC_STUDIO_CONTACT_EMAIL`). */
  email: string;
};

/**
 * Publieke studio-CTA’s (flyer / concept `?flyer=1`). Zelfde keys als `readFlyerEnv()`;
 * bruikbaar als je server-side wilt doorgeven i.p.v. build-time env.
 */
export function readFlyerStudioCtaEnv(): FlyerStudioCtaConfig {
  const meetingUrl = process.env.NEXT_PUBLIC_STUDIO_MEETING_URL?.trim() ?? "";
  const quoteUrl = process.env.NEXT_PUBLIC_STUDIO_QUOTE_URL?.trim() ?? "";
  const checkoutDirect = process.env.NEXT_PUBLIC_STUDIO_CHECKOUT_URL?.trim() ?? "";
  const checkoutUrl = checkoutDirect || quoteUrl;
  const emailFromEnv = process.env.NEXT_PUBLIC_STUDIO_CONTACT_EMAIL?.trim() ?? "";
  const email = emailFromEnv || PUBLIC_STUDIO_CONTACT_EMAIL.trim() || "hello@example.com";
  return { meetingUrl, checkoutUrl, quoteUrl, email };
}

function readFlyerEnv() {
  return readFlyerStudioCtaEnv();
}

export function ConceptFlyerExperience({
  siteLabel,
  slug,
  appointmentsEnabled,
  webshopEnabled,
  previewToken = null,
  preserveFlyerQuery = false,
}: ConceptFlyerExperienceProps) {
  const { meetingUrl, email: contactEmail } = readFlyerEnv();
  const externalOrderUrl = process.env.NEXT_PUBLIC_STUDIO_CHECKOUT_URL?.trim() ?? "";
  const orderHref = useMemo(() => {
    if (externalOrderUrl) return externalOrderUrl;
    return buildPublicStudioOrderHref(slug, {
      previewToken: previewToken?.trim() || undefined,
      flyer: preserveFlyerQuery,
    });
  }, [externalOrderUrl, slug, previewToken, preserveFlyerQuery]);
  const orderIsExternal = Boolean(externalOrderUrl);
  const storageKey = useMemo(() => `gentrix-flyer-tour-${slug}`, [slug]);
  const [dismissedBar, setDismissedBar] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [step, setStep] = useState(0);

  /**
   * Concept-flyer preview: rondleiding meteen open (vóór paint waar mogelijk), behalve als
   * de bezoeker deze sessie al op Klaar/Overslaan heeft afgerond (`sessionStorage`).
   */
  useLayoutEffect(() => {
    try {
      if (sessionStorage.getItem(storageKey) === "1") {
        setTourOpen(false);
        setStep(0);
        setDismissedBar(true);
        return;
      }
    } catch {
      /* private mode / storage geblokkeerd → gewoon starten */
    }
    setTourOpen(true);
    setStep(0);
  }, [storageKey]);

  const finishTour = useCallback(() => {
    try {
      sessionStorage.setItem(storageKey, "1");
    } catch {
      /* ignore */
    }
    setTourOpen(false);
    setStep(0);
    setDismissedBar(true);
  }, [storageKey]);

  const mailStudio = useCallback(
    (subject: string) => {
      window.location.href = `mailto:${contactEmail}?subject=${encodeURIComponent(subject)}`;
    },
    [contactEmail],
  );

  const hasMeetingCta = Boolean(meetingUrl || contactEmail);
  const hasAnyCta = true;

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
      body: "Ga door naar bestellen of plan een persoonlijk gesprek — dan maken we het samen af.",
    },
  ];

  const showOverlay = tourOpen && step >= 0 && step < steps.length;
  const showFloatingActions = hasAnyCta && !showOverlay;
  const showBottomIntroBar = !dismissedBar && !showOverlay;

  const fabWrap =
    "pointer-events-auto flex max-w-[min(100vw-2rem,18rem)] flex-col gap-2 rounded-2xl border border-zinc-200/90 bg-white/95 p-2 shadow-xl backdrop-blur-sm dark:border-zinc-600/90 dark:bg-zinc-900/95";
  const fabPrimary =
    "inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-emerald-600/50 bg-emerald-600 px-4 py-2.5 text-center text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-600 dark:hover:bg-emerald-500";
  const fabSecondary =
    "inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-center text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700";

  useEffect(() => {
    if (!showOverlay) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [showOverlay]);

  useEffect(() => {
    if (!showOverlay) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finishTour();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showOverlay, finishTour]);

  const ctaClass =
    "rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700";
  const ctaPrimaryClass =
    "rounded-lg border border-emerald-600/40 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-950 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100 dark:hover:bg-emerald-950/70";

  return (
    <>
      {showBottomIntroBar ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[10030] flex justify-center p-3 sm:p-4">
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
              Je ziet een conceptversie van de site. Rechtsonder kun je bestellen of een persoonlijk gesprek plannen.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-lg bg-zinc-900 px-3 py-2 text-xs font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
                onClick={() => {
                  setStep(0);
                  setTourOpen(true);
                }}
              >
                Rondleiding opnieuw
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showOverlay ? (
        <div
          className="fixed inset-0 z-[10060] flex items-end justify-center bg-black/45 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="flyer-tour-title"
          onClick={() => finishTour()}
        >
          <div
            className="pointer-events-auto w-full max-w-md touch-manipulation rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl dark:border-zinc-700 dark:bg-zinc-900"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <h2 id="flyer-tour-title" className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              {steps[step]?.title}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">{steps[step]?.body}</p>
            {step === steps.length - 1 && hasAnyCta ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {hasMeetingCta ? (
                  meetingUrl ? (
                    <a href={meetingUrl} target="_blank" rel="noopener noreferrer" className={ctaClass}>
                      Plan een persoonlijk gesprek
                    </a>
                  ) : (
                    <button type="button" className={ctaClass} onClick={() => mailStudio("Persoonlijk gesprek — website concept")}>
                      Plan een persoonlijk gesprek
                    </button>
                  )
                ) : null}
                <a
                  href={orderHref}
                  {...(orderIsExternal ? { target: "_blank" as const, rel: "noopener noreferrer" } : {})}
                  className={ctaPrimaryClass}
                >
                  Ga door naar bestellen
                </a>
              </div>
            ) : null}
            <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                className="text-sm font-medium text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                onClick={(e) => {
                  e.stopPropagation();
                  finishTour();
                }}
              >
                Overslaan
              </button>
              <div className="flex gap-2">
                {step > 0 ? (
                  <button
                    type="button"
                    className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-100 dark:hover:bg-zinc-800"
                    onClick={(e) => {
                      e.stopPropagation();
                      setStep((s) => Math.max(0, s - 1));
                    }}
                  >
                    Terug
                  </button>
                ) : null}
                {step < steps.length - 1 ? (
                  <button
                    type="button"
                    className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
                    onClick={(e) => {
                      e.stopPropagation();
                      setStep((s) => s + 1);
                    }}
                  >
                    Volgende
                  </button>
                ) : (
                  <button
                    type="button"
                    className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
                    onClick={(e) => {
                      e.stopPropagation();
                      finishTour();
                    }}
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

      {dismissedBar && !showOverlay ? (
        <div className="pointer-events-none fixed bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] left-3 z-[10040] sm:left-4">
          <button
            type="button"
            className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-zinc-300 bg-white/95 px-3 py-2 text-xs font-medium text-zinc-800 shadow-lg backdrop-blur-sm hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900/95 dark:text-zinc-100 dark:hover:bg-zinc-800"
            onClick={() => {
              setStep(0);
              setTourOpen(true);
            }}
          >
            <HelpCircle className="size-4 shrink-0 opacity-80" aria-hidden />
            Concept-uitleg
          </button>
        </div>
      ) : null}

      {showFloatingActions ? (
        <div
          className={`pointer-events-none fixed right-3 z-[10050] flex flex-col items-end sm:right-4 ${
            showBottomIntroBar
              ? "bottom-[calc(9rem+env(safe-area-inset-bottom,0px))] sm:bottom-[calc(10.5rem+env(safe-area-inset-bottom,0px))]"
              : "bottom-[calc(1rem+env(safe-area-inset-bottom,0px))]"
          }`}
          role="complementary"
          aria-label="Bestellen en contact"
        >
          <div className={fabWrap}>
            <a
              href={orderHref}
              {...(orderIsExternal ? { target: "_blank" as const, rel: "noopener noreferrer" } : {})}
              className={fabPrimary}
            >
              <ShoppingBag className="size-4 shrink-0 opacity-90" aria-hidden />
              Ga door naar bestellen
            </a>
            {hasMeetingCta ? (
              meetingUrl ? (
                <a href={meetingUrl} target="_blank" rel="noopener noreferrer" className={fabSecondary}>
                  <Calendar className="size-4 shrink-0 opacity-80" aria-hidden />
                  Plan een persoonlijk gesprek
                </a>
              ) : (
                <button type="button" className={fabSecondary} onClick={() => mailStudio("Persoonlijk gesprek — website concept")}>
                  <Calendar className="size-4 shrink-0 opacity-80" aria-hidden />
                  Plan een persoonlijk gesprek
                </button>
              )
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}

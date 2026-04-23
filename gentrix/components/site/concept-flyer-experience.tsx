"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Calendar, HelpCircle, Palette, ShoppingBag, X } from "lucide-react";
import { PUBLIC_STUDIO_CONTACT_EMAIL } from "@/lib/constants";
import { buildPublicStudioBookingHref, buildPublicStudioOrderHref } from "@/lib/studio-order/build-public-order-href";
import { cn } from "@/lib/utils";

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

const THEME_VAR_KEYS = [
  "--page-primary",
  "--page-accent",
  "--page-background",
  "--page-text",
  "--site-primary",
  "--site-accent",
  "--site-background",
  "--site-foreground",
  "--site-bg",
  "--site-fg",
] as const;

function publishedSiteRoot(): HTMLElement | null {
  return document.querySelector("[data-gentrix-published-site-root]");
}

function applyThemaToRoot(primary: string, accent: string, background: string, text: string) {
  const root = publishedSiteRoot();
  if (!root) return;
  root.style.setProperty("--page-primary", primary);
  root.style.setProperty("--page-accent", accent);
  root.style.setProperty("--page-background", background);
  root.style.setProperty("--page-text", text);
  root.style.setProperty("--site-primary", primary);
  root.style.setProperty("--site-accent", accent);
  root.style.setProperty("--site-background", background);
  root.style.setProperty("--site-foreground", text);
  root.style.setProperty("--site-bg", background);
  root.style.setProperty("--site-fg", text);
}

function clearThemaFromRoot() {
  const root = publishedSiteRoot();
  if (!root) return;
  for (const k of THEME_VAR_KEYS) {
    root.style.removeProperty(k);
  }
}

const THEME_PRESETS: { id: string; label: string; primary: string; accent: string; background: string; text: string }[] = [
  { id: "zacht", label: "Zacht", primary: "#4f46e5", accent: "#818cf8", background: "#fafafa", text: "#18181b" },
  { id: "fris", label: "Fris", primary: "#059669", accent: "#34d399", background: "#f0fdf4", text: "#064e3b" },
  { id: "contrast", label: "Contrast", primary: "#ea580c", accent: "#f97316", background: "#0a0a0a", text: "#fafafa" },
];

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

  const bookingHref = useMemo(
    () =>
      buildPublicStudioBookingHref(slug, {
        previewToken: previewToken?.trim() || undefined,
        flyer: preserveFlyerQuery,
      }),
    [slug, previewToken, preserveFlyerQuery],
  );

  const storageKey = useMemo(() => `gentrix-flyer-tour-${slug}`, [slug]);
  const [tourOpen, setTourOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [themaOpen, setThemaOpen] = useState(false);
  const [primary, setPrimary] = useState(THEME_PRESETS[0].primary);
  const [accent, setAccent] = useState(THEME_PRESETS[0].accent);
  const [background, setBackground] = useState(THEME_PRESETS[0].background);
  const [text, setText] = useState(THEME_PRESETS[0].text);
  const flyerChromeRef = useRef<HTMLDivElement>(null);

  /* Flyer-rondleiding: session vóór eerste paint lezen (voorkomt overlay-flash). */
  /* eslint-disable react-hooks/set-state-in-effect */
  useLayoutEffect(() => {
    try {
      if (sessionStorage.getItem(storageKey) === "1") {
        setTourOpen(false);
        setStep(0);
        return;
      }
    } catch {
      /* private mode */
    }
    setTourOpen(true);
    setStep(0);
  }, [storageKey]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const finishTour = useCallback(() => {
    try {
      sessionStorage.setItem(storageKey, "1");
    } catch {
      /* ignore */
    }
    setTourOpen(false);
    setStep(0);
  }, [storageKey]);

  const mailStudio = useCallback(
    (subject: string) => {
      window.location.href = `mailto:${contactEmail}?subject=${encodeURIComponent(subject)}`;
    },
    [contactEmail],
  );

  const hasMeetingCta = Boolean(meetingUrl || contactEmail);
  const showAppointmentInBar = appointmentsEnabled || hasMeetingCta;

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
      body: "Onderaan vind je knoppen voor thema, afspraak en bestellen — het scherm blijft rustig.",
    },
  ];

  const showOverlay = tourOpen && step >= 0 && step < steps.length;

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

  /** Ruimte onder de vaste balk zodat de site-inhoud niet verborgen blijft. */
  useEffect(() => {
    const pad = "calc(5.25rem + env(safe-area-inset-bottom, 0px))";
    const prev = document.body.style.paddingBottom;
    document.body.style.paddingBottom = pad;
    return () => {
      document.body.style.paddingBottom = prev;
    };
  }, []);

  useEffect(() => {
    if (!themaOpen) return;
    const onDown = (e: MouseEvent) => {
      const chrome = flyerChromeRef.current;
      if (chrome?.contains(e.target as Node)) return;
      setThemaOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setThemaOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [themaOpen]);

  const pickPreset = useCallback((p: (typeof THEME_PRESETS)[number]) => {
    setPrimary(p.primary);
    setAccent(p.accent);
    setBackground(p.background);
    setText(p.text);
    applyThemaToRoot(p.primary, p.accent, p.background, p.text);
  }, []);

  const resetThema = useCallback(() => {
    clearThemaFromRoot();
    const d = THEME_PRESETS[0];
    setPrimary(d.primary);
    setAccent(d.accent);
    setBackground(d.background);
    setText(d.text);
  }, []);

  const ctaClass =
    "rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700";
  const ctaPrimaryClass =
    "rounded-lg border border-emerald-600/40 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-950 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100 dark:hover:bg-emerald-950/70";

  const barBtn =
    "inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-xl border border-zinc-200/90 bg-white/95 px-3.5 py-2 text-sm font-medium text-zinc-800 shadow-sm backdrop-blur-sm hover:bg-zinc-50 dark:border-zinc-600/90 dark:bg-zinc-900/95 dark:text-zinc-100 dark:hover:bg-zinc-800 sm:px-4";

  const barBtnPrimary =
    "inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-xl border border-emerald-600/45 bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-600 dark:hover:bg-emerald-500 sm:px-4";

  return (
    <>
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
            {step === steps.length - 1 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {showAppointmentInBar ? (
                  appointmentsEnabled ? (
                    <a href={bookingHref} className={ctaClass}>
                      Maak een afspraak
                    </a>
                  ) : meetingUrl ? (
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

      {!showOverlay ? (
        <div
          className="pointer-events-none fixed inset-x-0 bottom-0 z-[10050] flex justify-center px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1"
          role="complementary"
          aria-label="Flyer-preview acties"
        >
          <div ref={flyerChromeRef} className="pointer-events-auto relative w-full max-w-3xl">
            {themaOpen ? (
              <div
                className="absolute bottom-full left-0 right-0 z-10 mb-2 rounded-2xl border border-zinc-200 bg-white/98 p-4 shadow-xl backdrop-blur-md dark:border-zinc-700 dark:bg-zinc-900/98"
                role="dialog"
                aria-label="Thema aanpassen"
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Thema (voorbeeld)</p>
                  <button
                    type="button"
                    className="rounded-lg p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                    aria-label="Thema-paneel sluiten"
                    onClick={() => setThemaOpen(false)}
                  >
                    <X className="size-4" />
                  </button>
                </div>
                <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
                  Alleen op dit scherm — zo kun je sfeer proberen zonder de opgeslagen site te wijzigen.
                </p>
                <div className="mb-3 flex flex-wrap gap-2">
                  {THEME_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => pickPreset(p)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                        primary === p.primary && background === p.background
                          ? "border-violet-500 bg-violet-50 text-violet-950 dark:border-violet-400 dark:bg-violet-950/50 dark:text-violet-100"
                          : "border-zinc-200 bg-zinc-50 text-zinc-700 hover:border-zinc-300 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200",
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-300">
                    Primair
                    <input
                      type="color"
                      value={primary}
                      onChange={(e) => {
                        setPrimary(e.target.value);
                        applyThemaToRoot(e.target.value, accent, background, text);
                      }}
                      className="h-10 w-full cursor-pointer rounded-lg border border-zinc-200 bg-white dark:border-zinc-600"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-300">
                    Accent
                    <input
                      type="color"
                      value={accent}
                      onChange={(e) => {
                        setAccent(e.target.value);
                        applyThemaToRoot(primary, e.target.value, background, text);
                      }}
                      className="h-10 w-full cursor-pointer rounded-lg border border-zinc-200 bg-white dark:border-zinc-600"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-300">
                    Achtergrond
                    <input
                      type="color"
                      value={background}
                      onChange={(e) => {
                        setBackground(e.target.value);
                        applyThemaToRoot(primary, accent, e.target.value, text);
                      }}
                      className="h-10 w-full cursor-pointer rounded-lg border border-zinc-200 bg-white dark:border-zinc-600"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-300">
                    Tekst
                    <input
                      type="color"
                      value={text}
                      onChange={(e) => {
                        setText(e.target.value);
                        applyThemaToRoot(primary, accent, background, e.target.value);
                      }}
                      className="h-10 w-full cursor-pointer rounded-lg border border-zinc-200 bg-white dark:border-zinc-600"
                    />
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    resetThema();
                    setThemaOpen(false);
                  }}
                  className="mt-3 w-full rounded-xl border border-zinc-200 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  Thema terugzetten
                </button>
              </div>
            ) : null}

            <div className="flex items-center gap-2 rounded-2xl border border-zinc-200/90 bg-white/90 px-2 py-2 shadow-lg backdrop-blur-md dark:border-zinc-700/90 dark:bg-zinc-950/90 sm:gap-3 sm:px-3">
              <span className="hidden min-w-0 flex-1 truncate pl-1 text-xs font-medium text-zinc-500 dark:text-zinc-400 sm:inline">
                Concept-preview
              </span>
              <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5 overflow-x-auto sm:justify-center sm:gap-2">
                <button
                  type="button"
                  className={barBtn}
                  aria-expanded={themaOpen}
                  onClick={() => setThemaOpen((o) => !o)}
                >
                  <Palette className="size-4 shrink-0 opacity-85" aria-hidden />
                  <span className="max-sm:sr-only">Thema</span>
                </button>
                {showAppointmentInBar ? (
                  appointmentsEnabled ? (
                    <a href={bookingHref} className={barBtn}>
                      <Calendar className="size-4 shrink-0 opacity-85" aria-hidden />
                      <span className="max-sm:sr-only">Afspraak</span>
                    </a>
                  ) : meetingUrl ? (
                    <a href={meetingUrl} target="_blank" rel="noopener noreferrer" className={barBtn}>
                      <Calendar className="size-4 shrink-0 opacity-85" aria-hidden />
                      <span className="max-sm:sr-only">Gesprek</span>
                    </a>
                  ) : (
                    <button type="button" className={barBtn} onClick={() => mailStudio("Persoonlijk gesprek — website concept")}>
                      <Calendar className="size-4 shrink-0 opacity-85" aria-hidden />
                      <span className="max-sm:sr-only">Gesprek</span>
                    </button>
                  )
                ) : null}
                <a
                  href={orderHref}
                  {...(orderIsExternal ? { target: "_blank" as const, rel: "noopener noreferrer" } : {})}
                  className={barBtnPrimary}
                >
                  <ShoppingBag className="size-4 shrink-0 opacity-90" aria-hidden />
                  <span className="max-sm:sr-only">Bestellen</span>
                </a>
                <button
                  type="button"
                  className={cn(barBtn, "border-dashed")}
                  onClick={() => {
                    setStep(0);
                    setTourOpen(true);
                  }}
                  aria-label="Concept-uitleg"
                >
                  <HelpCircle className="size-4 shrink-0 opacity-85" aria-hidden />
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

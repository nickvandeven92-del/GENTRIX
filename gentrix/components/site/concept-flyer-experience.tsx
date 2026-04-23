"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Calendar,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Palette,
  ShoppingBag,
  Sparkles,
} from "lucide-react";
import type { TailwindPageConfig } from "@/lib/ai/tailwind-sections-schema";
import { PUBLIC_STUDIO_CONTACT_EMAIL } from "@/lib/constants";
import {
  buildFlyerPortalThemePresetRows,
  type FlyerPortalThemePresetRow,
  type PortalThemePresetId,
} from "@/lib/portal/portal-theme-presets";
import { buildPublicStudioBookingHref, buildPublicStudioOrderHref } from "@/lib/studio-order/build-public-order-href";
import { ShowroomWordmark } from "@/components/public/showroom-wordmark";
import { cn } from "@/lib/utils";

type ConceptFlyerExperienceProps = {
  siteLabel: string;
  slug: string;
  appointmentsEnabled: boolean;
  webshopEnabled: boolean;
  /** Master Tailwind `config` van de site — zelfde basis als portaal-thema’s (Origineel + 2 varianten). */
  tailwindPageConfig?: TailwindPageConfig | null;
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

type DockSection = "thema" | "afspraak" | "bestellen";

export function ConceptFlyerExperience({
  siteLabel,
  slug,
  appointmentsEnabled,
  webshopEnabled,
  tailwindPageConfig = null,
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
  const themePresets = useMemo(
    () => buildFlyerPortalThemePresetRows(tailwindPageConfig ?? null),
    [tailwindPageConfig],
  );
  const [tourOpen, setTourOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [expanded, setExpanded] = useState<DockSection | null>(null);
  const firstPreset = themePresets[0];
  const [selectedFlyerThemeId, setSelectedFlyerThemeId] = useState<PortalThemePresetId | null>(
    () => firstPreset?.id ?? null,
  );
  const flyerChromeRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const p = themePresets[0];
    if (!p) return;
    setSelectedFlyerThemeId(p.id);
    clearThemaFromRoot();
  }, [themePresets]);

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

  const toggleSection = useCallback((s: DockSection) => {
    setExpanded((cur) => (cur === s ? null : s));
  }, []);

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
      body: "Onderaan zit een strak menu over de volle breedte: klap secties uit voor thema (zelfde keuzes als in het klantportaal), afspraak en bestellen.",
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

  /** Ruimte onder de dock-rail (paneel klapt omhoog en overlapt de site). */
  useEffect(() => {
    const smMq = window.matchMedia("(min-width: 640px)");
    const prev = document.body.style.paddingBottom;
    const apply = () => {
      const pad = smMq.matches
        ? "calc(3.75rem + env(safe-area-inset-bottom, 0px))"
        : "calc(5.25rem + env(safe-area-inset-bottom, 0px))";
      document.body.style.paddingBottom = pad;
    };
    apply();
    smMq.addEventListener("change", apply);
    return () => {
      smMq.removeEventListener("change", apply);
      document.body.style.paddingBottom = prev;
    };
  }, []);

  useEffect(() => {
    if (!expanded) return;
    const onDown = (e: MouseEvent) => {
      if (flyerChromeRef.current?.contains(e.target as Node)) return;
      setExpanded(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(null);
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [expanded]);

  const pickPreset = useCallback((p: FlyerPortalThemePresetRow) => {
    setSelectedFlyerThemeId(p.id);
    applyThemaToRoot(p.primary, p.accent, p.background, p.text);
  }, []);

  const resetThema = useCallback(() => {
    clearThemaFromRoot();
    const d = themePresets[0];
    if (!d) return;
    setSelectedFlyerThemeId(d.id);
  }, [themePresets]);

  const ctaClass =
    "rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700";
  const ctaPrimaryClass =
    "rounded-lg border border-emerald-600/40 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-950 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100 dark:hover:bg-emerald-950/70";

  const dockTrigger = (active: boolean) =>
    cn(
      "flex min-h-[44px] min-w-0 flex-1 flex-col items-center justify-center gap-0 border-l border-zinc-200 px-0.5 py-1.5 text-center transition-colors first:border-l-0 sm:min-h-[56px] sm:flex-row sm:gap-2 sm:px-3 sm:py-2 dark:border-zinc-700",
      active
        ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
        : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100",
    );

  const dockLabel = "max-w-full truncate text-[9px] font-medium uppercase tracking-[0.1em] sm:text-[11px] sm:tracking-[0.14em]";

  const sectionTitle = "text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50";
  const sectionMuted = "text-xs leading-relaxed text-zinc-600 dark:text-zinc-400";

  return (
    <div className="gentrix-ui-sharp">
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
          className="pointer-events-none fixed inset-x-0 bottom-0 z-[10050] pb-[env(safe-area-inset-bottom,0px)]"
          role="complementary"
          aria-label="Concept-preview menu"
        >
          <div
            ref={flyerChromeRef}
            className="pointer-events-auto flex flex-col border-t border-zinc-200 bg-white/95 shadow-[0_-8px_30px_rgba(15,23,42,0.08)] backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/98 dark:shadow-[0_-12px_40px_rgba(0,0,0,0.45)] dark:backdrop-blur-xl"
          >
            {/* Uitklapbaar paneel — volle breedte, inhoud per sectie */}
            <div
              id="flyer-dock-panel"
              className={cn(
                "grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none",
                expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
              )}
              aria-hidden={!expanded}
            >
              <div className="min-h-0 overflow-hidden border-b border-zinc-100 bg-zinc-50/90 dark:border-zinc-800 dark:bg-zinc-950/80">
                <div className="max-h-[min(56vh,520px)] overflow-y-auto overscroll-y-contain px-4 py-4 sm:px-8 sm:py-5">
                  {expanded === "thema" ? (
                    <div className="mx-auto max-w-2xl space-y-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className={sectionTitle}>Thema</p>
                          <p className={cn(sectionMuted, "mt-1")}>
                            Zelfde varianten als in het klantportaal — alleen in deze preview; je opgeslagen site verandert
                            niet.
                          </p>
                        </div>
                        <Sparkles className="size-5 shrink-0 text-zinc-400 dark:text-zinc-500" aria-hidden />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {themePresets.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            title={p.description}
                            onClick={() => pickPreset(p)}
                            className={cn(
                              "rounded-none border px-4 py-2 text-xs font-medium transition",
                              selectedFlyerThemeId === p.id
                                ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                                : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:border-zinc-600 dark:hover:bg-zinc-700",
                            )}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          resetThema();
                          setExpanded(null);
                        }}
                        className="w-full rounded-xl border border-zinc-200 bg-white py-3 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                      >
                        Thema terugzetten
                      </button>
                    </div>
                  ) : null}

                  {expanded === "afspraak" ? (
                    <div className="mx-auto max-w-lg space-y-4">
                      <p className={sectionTitle}>Afspraak &amp; contact</p>
                      <p className={sectionMuted}>
                        {appointmentsEnabled
                          ? "Plan direct online een tijd — dezelfde flow als op de live site."
                          : "Neem contact op voor een persoonlijk gesprek over je concept."}
                      </p>
                      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                        {appointmentsEnabled ? (
                          <a
                            href={bookingHref}
                            className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-100"
                          >
                            <Calendar className="size-4 shrink-0" aria-hidden />
                            Online afspraak maken
                          </a>
                        ) : null}
                        {meetingUrl ? (
                          <a
                            href={meetingUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-5 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
                          >
                            <Calendar className="size-4 shrink-0" aria-hidden />
                            Plan gesprek (agenda)
                          </a>
                        ) : !appointmentsEnabled ? (
                          <button
                            type="button"
                            onClick={() => mailStudio("Persoonlijk gesprek — website concept")}
                            className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-5 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
                          >
                            <Calendar className="size-4 shrink-0" aria-hidden />
                            Mail voor een gesprek
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  {expanded === "bestellen" ? (
                    <div className="mx-auto max-w-lg space-y-4">
                      <p className={sectionTitle}>Bestellen</p>
                      <p className={sectionMuted}>
                        Rond je pakket af of vraag een offerte — je gaat naar het studio-bestelpad met deze
                        conceptcontext bewaard.
                      </p>
                      <a
                        href={orderHref}
                        {...(orderIsExternal ? { target: "_blank" as const, rel: "noopener noreferrer" } : {})}
                        className="inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 text-base font-semibold text-white shadow-lg shadow-emerald-950/30 transition hover:bg-emerald-500"
                      >
                        <ShoppingBag className="size-5 shrink-0 opacity-95" aria-hidden />
                        Ga door naar bestellen
                      </a>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Rail — mobiel: titelregel + één rij (3 knoppen + help); vanaf sm: sidebar | rij zoals voorheen */}
            <div className="flex min-h-0 w-full flex-col items-stretch sm:min-h-[56px] sm:flex-row">
              <div className="flex min-h-[36px] items-center justify-between gap-2 border-b border-zinc-100 px-2.5 py-1.5 sm:hidden dark:border-zinc-800">
                <ShowroomWordmark variant="onLight" compact className="max-w-[min(100%,11rem)]" />
                <span className="min-w-0 max-w-[55%] truncate text-right text-[10px] font-medium text-zinc-500 dark:text-zinc-400" title={siteLabel}>
                  {siteLabel}
                </span>
              </div>
              <div className="hidden w-[min(14rem,32%)] shrink-0 flex-col justify-center gap-1 border-r border-zinc-200 px-3 py-2 sm:flex sm:px-4 dark:border-zinc-700">
                <ShowroomWordmark variant="onLight" className="min-w-0" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-400 dark:text-zinc-500">
                  Concept
                </span>
                <span className="truncate text-xs font-medium text-zinc-600 dark:text-zinc-300" title={siteLabel}>
                  {siteLabel}
                </span>
              </div>

              <div className="flex min-h-[44px] min-w-0 flex-1 flex-row sm:min-h-[56px]">
                <div className="grid min-h-0 min-w-0 flex-1 grid-cols-3 divide-x divide-zinc-200 dark:divide-zinc-700">
                <button
                  type="button"
                  className={dockTrigger(expanded === "thema")}
                  aria-expanded={expanded === "thema"}
                  aria-controls="flyer-dock-panel"
                  onClick={() => toggleSection("thema")}
                >
                  <Palette
                    className={cn(
                      "size-[15px] shrink-0 sm:size-[18px]",
                      expanded === "thema"
                        ? "text-white dark:text-zinc-900"
                        : "text-zinc-500 dark:text-zinc-400",
                    )}
                    aria-hidden
                  />
                  <span className={dockLabel}>Thema</span>
                  {expanded === "thema" ? (
                    <ChevronUp className="size-3.5 max-sm:hidden text-zinc-300 dark:text-zinc-600" aria-hidden />
                  ) : (
                    <ChevronDown className="size-3.5 max-sm:hidden text-zinc-400 dark:text-zinc-500" aria-hidden />
                  )}
                </button>

                {showAppointmentInBar ? (
                  <button
                    type="button"
                    className={dockTrigger(expanded === "afspraak")}
                    aria-expanded={expanded === "afspraak"}
                    aria-controls="flyer-dock-panel"
                    onClick={() => toggleSection("afspraak")}
                  >
                    <Calendar
                      className={cn(
                        "size-[15px] shrink-0 sm:size-[18px]",
                        expanded === "afspraak"
                          ? "text-white dark:text-zinc-900"
                          : "text-zinc-500 dark:text-zinc-400",
                      )}
                      aria-hidden
                    />
                    <span className={dockLabel}>{appointmentsEnabled ? "Afspraak" : "Contact"}</span>
                    {expanded === "afspraak" ? (
                      <ChevronUp className="size-3.5 max-sm:hidden text-zinc-300 dark:text-zinc-600" aria-hidden />
                    ) : (
                      <ChevronDown className="size-3.5 max-sm:hidden text-zinc-400 dark:text-zinc-500" aria-hidden />
                    )}
                  </button>
                ) : (
                  <div
                    className="flex min-h-[44px] flex-1 flex-col items-center justify-center border-l border-zinc-200 px-0.5 py-1.5 opacity-40 sm:min-h-[56px] dark:border-zinc-700"
                    aria-hidden
                  >
                    <Calendar className="size-4 text-zinc-500" aria-hidden />
                    <span className={dockLabel}>—</span>
                  </div>
                )}

                <button
                  type="button"
                  className={dockTrigger(expanded === "bestellen")}
                  aria-expanded={expanded === "bestellen"}
                  aria-controls="flyer-dock-panel"
                  onClick={() => toggleSection("bestellen")}
                >
                  <ShoppingBag
                    className={cn(
                      "size-[15px] shrink-0 sm:size-[18px]",
                      expanded === "bestellen"
                        ? "text-white dark:text-zinc-900"
                        : "text-zinc-500 dark:text-zinc-400",
                    )}
                    aria-hidden
                  />
                  <span className={dockLabel}>Bestellen</span>
                  {expanded === "bestellen" ? (
                    <ChevronUp className="size-3.5 max-sm:hidden text-zinc-300 dark:text-zinc-600" aria-hidden />
                  ) : (
                    <ChevronDown className="size-3.5 max-sm:hidden text-zinc-400 dark:text-zinc-500" aria-hidden />
                  )}
                </button>
                </div>

                <button
                  type="button"
                  className="flex w-11 shrink-0 flex-col items-center justify-center gap-0 border-l border-zinc-200 text-zinc-500 transition hover:bg-zinc-50 hover:text-zinc-800 sm:w-16 sm:gap-1 dark:border-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                  onClick={() => {
                    setExpanded(null);
                    setStep(0);
                    setTourOpen(true);
                  }}
                  aria-label="Concept-uitleg"
                >
                  <HelpCircle className="size-[15px] shrink-0 sm:size-[18px]" aria-hidden />
                  <span className="hidden text-[9px] font-medium uppercase tracking-wider sm:inline">Info</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

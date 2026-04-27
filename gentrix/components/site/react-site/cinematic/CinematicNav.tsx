"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Menu, X } from "lucide-react";
import type { ReactSiteSection } from "@/lib/site/react-site-schema";
import { CinematicNavMenuEntries } from "@/components/site/react-site/cinematic/cinematic-nav-menu";
import { MotionNavShell } from "@/components/site/react-site/cinematic/cinematic-motion";
import type { ResolveHref } from "./types";
import { STUDIO_SITE_BASE_PLACEHOLDER } from "@/lib/site/studio-section-visibility";
import { cn } from "@/lib/utils";

type NavSection = Extract<ReactSiteSection, { type: "nav_overlay" }>;

/** ≥768px: tablet/iPad krijgen desktop-nav; telefoons hamburger + sheet. */
const MD = 768;
function useMdUp(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(`(min-width: ${MD}px)`);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia(`(min-width: ${MD}px)`).matches,
    () => false,
  );
}

const fontSans = { fontFamily: "var(--site-font-sans)" } as const;
const fontSerifLogo = { fontFamily: "var(--site-font-serif)" } as const;

function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [locked]);
}

/**
 * Premium mobiele menu-sheet: valt **onder de navbar** open over de volle breedte,
 * met **content-hoogte** (Vugts/Apple-patroon). Geen vullende backdrop — de hero
 * blijft eronder gewoon zichtbaar, wat rustig en elegant oogt.
 *
 * - `topOffset` = onderkant van de zichtbare navbar (gemeten vanaf top van viewport).
 *   De sheet gebruikt `calc(topOffset - 1px)` om een resterende 1px-spleet (DPR /
 *   compositing t.o.v. de header) dicht te trekken.
 * - Sheet: `translateY(-100%)` → `translateY(0)` zodat het paneel **onder de navbar
 *   vandaan** naar beneden schuift; z-index onder de header zodat overlap tijdens de
 *   transitie de sluit-X niet blokkeert. Lange lijsten: `max-height` op de `<nav>`.
 * - Click-catcher: **onzichtbare** laag onder de sheet die alleen klikken afvangt
 *   om het menu te sluiten — géén dim/darkening over de hero.
 * - Hamburger-knop in de navbar toggelt al naar een X → geen extra X in de sheet.
 */
function MobileNavDrawer({
  open,
  onClose,
  onLinkClick,
  children,
  variant,
  topOffset,
}: {
  open: boolean;
  onClose: () => void;
  /** Intercepteert klikken op <a href> in het drawer via event-delegatie. */
  onLinkClick?: (e: MouseEvent, href: string) => void;
  children: ReactNode;
  variant: "floating" | "bar_light" | "bar_dark";
  /** Pixel-afstand tussen viewport-top en onderrand van de navbar. */
  topOffset: number;
}) {
  // Twee-fase mounting: gemount houden tijdens exit-animatie
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (open) {
      setMounted(true);
      // Double RAF: geeft browser tijd om het element te renderen vóór de transitie start
      const id = requestAnimationFrame(() =>
        requestAnimationFrame(() => setVisible(true)),
      );
      return () => cancelAnimationFrame(id);
    } else {
      setVisible(false);
      const t = setTimeout(() => setMounted(false), 320);
      return () => clearTimeout(t);
    }
  }, [open]);

  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Event-delegatie: intercept <a href> klikken in de nav
  useEffect(() => {
    const nav = navRef.current;
    if (!nav || !onLinkClick) return;
    const handler = (e: MouseEvent) => {
      const anchor = (e.target as Element).closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href) return;
      onLinkClick(e, href);
    };
    nav.addEventListener("click", handler);
    return () => nav.removeEventListener("click", handler);
  }, [onLinkClick]);

  if (!mounted || typeof document === "undefined") return null;

  const sheet =
    variant === "bar_light"
      ? "border-b border-zinc-200 bg-white text-zinc-900 shadow-[0_24px_40px_-24px_rgba(15,23,42,0.22)]"
      : variant === "bar_dark"
        ? "border-b border-white/10 bg-zinc-950 text-white shadow-[0_24px_40px_-24px_rgba(0,0,0,0.55)]"
        : "border-b border-white/12 bg-zinc-950/96 text-white backdrop-blur-md shadow-[0_24px_40px_-24px_rgba(0,0,0,0.55)]";

  // 1px omhoog: sluit haarlijntje tussen header-border en sheet (subpixels / lagen).
  const topStyle: CSSProperties = { top: `calc(${topOffset}px - 1px)` };

  const ui = (
    <div className="pointer-events-auto">
      {/* Onzichtbare click-catcher: sluit het menu bij klik naast/onder de sheet,
          zonder de hero te verdonkeren. */}
      <button
        type="button"
        className="fixed inset-x-0 bottom-0 z-40 bg-transparent"
        style={{ ...topStyle, pointerEvents: visible ? undefined : "none" }}
        aria-label="Menu sluiten"
        onClick={onClose}
        tabIndex={-1}
      />
      {/* Sheet: schuift uit onder de navbar (transform); z-44 < header z-50. */}
      <div
        className={cn(
          "fixed inset-x-0 z-[44] overflow-hidden",
          sheet,
          "will-change-transform",
          visible ? "pointer-events-auto" : "pointer-events-none",
        )}
        style={{
          ...topStyle,
          transform: visible ? "translateY(0)" : "translateY(-100%)",
          transition: "transform 320ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        <nav
          ref={navRef}
          className="flex w-full max-w-none flex-col gap-1 overflow-y-auto overscroll-contain px-5 pb-6 pt-5 sm:px-6 sm:pt-6"
          style={{
            maxHeight: `min(88dvh, calc(100dvh - ${topOffset}px + 1px))`,
          }}
          aria-label="Mobiel menu"
        >
          {children}
        </nav>
      </div>
    </div>
  );

  return createPortal(ui, document.body);
}

export function CinematicNav({
  section,
  resolveHref,
  embedded = false,
}: {
  section: NavSection;
  resolveHref: ResolveHref;
  /** `true` in studio/iframe: `position:fixed` klemt t.o.v. getransformeerde parent — dan `sticky`. */
  embedded?: boolean;
}) {
  const { logoText, links } = section.props;
  const barStyle = section.props.barStyle ?? "floating";
  /** Landingspagina: zelfde pad als nav-links met `__STUDIO_SITE_BASE__` (fallback `#top` zonder gepubliceerde slug). */
  const homeHref = resolveHref(STUDIO_SITE_BASE_PLACEHOLDER) || "#top";
  const [mobileOpen, setMobileOpen] = useState(false);
  /** 0 = transparant glas boven hero, 1 = vaste donkere balk (scroll). */
  const [navElevated, setNavElevated] = useState(0);
  const mdUp = useMdUp();
  const mobileMenuOpen = mobileOpen && !mdUp;

  const closeMobile = useCallback(() => setMobileOpen(false), []);
  const router = useRouter();

  /**
   * Mobiele sheet valt open **onder de navbar** — Vugts/Apple-patroon. Meet daarom
   * de exacte onderkant van de navbar (verschilt per variant én per breakpoint:
   * sticky balk ≈ 68px, floating pill + top-padding ≈ 86–98px).
   */
  const headerRef = useRef<HTMLElement>(null);
  const [topOffset, setTopOffset] = useState(0);
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      // `Math.round` kan rect.bottom naar boven afronden → 1px spleet onder de navbar;
      // `floor` plakt de sheet visueel strak tegen de onderkant.
      setTopOffset(Math.max(0, Math.floor(rect.bottom)));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    // scroll kan elevatie veranderen → rand verschuift minimaal, maar padding ~constant
    window.addEventListener("scroll", update, { passive: true });
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update);
    };
  }, [barStyle]);

  /**
   * Premium navigatie: <a href> behouden voor SEO/toegankelijkheid,
   * maar klikken overnemen met router.push() → Next.js SPA + View Transitions.
   * Interne routes gaan direct door zonder kunstmatige delay.
   */
  const handleNavLinkClick = useCallback(
    (e: MouseEvent, href: string) => {
      if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;

      if (href.startsWith("#")) {
        e.preventDefault();
        closeMobile();
        const id = href.slice(1);
        const el = document.getElementById(id);
        el?.scrollIntoView({ behavior: "smooth" });
        return;
      }

      try {
        const url = new URL(href, window.location.origin);
        if (url.origin !== window.location.origin) return;
        e.preventDefault();
        closeMobile();
        router.push(href);
      } catch {
        // ongeldige URL → normaal
      }
    },
    [closeMobile, router],
  );

  useEffect(() => {
    if (barStyle !== "floating") return;
    const max = 168;
    const onScroll = () => {
      const y = window.scrollY;
      setNavElevated(Math.min(1, y / max));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [barStyle]);

  // Close menu when viewport size changes (tablet/desktop ↔ phone) or when navigating
  useEffect(() => {
    setMobileOpen(false);
  }, [mdUp, section]);

  // Close menu when user scrolls (handles internal navigation in single-page sites)
  useEffect(() => {
    let scrollTimeout: ReturnType<typeof setTimeout>;
    const handleScroll = () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        setMobileOpen(false);
      }, 50);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      clearTimeout(scrollTimeout);
    };
  }, []);

  const mobileLinkWrap = (node: ReactNode, drawerTone: "light" | "dark") => (
    <div
      className={cn(
        "contents [&_a]:block [&_a]:rounded-xl [&_a]:px-4 [&_a]:py-3.5 [&_a]:text-[15px] [&_a]:font-medium [&_a]:tracking-tight [&_a]:transition-colors [&_details]:rounded-xl [&_details]:border [&_details]:p-2",
        drawerTone === "dark"
          ? "[&_a]:!text-zinc-100 [&_a:hover]:!bg-white/10 [&_a:active]:!bg-white/15 [&_summary]:!text-zinc-100 [&_details]:border-white/20"
          : "[&_a]:!text-zinc-900 [&_a:hover]:!bg-zinc-100 [&_a:active]:!bg-zinc-200/70 [&_summary]:!text-zinc-800 [&_details]:border-zinc-200/90",
      )}
      onClick={(e: ReactMouseEvent) => {
        const anchor = (e.target as HTMLElement).closest("a");
        if (anchor) {
          const href = anchor.getAttribute("href");
          if (href) handleNavLinkClick(e as any as MouseEvent, href);
        }
      }}
    >
      {node}
    </div>
  );

  if (barStyle === "bar_light") {
    return (
      <header
        ref={headerRef}
        className="fixed top-0 left-0 right-0 z-50 w-full border-b border-zinc-200 bg-white shadow-sm pt-[env(safe-area-inset-top,0px)]"
        style={fontSans}
      >
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3.5 sm:px-6">
          <div className="flex min-w-0 flex-1 basis-0 justify-start">
            <a
              href={homeHref}
              data-studio-brand-mark="1"
              className="min-w-0 truncate text-base font-semibold tracking-tight text-zinc-900 sm:text-lg rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/45 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
              style={fontSerifLogo}
              onClick={(e) => handleNavLinkClick(e as any as MouseEvent, homeHref)}
            >
              {logoText}
            </a>
          </div>
          <nav
            className="shrink-0 flex-nowrap items-center gap-x-4 text-[0.9375rem] sm:gap-x-5 lg:text-sm"
            style={{ display: mdUp ? "flex" : "none" }}
            aria-label="Hoofdnavigatie"
            onClick={(e: ReactMouseEvent) => {
              const anchor = (e.target as HTMLElement).closest("a");
              if (anchor) {
                const href = anchor.getAttribute("href");
                if (href) handleNavLinkClick(e as any as MouseEvent, href);
              }
            }}
          >
            <CinematicNavMenuEntries items={links} resolveHref={resolveHref} variant="bar_light" />
          </nav>
          <div className="flex min-w-0 flex-1 basis-0 justify-end">
            <button
              type="button"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-zinc-700 hover:bg-zinc-100"
              style={{ display: mdUp ? "none" : "inline-flex" }}
              aria-expanded={mobileMenuOpen}
              aria-label={mobileMenuOpen ? "Menu sluiten" : "Menu openen"}
              onClick={() => setMobileOpen((o) => !o)}
            >
              {mobileMenuOpen ? <X className="size-6" aria-hidden /> : <Menu className="size-6" aria-hidden />}
            </button>
          </div>
        </div>
        {/* Only render mobile drawer on mobile */}
        {!mdUp && (
          <MobileNavDrawer open={mobileMenuOpen} onClose={closeMobile} onLinkClick={handleNavLinkClick} variant="bar_light" topOffset={topOffset}>
            {mobileLinkWrap(
              <CinematicNavMenuEntries items={links} resolveHref={resolveHref} variant="bar_light" />,
              "light",
            )}
          </MobileNavDrawer>
        )}
      </header>
    );
  }

  if (barStyle === "bar_dark") {
    return (
      <header
        ref={headerRef}
        className="fixed top-0 left-0 right-0 z-50 w-full border-b border-white/10 bg-zinc-950 text-white pt-[env(safe-area-inset-top,0px)]"
        style={fontSans}
      >
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3.5 sm:px-6">
          <div className="flex min-w-0 flex-1 basis-0 justify-start">
            <a
              href={homeHref}
              data-studio-brand-mark="1"
              className="min-w-0 truncate text-base font-semibold tracking-tight sm:text-lg rounded-sm text-inherit focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
              onClick={(e) => handleNavLinkClick(e as any as MouseEvent, homeHref)}
              style={fontSerifLogo}
            >
              {logoText}
            </a>
          </div>
          <nav
            className="shrink-0 flex-nowrap items-center gap-x-4 text-[0.9375rem] sm:gap-x-5 lg:text-sm"
            style={{ display: mdUp ? "flex" : "none" }}
            aria-label="Hoofdnavigatie"
            onClick={(e: ReactMouseEvent) => {
              const anchor = (e.target as HTMLElement).closest("a");
              if (anchor) {
                const href = anchor.getAttribute("href");
                if (href) handleNavLinkClick(e as any as MouseEvent, href);
              }
            }}
          >
            <CinematicNavMenuEntries items={links} resolveHref={resolveHref} variant="bar_dark" />
          </nav>
          <div className="flex min-w-0 flex-1 basis-0 justify-end">
            <button
              type="button"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white hover:bg-white/10"
              style={{ display: mdUp ? "none" : "inline-flex" }}
              aria-expanded={mobileMenuOpen}
              aria-label={mobileMenuOpen ? "Menu sluiten" : "Menu openen"}
              onClick={() => setMobileOpen((o) => !o)}
            >
              {mobileMenuOpen ? <X className="size-6" aria-hidden /> : <Menu className="size-6" aria-hidden />}
            </button>
          </div>
        </div>
        {/* Only render mobile drawer on mobile */}
        {!mdUp && (
          <MobileNavDrawer open={mobileMenuOpen} onClose={closeMobile} onLinkClick={handleNavLinkClick} variant="bar_dark" topOffset={topOffset}>
            {mobileLinkWrap(
              <CinematicNavMenuEntries items={links} resolveHref={resolveHref} variant="bar_dark" />,
              "dark",
            )}
          </MobileNavDrawer>
        )}
      </header>
    );
  }

  /* floating — glass pill; scroll: glas → vaste donkere strook (referentie: ambachtelijke landingspagina’s).
   * Rust: genoeg dekking dat tekst leesbaar blijft (te lage alpha oogt als “geen achtergrond”). */
  const floatingShellStyle: CSSProperties = {
    ...fontSans,
    borderColor: `rgba(255,255,255,${0.18 * (1 - navElevated) + 0.26 * navElevated})`,
    backgroundColor: `rgba(9,9,11,${0.48 * (1 - navElevated) + 0.9 * navElevated})`,
    /* Rand + diepte in lijn met hero feature-cards (subtiele highlight + donkere lift). */
    boxShadow:
      navElevated > 0.12
        ? `0 1px 0 rgba(255,255,255,0.1) inset, 0 0 0 1px rgba(0,0,0,0.35), 0 22px 52px -12px rgba(0,0,0,${0.5 + navElevated * 0.18})`
        : `0 1px 0 rgba(255,255,255,0.14) inset, 0 0 0 1px rgba(255,255,255,0.12), 0 24px 55px -14px rgba(0,0,0,0.5)`,
  };

  return (
    <header
      ref={headerRef}
      className={cn(
        "z-50 flex w-full justify-center max-md:px-0 max-md:pt-0 px-4 pt-5 sm:pt-6",
        embedded ? "sticky top-0" : "pointer-events-none fixed inset-x-0 top-0",
      )}
    >
      <MotionNavShell
        className={cn(
          "pointer-events-auto flex w-full max-w-5xl items-center rounded-none border border-white/12 px-6 py-3 backdrop-blur-md transition-[background-color,box-shadow,border-color] duration-300 ease-out sm:px-8 sm:py-4 md:px-10",
          "max-md:max-w-none max-md:border-x-0 max-md:border-t-0 max-md:border-b max-md:shadow-none",
        )}
        style={floatingShellStyle}
      >
        <div className="flex w-full items-center gap-3 sm:gap-4">
          <div className="flex min-w-0 flex-1 basis-0 shrink-0 justify-start">
            <a
              href={homeHref}
              data-studio-brand-mark="1"
              className="min-w-0 truncate text-base font-semibold tracking-tight text-white sm:text-lg rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/35 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950/90"
              onClick={(e) => handleNavLinkClick(e as any as MouseEvent, homeHref)}
              style={fontSerifLogo}
            >
              {logoText}
            </a>
          </div>
          <nav
            className="shrink-0 flex-nowrap items-center gap-x-4 text-[0.9375rem] sm:gap-x-5 lg:gap-x-6 lg:text-sm"
            style={{ display: mdUp ? "flex" : "none" }}
            aria-label="Hoofdnavigatie"
            onClick={(e: ReactMouseEvent) => {
              const anchor = (e.target as HTMLElement).closest("a");
              if (anchor) {
                const href = anchor.getAttribute("href");
                if (href) handleNavLinkClick(e as any as MouseEvent, href);
              }
            }}
          >
            <CinematicNavMenuEntries items={links} resolveHref={resolveHref} variant="floating" />
          </nav>
          <div className="flex min-w-0 flex-1 basis-0 justify-end">
            <button
              type="button"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white hover:bg-white/10"
              style={{ display: mdUp ? "none" : "inline-flex" }}
              aria-expanded={mobileMenuOpen}
              aria-label={mobileMenuOpen ? "Menu sluiten" : "Menu openen"}
              onClick={() => setMobileOpen((o) => !o)}
            >
              {mobileMenuOpen ? <X className="size-6" aria-hidden /> : <Menu className="size-6" aria-hidden />}
            </button>
          </div>
        </div>
      </MotionNavShell>
      {/* Only render mobile drawer on mobile */}
      {!mdUp && (
        <MobileNavDrawer open={mobileMenuOpen} onClose={closeMobile} onLinkClick={handleNavLinkClick} variant="floating" topOffset={topOffset}>
          {mobileLinkWrap(
            <CinematicNavMenuEntries items={links} resolveHref={resolveHref} variant="floating" />,
            "dark",
          )}
        </MobileNavDrawer>
      )}
    </header>
  );
}

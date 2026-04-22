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

/** Server: mobiel aannemen zodat de inline menu-links nooit in de eerste HTML staan. */
const LG = 1024;
function useLgUp(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(`(min-width: ${LG}px)`);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia(`(min-width: ${LG}px)`).matches,
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
 * - Sheet: transform van `-translate-y-full` naar `translate-y-0` (glijdt neer), met
 *   subtiele opacity-fade en cubic-bezier easing voor rustige, dure beweging.
 *   Hoogte is `auto` (clamp via `max-height` voor hele lange menu's).
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

  // Sheet + click-catcher starten exact onder de navbar.
  const topStyle: CSSProperties = { top: `${topOffset}px` };

  const ui = (
    <div className="pointer-events-auto">
      {/* Onzichtbare click-catcher: sluit het menu bij klik naast/onder de sheet,
          zonder de hero te verdonkeren. */}
      <button
        type="button"
        className="fixed inset-x-0 bottom-0 z-[200] bg-transparent"
        style={{ ...topStyle, pointerEvents: visible ? undefined : "none" }}
        aria-label="Menu sluiten"
        onClick={onClose}
        tabIndex={-1}
      />
      {/* Sheet: glijdt neer vanonder de navbar — content-hoogte, niet fullscreen. */}
      <div
        className={cn(
          "fixed inset-x-0 z-[210] overflow-hidden",
          "transition-[transform,opacity] duration-[320ms] [transition-timing-function:cubic-bezier(0.22,1,0.36,1)] will-change-transform",
          sheet,
          visible ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0",
        )}
        style={{ ...topStyle, maxHeight: `calc(100dvh - ${topOffset}px)` }}
      >
        <nav
          ref={navRef}
          className="mx-auto flex w-full max-w-6xl flex-col gap-1 overflow-y-auto overscroll-contain px-5 pb-6 pt-5 sm:px-6 sm:pt-6"
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
  const lgUp = useLgUp();
  const mobileMenuOpen = mobileOpen && !lgUp;

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
      setTopOffset(Math.max(0, Math.round(rect.bottom)));
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

  // Close menu when viewport size changes (desktop ↔ mobile) or when navigating
  useEffect(() => {
    setMobileOpen(false);
  }, [lgUp, section]);

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
        className="sticky top-0 z-50 w-full border-b border-zinc-200/90 bg-white/92 backdrop-blur-md shadow-sm"
        style={fontSans}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
          <a
            href={homeHref}
            className="min-w-0 truncate text-base font-semibold tracking-tight text-zinc-900 sm:text-lg rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/45 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            style={fontSerifLogo}
                      onClick={(e) => handleNavLinkClick(e as any as MouseEvent, homeHref)}
          >
            {logoText}
          </a>
          <nav
            className="items-center gap-x-5 gap-y-2 text-[0.9375rem] lg:text-sm"
            style={{ display: lgUp ? "flex" : "none" }}
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
          <button
            type="button"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-zinc-700 hover:bg-zinc-100"
            style={{ display: lgUp ? "none" : "inline-flex" }}
            aria-expanded={mobileMenuOpen}
            aria-label={mobileMenuOpen ? "Menu sluiten" : "Menu openen"}
            onClick={() => setMobileOpen((o) => !o)}
          >
            {mobileMenuOpen ? <X className="size-6" aria-hidden /> : <Menu className="size-6" aria-hidden />}
          </button>
        </div>
        {/* Only render mobile drawer on mobile */}
        {!lgUp && (
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
        className="sticky top-0 z-50 w-full border-b border-white/10 bg-zinc-950/92 text-white backdrop-blur-md"
        style={fontSans}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
          <a
            href={homeHref}
            className="min-w-0 truncate text-base font-semibold tracking-tight sm:text-lg rounded-sm text-inherit focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
                        onClick={(e) => handleNavLinkClick(e as any as MouseEvent, homeHref)}
            style={fontSerifLogo}
          >
            {logoText}
          </a>
          <nav
            className="items-center gap-x-5 gap-y-2 text-[0.9375rem] lg:text-sm"
            style={{ display: lgUp ? "flex" : "none" }}
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
          <button
            type="button"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white hover:bg-white/10"
            style={{ display: lgUp ? "none" : "inline-flex" }}
            aria-expanded={mobileMenuOpen}
            aria-label={mobileMenuOpen ? "Menu sluiten" : "Menu openen"}
            onClick={() => setMobileOpen((o) => !o)}
          >
            {mobileMenuOpen ? <X className="size-6" aria-hidden /> : <Menu className="size-6" aria-hidden />}
          </button>
        </div>
        {/* Only render mobile drawer on mobile */}
        {!lgUp && (
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
    borderColor: `rgba(255,255,255,${0.14 * (1 - navElevated) + 0.22 * navElevated})`,
    backgroundColor: `rgba(9,9,11,${0.48 * (1 - navElevated) + 0.9 * navElevated})`,
    boxShadow:
      navElevated > 0.12
        ? `0 18px 50px rgba(0,0,0,${0.32 + navElevated * 0.28})`
        : `0 10px 36px rgba(0,0,0,0.2)`,
  };

  return (
    <header
      ref={headerRef}
      className={cn(
        "z-50 flex w-full justify-center px-4 pt-5 sm:pt-6",
        embedded ? "sticky top-0" : "pointer-events-none fixed inset-x-0 top-0",
      )}
    >
      <MotionNavShell
        className={cn(
          "pointer-events-auto flex w-full max-w-5xl flex-col gap-3 rounded-2xl border px-4 py-3 shadow-lg backdrop-blur-md transition-[background-color,box-shadow,border-color] duration-300 ease-out sm:px-5 sm:py-4 lg:flex-row lg:items-center lg:justify-between lg:gap-6",
          navElevated > 0.65 && "rounded-xl sm:rounded-2xl",
        )}
        style={floatingShellStyle}
      >
        <div className="flex w-full items-center justify-between gap-3 lg:contents">
          <a
            href={homeHref}
            className="min-w-0 truncate text-base font-semibold tracking-tight text-white sm:text-lg rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/35 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950/90"
                        onClick={(e) => handleNavLinkClick(e as any as MouseEvent, homeHref)}
            style={fontSerifLogo}
          >
            {logoText}
          </a>
          <button
            type="button"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white hover:bg-white/10"
            style={{ display: lgUp ? "none" : "inline-flex" }}
            aria-expanded={mobileMenuOpen}
            aria-label={mobileMenuOpen ? "Menu sluiten" : "Menu openen"}
            onClick={() => setMobileOpen((o) => !o)}
          >
            {mobileMenuOpen ? <X className="size-6" aria-hidden /> : <Menu className="size-6" aria-hidden />}
          </button>
        </div>
        <nav
          className="items-center gap-x-6 gap-y-2 text-[0.9375rem] lg:text-sm"
                    onClick={(e: ReactMouseEvent) => {
                      const anchor = (e.target as HTMLElement).closest("a");
                      if (anchor) {
                        const href = anchor.getAttribute("href");
                        if (href) handleNavLinkClick(e as any as MouseEvent, href);
                      }
                    }}
          style={{ display: lgUp ? "flex" : "none" }}
          aria-label="Hoofdnavigatie"
        >
          <CinematicNavMenuEntries items={links} resolveHref={resolveHref} variant="floating" />
        </nav>
      </MotionNavShell>
      {/* Only render mobile drawer on mobile */}
      {!lgUp && (
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

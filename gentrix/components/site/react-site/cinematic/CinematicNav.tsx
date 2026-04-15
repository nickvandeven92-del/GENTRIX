"use client";

import { useCallback, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Menu, X } from "lucide-react";
import type { ReactSiteSection } from "@/lib/site/react-site-schema";
import { CinematicNavMenuEntries } from "@/components/site/react-site/cinematic/cinematic-nav-menu";
import { MotionNavShell } from "@/components/site/react-site/cinematic/cinematic-motion";
import type { ResolveHref } from "./types";
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

function MobileNavDrawer({
  open,
  onClose,
  children,
  variant,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  variant: "floating" | "bar_light" | "bar_dark";
}) {
  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const backdrop =
    variant === "bar_light"
      ? "bg-black/40"
      : variant === "bar_dark"
        ? "bg-black/55"
        : "bg-black/50";

  const sheet =
    variant === "bar_light"
      ? "border-l border-zinc-200 bg-white text-zinc-900"
      : variant === "bar_dark"
        ? "border-l border-white/10 bg-zinc-950 text-white"
        : "border-l border-white/15 bg-zinc-950/98 text-white backdrop-blur-md";

  const closeBtnClass =
    variant === "bar_light"
      ? "rounded-lg p-2 text-zinc-900 hover:bg-zinc-100"
      : "rounded-lg p-2 text-white hover:bg-white/15";

  const ui = (
    <div className="pointer-events-auto">
      <button
        type="button"
        className={cn("fixed inset-0 z-[200]", backdrop)}
        aria-label="Menu sluiten"
        onClick={onClose}
      />
      <div
        className={cn(
          "fixed inset-y-0 right-0 z-[210] flex w-[min(100vw-2.5rem,18rem)] flex-col gap-4 border-l p-5 pt-6 shadow-2xl",
          sheet,
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold tracking-tight">Menu</span>
          <button type="button" className={closeBtnClass} aria-label="Menu sluiten" onClick={onClose}>
            <X className="size-5" strokeWidth={2} aria-hidden />
          </button>
        </div>
        <nav className="flex flex-col gap-1 overflow-y-auto overscroll-contain" aria-label="Mobiel menu">
          {children}
        </nav>
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(ui, document.body);
}

export function CinematicNav({ section, resolveHref }: { section: NavSection; resolveHref: ResolveHref }) {
  const { logoText, links } = section.props;
  const barStyle = section.props.barStyle ?? "floating";
  const [mobileOpen, setMobileOpen] = useState(false);
  const lgUp = useLgUp();
  const mobileMenuOpen = mobileOpen && !lgUp;

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  useEffect(() => {
    setMobileOpen(false);
  }, [resolveHref]);

  const mobileLinkWrap = (node: ReactNode, drawerTone: "light" | "dark") => (
    <div
      className={cn(
        "contents [&_a]:block [&_a]:rounded-lg [&_a]:px-3 [&_a]:py-2.5 [&_a]:text-sm [&_a]:font-medium [&_details]:rounded-lg [&_details]:border [&_details]:p-2",
        drawerTone === "dark"
          ? "[&_a]:!text-zinc-100 [&_summary]:!text-zinc-100 [&_details]:border-white/20"
          : "[&_a]:!text-zinc-900 [&_summary]:!text-zinc-800 [&_details]:border-zinc-200/90",
      )}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("a")) closeMobile();
      }}
    >
      {node}
    </div>
  );

  if (barStyle === "bar_light") {
    return (
      <header
        className="sticky top-0 z-50 w-full border-b border-zinc-200/90 bg-white/92 backdrop-blur-md shadow-sm"
        style={fontSans}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
          <span
            className="min-w-0 truncate text-base font-semibold tracking-tight text-zinc-900 sm:text-lg"
            style={fontSerifLogo}
          >
            {logoText}
          </span>
          <nav
            className="items-center gap-x-5 gap-y-2 text-[0.9375rem] lg:text-sm"
            style={{ display: lgUp ? "flex" : "none" }}
            aria-label="Hoofdnavigatie"
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
        <MobileNavDrawer open={mobileMenuOpen} onClose={closeMobile} variant="bar_light">
          {mobileLinkWrap(
            <CinematicNavMenuEntries items={links} resolveHref={resolveHref} variant="bar_light" />,
            "light",
          )}
        </MobileNavDrawer>
      </header>
    );
  }

  if (barStyle === "bar_dark") {
    return (
      <header
        className="sticky top-0 z-50 w-full border-b border-white/10 bg-zinc-950/92 text-white backdrop-blur-md"
        style={fontSans}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
          <span className="min-w-0 truncate text-base font-semibold tracking-tight sm:text-lg" style={fontSerifLogo}>
            {logoText}
          </span>
          <nav
            className="items-center gap-x-5 gap-y-2 text-[0.9375rem] lg:text-sm"
            style={{ display: lgUp ? "flex" : "none" }}
            aria-label="Hoofdnavigatie"
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
        <MobileNavDrawer open={mobileMenuOpen} onClose={closeMobile} variant="bar_dark">
          {mobileLinkWrap(
            <CinematicNavMenuEntries items={links} resolveHref={resolveHref} variant="bar_dark" />,
            "dark",
          )}
        </MobileNavDrawer>
      </header>
    );
  }

  /* floating — glass pill */
  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-5 sm:pt-6">
      <MotionNavShell
        className={cn(
          "pointer-events-auto flex w-full max-w-5xl flex-col gap-3 rounded-2xl border px-4 py-3 shadow-lg backdrop-blur-md sm:px-5 sm:py-4 lg:flex-row lg:items-center lg:justify-between lg:gap-6",
          "border-white/15 bg-black/40",
        )}
        style={{ ...fontSans, borderColor: "rgba(255,255,255,0.14)" }}
      >
        <div className="flex w-full items-center justify-between gap-3 lg:contents">
          <span
            className="min-w-0 truncate text-base font-semibold tracking-tight text-white sm:text-lg"
            style={fontSerifLogo}
          >
            {logoText}
          </span>
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
          style={{ display: lgUp ? "flex" : "none" }}
          aria-label="Hoofdnavigatie"
        >
          <CinematicNavMenuEntries items={links} resolveHref={resolveHref} variant="floating" />
        </nav>
      </MotionNavShell>
      <MobileNavDrawer open={mobileMenuOpen} onClose={closeMobile} variant="floating">
        {mobileLinkWrap(
          <CinematicNavMenuEntries items={links} resolveHref={resolveHref} variant="floating" />,
          "dark",
        )}
      </MobileNavDrawer>
    </header>
  );
}

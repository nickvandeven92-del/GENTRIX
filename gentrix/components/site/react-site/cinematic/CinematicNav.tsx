"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Menu, X } from "lucide-react";
import type { ReactSiteSection } from "@/lib/site/react-site-schema";
import { CinematicNavMenuEntries } from "@/components/site/react-site/cinematic/cinematic-nav-menu";
import { MotionNavShell } from "@/components/site/react-site/cinematic/cinematic-motion";
import type { ResolveHref } from "./types";
import { cn } from "@/lib/utils";

type NavSection = Extract<ReactSiteSection, { type: "nav_overlay" }>;

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

  return (
    <div className="pointer-events-auto md:hidden">
      <button
        type="button"
        className={cn("fixed inset-0 z-[80]", backdrop)}
        aria-label="Menu sluiten"
        onClick={onClose}
      />
      <div
        className={cn(
          "fixed inset-y-0 right-0 z-[90] flex w-[min(100vw-2.5rem,18rem)] flex-col gap-4 border-l p-5 pt-6 shadow-2xl",
          sheet,
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold tracking-tight">Menu</span>
          <button
            type="button"
            className="rounded-lg p-2 opacity-80 hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10"
            aria-label="Menu sluiten"
            onClick={onClose}
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>
        <nav className="flex flex-col gap-1 overflow-y-auto overscroll-contain" aria-label="Mobiel menu">
          {children}
        </nav>
      </div>
    </div>
  );
}

export function CinematicNav({ section, resolveHref }: { section: NavSection; resolveHref: ResolveHref }) {
  const { logoText, links } = section.props;
  const barStyle = section.props.barStyle ?? "floating";
  const [mobileOpen, setMobileOpen] = useState(false);

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  useEffect(() => {
    if (!mobileOpen) return;
    const mq = window.matchMedia("(min-width: 768px)");
    const onChange = () => {
      if (mq.matches) setMobileOpen(false);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [mobileOpen]);

  const mobileLinkWrap = (node: ReactNode) => (
    <div
      className="contents [&_a]:block [&_a]:rounded-lg [&_a]:px-3 [&_a]:py-2.5 [&_a]:text-sm [&_a]:font-medium [&_details]:rounded-lg [&_details]:border [&_details]:border-zinc-200/80 [&_details]:p-2 dark:[&_details]:border-white/10"
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
          <nav className="hidden items-center gap-x-5 gap-y-2 text-[0.9375rem] md:flex md:text-sm" aria-label="Hoofdnavigatie">
            <CinematicNavMenuEntries items={links} resolveHref={resolveHref} variant="bar_light" />
          </nav>
          <button
            type="button"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-zinc-700 hover:bg-zinc-100 md:hidden"
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? "Menu sluiten" : "Menu openen"}
            onClick={() => setMobileOpen((o) => !o)}
          >
            {mobileOpen ? <X className="size-6" aria-hidden /> : <Menu className="size-6" aria-hidden />}
          </button>
        </div>
        <MobileNavDrawer open={mobileOpen} onClose={closeMobile} variant="bar_light">
          {mobileLinkWrap(<CinematicNavMenuEntries items={links} resolveHref={resolveHref} variant="bar_light" />)}
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
          <nav className="hidden items-center gap-x-5 gap-y-2 text-[0.9375rem] md:flex md:text-sm" aria-label="Hoofdnavigatie">
            <CinematicNavMenuEntries items={links} resolveHref={resolveHref} variant="bar_dark" />
          </nav>
          <button
            type="button"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white hover:bg-white/10 md:hidden"
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? "Menu sluiten" : "Menu openen"}
            onClick={() => setMobileOpen((o) => !o)}
          >
            {mobileOpen ? <X className="size-6" aria-hidden /> : <Menu className="size-6" aria-hidden />}
          </button>
        </div>
        <MobileNavDrawer open={mobileOpen} onClose={closeMobile} variant="bar_dark">
          {mobileLinkWrap(<CinematicNavMenuEntries items={links} resolveHref={resolveHref} variant="bar_dark" />)}
        </MobileNavDrawer>
      </header>
    );
  }

  /* floating — glass pill */
  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-5 sm:pt-6">
      <MotionNavShell
        className={cn(
          "pointer-events-auto flex w-full max-w-5xl flex-col gap-3 rounded-2xl border px-4 py-3 shadow-lg backdrop-blur-md sm:px-5 sm:py-4 md:flex-row md:items-center md:justify-between md:gap-6",
          "border-white/15 bg-black/40",
        )}
        style={{ ...fontSans, borderColor: "rgba(255,255,255,0.14)" }}
      >
        <div className="flex w-full items-center justify-between gap-3 md:contents">
          <span
            className="min-w-0 truncate text-base font-semibold tracking-tight text-white sm:text-lg md:order-none"
            style={fontSerifLogo}
          >
            {logoText}
          </span>
          <button
            type="button"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white hover:bg-white/10 md:hidden"
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? "Menu sluiten" : "Menu openen"}
            onClick={() => setMobileOpen((o) => !o)}
          >
            {mobileOpen ? <X className="size-6" aria-hidden /> : <Menu className="size-6" aria-hidden />}
          </button>
        </div>
        <nav
          className="hidden items-center gap-x-6 gap-y-2 text-[0.9375rem] md:flex md:text-sm"
          aria-label="Hoofdnavigatie"
        >
          <CinematicNavMenuEntries items={links} resolveHref={resolveHref} variant="floating" />
        </nav>
      </MotionNavShell>
      <MobileNavDrawer open={mobileOpen} onClose={closeMobile} variant="floating">
        {mobileLinkWrap(<CinematicNavMenuEntries items={links} resolveHref={resolveHref} variant="floating" />)}
      </MobileNavDrawer>
    </header>
  );
}

"use client";

import { useState, useEffect, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { Menu, X } from "lucide-react";
import type { GeneratedSite, SiteNavigation } from "@/lib/ai/generated-site-schema";
import { SiteRemoteImage } from "@/components/site/site-remote-image";
import {
  resolvePublishedStudioHref,
  STUDIO_SITE_BASE_PLACEHOLDER,
} from "@/lib/site/studio-section-visibility";
import { cn } from "@/lib/utils";

function defaultNav(site: GeneratedSite): SiteNavigation {
  return {
    brandName: site.meta.title,
    links: [
      { label: "Home", href: "#top" },
      { label: "Afspraak", href: "#afspraak" },
    ],
    ctaLabel: "Plan je bezoek",
    ctaHref: "#afspraak",
  };
}

export function SiteNav({ site, publishedSlug }: { site: GeneratedSite; publishedSlug?: string | null }) {
  const [open, setOpen] = useState(false);
  const [menuMounted, setMenuMounted] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const router = useRouter();
  const nav = site.navigation ?? defaultNav(site);
  const logoHomeHref = resolvePublishedStudioHref(STUDIO_SITE_BASE_PLACEHOLDER, publishedSlug) || "#top";

  /**
   * Premium navigatie: <a href> behouden voor SEO/toegankelijkheid/fallback,
   * maar gewone klikken overnemen met JavaScript.
    * - Anchor-links (#id): sluit menu + smooth scroll
    * - Interne paginaLinks: direct router.push() voor snappier gevoel
   * - Externe links of modifier-klikken (Ctrl/Cmd/Shift): normaal laten
   */
  function handleNavLinkClick(e: MouseEvent<HTMLAnchorElement>, href: string) {
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;

    // Anchor-link: sluit menu snel + scroll
    if (href.startsWith("#")) {
      e.preventDefault();
      setOpen(false);
      const id = href.slice(1);
      const el = document.getElementById(id);
      el?.scrollIntoView({ behavior: "smooth" });
      return;
    }

    // Interne paginalink: direct navigeren (geen kunstmatige vertraging)
    try {
      const url = new URL(href, window.location.origin);
      if (url.origin !== window.location.origin) return; // extern → normaal
      e.preventDefault();
      setOpen(false);
      router.push(href);
    } catch {
      // ongeldige URL → normaal
    }
  }

  // Sluit menu bij resize; zelfde breakpoint als md: (≥768px = iPad portrait+ desktop-nav)
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const handleChange = () => {
      setOpen(false);
    };
    mq.addEventListener("change", handleChange);
    return () => mq.removeEventListener("change", handleChange);
  }, []);

  // Close menu when user scrolls
  useEffect(() => {
    let scrollTimeout: ReturnType<typeof setTimeout>;
    const handleScroll = () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        setOpen(false);
      }, 50);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      clearTimeout(scrollTimeout);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setMenuMounted(true);
      const frame = requestAnimationFrame(() => {
        requestAnimationFrame(() => setMenuVisible(true));
      });
      return () => cancelAnimationFrame(frame);
    }

    setMenuVisible(false);
    const timeout = setTimeout(() => setMenuMounted(false), 220);
    return () => clearTimeout(timeout);
  }, [open]);

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--site-fg)]/12 bg-[var(--site-bg)]/95 backdrop-blur-xl supports-[backdrop-filter]:bg-[var(--site-bg)]/88">
      <a href="#top" id="top" className="sr-only">
        Top
      </a>
      <div className="relative z-50 mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 md:px-6">
        <a
          href={logoHomeHref}
          data-studio-brand-mark="1"
          className="group flex min-w-0 items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--site-primary)]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--site-bg)]"
          onClick={(e) => handleNavLinkClick(e, logoHomeHref)}
        >
          {nav.logoImageUrl ? (
            <>
              <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border border-[var(--site-fg)]/10">
                <SiteRemoteImage
                  src={nav.logoImageUrl}
                  alt={nav.brandName}
                  fill
                  className="object-cover"
                  sizes="40px"
                />
              </span>
              <span className="truncate font-serif text-lg font-semibold tracking-tight text-[var(--site-fg)] transition group-hover:text-[var(--site-fg)]/90">
                {nav.brandName}
              </span>
            </>
          ) : (
            <span className="truncate font-serif text-[1.35rem] font-semibold leading-none tracking-[-0.02em] text-[var(--site-fg)] transition group-hover:opacity-90 md:text-[1.65rem]">
              {nav.brandName}
            </span>
          )}
        </a>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Hoofdmenu">
          {nav.links.map((link) => (
            <a
              key={link.label + link.href}
              href={link.href}
              className="rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--site-fg)]/75 transition hover:bg-[var(--site-fg)]/5 hover:text-[var(--site-fg)]"
              onClick={(e) => handleNavLinkClick(e, link.href)}
            >
              {link.label}
            </a>
          ))}
          {nav.ctaLabel && nav.ctaHref && (
            <a
              href={nav.ctaHref}
              className="ml-2 rounded-none bg-[var(--site-primary)] px-5 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-zinc-950 shadow-md transition hover:opacity-95"
              onClick={(e) => handleNavLinkClick(e, nav.ctaHref!)}
            >
              {nav.ctaLabel}
            </a>
          )}
        </nav>

        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-lg text-[var(--site-fg)] transition hover:bg-[var(--site-fg)]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--site-primary)]/40 md:hidden"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label={open ? "Menu sluiten" : "Menu openen"}
        >
          {open ? <X className="size-6" strokeWidth={2} /> : <Menu className="size-6" strokeWidth={2} />}
        </button>
      </div>
      {/* Backdrop — alleen zichtbaar als menu open is */}
      {menuMounted && (
        <button
          type="button"
          aria-label="Menu sluiten"
          className={cn(
            "fixed inset-0 z-40 bg-black/25 transition-opacity duration-200 md:hidden",
            menuVisible ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
          )}
          onClick={() => setOpen(false)}
        />
      )}

      {/*
       * Mobile drawer — altijd in de DOM, zichtbaar via opacity + transition.
       * Header met X-knop om te sluiten.
       */}
      {menuMounted && (
        <div
          className={cn(
            "fixed inset-x-0 top-16 z-50 overflow-hidden border-t border-[var(--site-fg)]/10 bg-[var(--site-bg)] shadow-2xl md:hidden",
            "transition-[opacity,transform] duration-300 ease-out [transition-timing-function:cubic-bezier(0.22,1,0.36,1)] will-change-transform",
            menuVisible ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0",
          )}
          aria-hidden={!menuVisible}
        >
        <div className="flex items-center justify-between gap-2 border-b border-[var(--site-fg)]/10 px-4 py-3">
          <span className="text-xs font-semibold uppercase tracking-widest text-[var(--site-fg)]/75">Menu</span>
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--site-fg)] transition hover:bg-[var(--site-fg)]/10"
            onClick={() => setOpen(false)}
            aria-label="Menu sluiten"
          >
            <X className="size-5" strokeWidth={2} />
          </button>
        </div>
        <nav className="flex flex-col gap-1 px-4 py-4" aria-label="Mobiel menu">
          {nav.links.map((link) => (
            <a
              key={link.label + link.href}
              href={link.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-[var(--site-fg)] hover:bg-transparent hover:text-[var(--site-fg)] active:bg-transparent"
              onClick={(e) => handleNavLinkClick(e, link.href)}
            >
              {link.label}
            </a>
          ))}
          {nav.ctaLabel && nav.ctaHref && (
            <a
              href={nav.ctaHref}
              className="mt-2 rounded-none bg-[var(--site-primary)] px-4 py-3 text-center text-xs font-bold uppercase tracking-[0.12em] text-zinc-950 hover:bg-[var(--site-primary)] active:bg-[var(--site-primary)]"
              onClick={(e) => handleNavLinkClick(e, nav.ctaHref!)}
            >
              {nav.ctaLabel}
            </a>
          )}
        </nav>
        </div>
      )}
    </header>
  );
}

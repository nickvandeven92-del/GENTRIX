"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  ChevronDown,
  FileText,
  Globe,
  Mail,
  Menu,
  MoreHorizontal,
  Phone,
  Plus,
  Search,
  Sparkles,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { pageMetaForPath } from "@/components/sales-os/nav-config";
import { SALES_OS_GUTTER_X_CLASS, SALES_OS_MAIN_MAX_CLASS } from "@/lib/sales-os/layout-shell";
import { cn } from "@/lib/utils";

const QUICK_ACTIONS: { label: string; href?: string; icon: typeof Plus; disabled?: boolean }[] = [
  { label: "Nieuwe lead", href: "/admin/ops/leads", icon: Plus },
  { label: "Nieuwe deal", href: "/admin/ops/deals", icon: FileText },
  { label: "Nieuwe site (studio)", href: "/admin/ops/studio", icon: Globe },
  { label: "Follow-up plannen", icon: Phone, disabled: true },
  { label: "Offerte sturen", icon: Mail, disabled: true },
  { label: "Generatie starten", href: "/admin/ops/studio", icon: Sparkles },
];

type SalesTopbarProps = {
  onOpenSearch: () => void;
  /** Alleen < lg: opent het mobiele navigatiedrawer */
  onOpenMobileNav?: () => void;
};

export function SalesTopbar({ onOpenSearch, onOpenMobileNav }: SalesTopbarProps) {
  const pathname = usePathname();
  const { title, subtitle } = pageMetaForPath(pathname);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, []);

  const isOpsHome = pathname === "/admin/ops" || pathname === "/admin/ops/";
  const compactStudio = (pathname ?? "").startsWith("/admin/ops/studio");

  return (
    <header
      className={cn(
        "sales-os-topbar sticky top-0 z-30 shrink-0 border-b border-neutral-200/80 bg-white/95 backdrop-blur-sm dark:border-zinc-700/80 dark:bg-zinc-900/90",
        SALES_OS_GUTTER_X_CLASS,
      )}
    >
      <div
        className={cn(
          "mx-auto flex min-h-0 w-full items-center gap-2 sm:gap-4",
          compactStudio ? "h-11 py-0" : "h-14",
          SALES_OS_MAIN_MAX_CLASS,
        )}
      >
        {onOpenMobileNav ? (
          <button
            type="button"
            className="flex size-9 shrink-0 items-center justify-center rounded-md border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50 dark:border-zinc-600 dark:bg-zinc-800/50 dark:text-zinc-300 dark:hover:bg-zinc-800 lg:hidden"
            aria-label="Menu openen"
            onClick={onOpenMobileNav}
          >
            <Menu className="size-5" aria-hidden />
          </button>
        ) : null}
        {isOpsHome ? (
          <div className="min-w-0 flex-1" aria-hidden />
        ) : (
          <div className="min-w-0 flex-1">
            <h1
              className={cn(
                "truncate font-semibold text-neutral-900 dark:text-zinc-50",
                compactStudio ? "text-xs md:text-sm" : "text-sm md:text-base",
              )}
            >
              {title}
            </h1>
            {compactStudio ? null : (
              <p className="hidden truncate text-[11px] text-neutral-500 dark:text-zinc-400 sm:block md:text-xs">
                {subtitle}
              </p>
            )}
          </div>
        )}

        <div className="hidden min-w-0 max-w-xl flex-1 md:block">
          <button
            type="button"
            onClick={onOpenSearch}
            className={cn(
              "sales-os-topbar-search flex w-full items-center gap-2 rounded-lg border border-neutral-200 bg-white text-left text-xs text-neutral-500 hover:border-neutral-300 dark:border-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-400 dark:hover:border-zinc-500",
              compactStudio ? "px-2.5 py-1.5" : "px-3 py-2",
            )}
          >
            <Search className="size-3.5 shrink-0 opacity-60" />
            <span className="truncate">Zoek klanten, deals, websites, domeinen…</span>
            <kbd className="ml-auto hidden rounded border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 font-mono text-[10px] text-neutral-400 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-500 lg:inline">
              ⌘K
            </kbd>
          </button>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className={cn(
              "sales-os-glass-primary-btn inline-flex items-center gap-1.5 rounded-md border border-transparent bg-neutral-950 text-xs font-medium text-white hover:bg-neutral-800 dark:border-transparent dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white",
              compactStudio ? "px-2 py-1.5" : "px-3 py-2",
            )}
          >
            Snelle acties
            <ChevronDown className={cn("size-3.5 opacity-80 transition-transform", menuOpen && "rotate-180")} />
          </button>
          {menuOpen ? (
            <div className="absolute right-0 top-full z-50 mt-1 w-56 rounded-md border border-neutral-200 bg-white py-1 dark:border-zinc-600 dark:bg-zinc-900">
              {QUICK_ACTIONS.map((a) =>
                a.href && !a.disabled ? (
                  <Link
                    key={a.label}
                    href={a.href}
                    onClick={() => setMenuOpen(false)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-neutral-700 hover:bg-neutral-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    <a.icon className="size-3.5 text-neutral-500" />
                    {a.label}
                  </Link>
                ) : (
                  <button
                    key={a.label}
                    type="button"
                    disabled
                    title="Nog niet gekoppeld"
                    className="flex w-full cursor-not-allowed items-center gap-2 px-3 py-2 text-left text-xs text-neutral-400 dark:text-zinc-500"
                  >
                    <a.icon className="size-3.5" />
                    {a.label}
                  </button>
                ),
              )}
            </div>
          ) : null}
          </div>

          <button
          type="button"
          className="flex size-9 items-center justify-center rounded-md border border-neutral-200 bg-white text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900 dark:border-zinc-600 dark:bg-zinc-800/50 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          aria-label="Meldingen"
        >
          <Bell className="size-4" />
        </button>

        <button
          type="button"
          className="flex size-9 items-center justify-center rounded-md border border-neutral-200 bg-white text-neutral-500 hover:bg-neutral-50 dark:border-zinc-600 dark:bg-zinc-800/50 dark:text-zinc-400 dark:hover:bg-zinc-800"
          aria-label="Account"
        >
          <MoreHorizontal className="size-4" />
        </button>
      </div>
      </div>
    </header>
  );
}

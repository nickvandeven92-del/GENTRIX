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
  MessageCircle,
  MoreHorizontal,
  Phone,
  Plus,
  Search,
  Sparkles,
  X,
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
  /** Alleen < lg: hamburger toggelt drawer; bij `open` toont de knop een X (sluiten). */
  mobileNav?: { open: boolean; onToggle: () => void };
};

type InboxSummary = {
  totalAwaiting: number;
  items: { threadId: string; subfolder_slug: string; subject: string; updated_at: string }[];
};

export function SalesTopbar({ onOpenSearch, mobileNav }: SalesTopbarProps) {
  const pathname = usePathname();
  const { title, subtitle } = pageMetaForPath(pathname);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [bellOpen, setBellOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);
  const [inbox, setInbox] = useState<InboxSummary | null>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
      if (!bellRef.current?.contains(e.target as Node)) setBellOpen(false);
    }
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadInbox() {
      try {
        const res = await fetch("/api/admin/support-inbox-summary", { credentials: "include" });
        const j = (await res.json()) as {
          ok?: boolean;
          totalAwaiting?: number;
          items?: InboxSummary["items"];
        };
        if (cancelled || !j?.ok) return;
        setInbox({
          totalAwaiting: j.totalAwaiting ?? 0,
          items: Array.isArray(j.items) ? j.items : [],
        });
      } catch {
        /* ignore */
      }
    }
    void loadInbox();
    const t = window.setInterval(loadInbox, 55_000);
    const onVis = () => {
      if (document.visibilityState === "visible") void loadInbox();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      window.clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
    };
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
        {mobileNav ? (
          <button
            type="button"
            className="flex size-9 shrink-0 items-center justify-center rounded-md border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50 dark:border-zinc-600 dark:bg-zinc-800/50 dark:text-zinc-300 dark:hover:bg-zinc-800 lg:hidden"
            aria-expanded={mobileNav.open}
            aria-label={mobileNav.open ? "Menu sluiten" : "Menu openen"}
            onClick={mobileNav.onToggle}
          >
            {mobileNav.open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
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
              <Link
                href="/admin/ops/support-inbox"
                onClick={() => setMenuOpen(false)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-neutral-700 hover:bg-neutral-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                <MessageCircle className="size-3.5 text-neutral-500" aria-hidden />
                <span className="flex-1 truncate">Support-inbox</span>
                {inbox && inbox.totalAwaiting > 0 ? (
                  <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-amber-950 dark:bg-amber-950/80 dark:text-amber-100">
                    {inbox.totalAwaiting}
                  </span>
                ) : null}
              </Link>
              <div className="my-1 border-t border-neutral-100 dark:border-zinc-800" />
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

          <div className="relative" ref={bellRef}>
            <button
              type="button"
              onClick={() => setBellOpen((o) => !o)}
              className="relative flex size-9 items-center justify-center rounded-md border border-neutral-200 bg-white text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900 dark:border-zinc-600 dark:bg-zinc-800/50 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              aria-label={inbox && inbox.totalAwaiting > 0 ? `${inbox.totalAwaiting} open support-onderwerpen` : "Meldingen"}
              aria-expanded={bellOpen}
            >
              <Bell className="size-4" />
              {inbox && inbox.totalAwaiting > 0 ? (
                <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-amber-500 text-[9px] font-bold text-white dark:bg-amber-600">
                  {inbox.totalAwaiting > 9 ? "9+" : inbox.totalAwaiting}
                </span>
              ) : null}
            </button>
            {bellOpen ? (
              <div className="absolute right-0 top-full z-50 mt-1 w-[min(100vw-2rem,20rem)] rounded-md border border-neutral-200 bg-white py-2 shadow-lg dark:border-zinc-600 dark:bg-zinc-900">
                <div className="border-b border-neutral-100 px-3 pb-2 dark:border-zinc-800">
                  <p className="text-xs font-semibold text-neutral-900 dark:text-zinc-50">Support</p>
                  <p className="mt-0.5 text-[11px] text-neutral-500 dark:text-zinc-400">
                    Laatste bericht van de klant — wacht op antwoord.
                  </p>
                </div>
                {!inbox || inbox.totalAwaiting === 0 ? (
                  <p className="px-3 py-3 text-xs text-neutral-500 dark:text-zinc-400">Niets open.</p>
                ) : (
                  <ul className="max-h-64 overflow-y-auto py-1">
                    {inbox.items.map((it) => {
                      const enc = encodeURIComponent(it.subfolder_slug);
                      return (
                        <li key={it.threadId}>
                          <Link
                            href={`/admin/clients/${enc}/support`}
                            onClick={() => setBellOpen(false)}
                            className="block px-3 py-2 hover:bg-neutral-50 dark:hover:bg-zinc-800"
                          >
                            <span className="block truncate text-xs font-medium text-neutral-900 dark:text-zinc-100">
                              {it.subject}
                            </span>
                            <span className="mt-0.5 block font-mono text-[10px] text-neutral-500 dark:text-zinc-500">
                              {it.subfolder_slug}
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
                <div className="border-t border-neutral-100 px-2 pt-1 dark:border-zinc-800">
                  <Link
                    href="/admin/ops/support-inbox"
                    onClick={() => setBellOpen(false)}
                    className="block rounded-md px-2 py-1.5 text-center text-xs font-medium text-violet-700 hover:bg-violet-50 dark:text-violet-300 dark:hover:bg-violet-950/40"
                  >
                    Volledige inbox
                  </Link>
                </div>
              </div>
            ) : null}
          </div>

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

"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SalesSidebar, SalesSidebarContent } from "@/components/sales-os/sidebar";
import { SalesTopbar } from "@/components/sales-os/topbar";
import { SALES_OS_GUTTER_X_CLASS, SALES_OS_MAIN_MAX_CLASS } from "@/lib/sales-os/layout-shell";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "sales-os-sidebar-collapsed";

function isSiteEditorPath(pathname: string) {
  return pathname.startsWith("/admin/editor");
}

type SalesOsShellProps = {
  children: ReactNode;
};

/** Vercel-achtige shell: #fafafa zijbalk, wit werkvlak, Geist (via globals.css). */
export function SalesOsShell({ children }: SalesOsShellProps) {
  const pathname = usePathname() ?? "";
  const siteEditor = isSiteEditorPath(pathname);
  const [collapsed, setCollapsed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      if (v === "1") setCollapsed(true);
    } catch {
      /* ignore */
    }
  }, []);

  const onToggleCollapse = useCallback(() => {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const onOpenSearch = useCallback(() => setSearchOpen(true), []);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileNavOpen]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === "Escape") {
        setSearchOpen(false);
        setMobileNavOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const mainMargin = collapsed ? "lg:ml-[84px]" : "lg:ml-[220px]";

  const inputFocus =
    "focus:border-neutral-950 focus:outline-none focus:ring-1 focus:ring-neutral-950/10 dark:focus:border-zinc-100 dark:focus:ring-zinc-100/15";

  return (
    <div className="sales-os min-h-screen bg-[#fafafa] font-sans text-[13px] leading-normal text-neutral-900 antialiased dark:bg-zinc-950 dark:text-zinc-100">
      <SalesSidebar
        collapsed={collapsed}
        onToggleCollapse={onToggleCollapse}
        onOpenSearch={onOpenSearch}
      />

      {mobileNavOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-[45] bg-neutral-950/40 backdrop-blur-[1px] dark:bg-black/60 lg:hidden"
          aria-label="Menu sluiten"
          onClick={() => setMobileNavOpen(false)}
        />
      ) : null}

      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-[min(100vw,280px)] max-w-full transform border-r border-neutral-200 bg-[#fafafa] shadow-xl transition-transform duration-200 ease-out dark:border-zinc-700/80 dark:bg-zinc-950 lg:hidden",
          mobileNavOpen ? "translate-x-0" : "-translate-x-full pointer-events-none",
        )}
        aria-hidden={!mobileNavOpen}
      >
        <SalesSidebarContent
          collapsed={collapsed}
          onToggleCollapse={onToggleCollapse}
          onOpenSearch={onOpenSearch}
          onNavLinkClick={() => setMobileNavOpen(false)}
          mobileClose={() => setMobileNavOpen(false)}
        />
      </div>

      <div
        className={cn(
          "sales-os-workspace flex min-w-0 flex-col bg-white transition-[margin] duration-200 ease-out dark:bg-zinc-900",
          siteEditor ? "h-dvh max-h-dvh overflow-hidden" : "min-h-screen",
          mainMargin,
        )}
      >
        <div className="sales-os-print-hide">
          <SalesTopbar onOpenSearch={onOpenSearch} onOpenMobileNav={() => setMobileNavOpen(true)} />
        </div>
        <div
          className={cn(
            "sales-os-main-area min-h-0 min-w-0 w-full flex-1",
            siteEditor ? "flex flex-col py-0" : "py-6 md:py-8",
            siteEditor ? "px-0" : SALES_OS_GUTTER_X_CLASS,
          )}
        >
          <div
            className={cn(
              "sales-os-main-frame min-w-0 w-full",
              siteEditor
                ? "mx-0 flex max-w-none flex-1 flex-col overflow-hidden"
                : cn("mx-auto", SALES_OS_MAIN_MAX_CLASS),
            )}
          >
            {children}
          </div>
        </div>
      </div>

      {searchOpen ? (
        <button
          type="button"
          className="sales-os-search-backdrop fixed inset-0 z-[100] bg-neutral-950/10 dark:bg-black/50"
          aria-label="Sluit zoeken"
          onClick={() => setSearchOpen(false)}
        />
      ) : null}
      {searchOpen ? (
        <div className="sales-os-search-popover fixed left-1/2 top-[15vh] z-[101] w-[min(560px,calc(100%-2rem))] -translate-x-1/2 rounded-lg border border-neutral-200 bg-white p-4 dark:border-zinc-600 dark:bg-zinc-900">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-zinc-400">Zoeken</p>
          <input
            autoFocus
            className={cn(
              "w-full rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 dark:border-zinc-600 dark:bg-zinc-800/80 dark:text-zinc-100 dark:placeholder:text-zinc-500",
              inputFocus,
            )}
            placeholder="Zoek klanten, deals, websites, domeinen…"
          />
          <p className="mt-3 text-[11px] text-neutral-500 dark:text-zinc-400">
            Koppel aan{" "}
            <Link
              href="/admin/search"
              className="font-medium text-neutral-900 underline underline-offset-2 hover:no-underline dark:text-zinc-100"
              onClick={() => setSearchOpen(false)}
            >
              /admin/search
            </Link>{" "}
            voor resultaten.
          </p>
        </div>
      ) : null}
    </div>
  );
}

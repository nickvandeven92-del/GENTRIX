"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Plus, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  BUSINESS_OS_SIDEBAR_NAV,
  businessOsDefaultOpenGroupIds,
  businessOsGroupHasActive,
  businessOsNavItemIsActive,
  type BusinessOsNavGroup,
} from "@/lib/admin/business-os-nav";
import { ADMIN_STUDIO_NAME } from "@/lib/constants";

type SalesSidebarProps = {
  collapsed: boolean;
  onToggleCollapse: () => void;
  onOpenSearch: () => void;
};

function flattenNavLeaves() {
  return BUSINESS_OS_SIDEBAR_NAV.flatMap((n) => (n.type === "group" ? n.children : [n]));
}

export type SalesSidebarContentProps = {
  collapsed: boolean;
  onToggleCollapse: () => void;
  onOpenSearch: () => void;
  /** Mobiel: na navigatie drawer sluiten */
  onNavLinkClick?: () => void;
  /**
   * Mobiele drawer: volledige labels, geen inklappen; sluitknop i.p.v. collapse.
   * Als gezet, gedraagt de header zich als menu-header.
   */
  mobileClose?: () => void;
};

export function SalesSidebarContent({
  collapsed,
  onToggleCollapse,
  onOpenSearch,
  onNavLinkClick,
  mobileClose,
}: SalesSidebarContentProps) {
  const pathname = usePathname();
  const effectiveCollapsed = mobileClose ? false : collapsed;

  const defaultOpen = useMemo(() => businessOsDefaultOpenGroupIds(pathname), [pathname]);
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => defaultOpen);

  useEffect(() => {
    queueMicrotask(() => {
      setOpenGroups((prev) => {
        const next = new Set(prev);
        for (const id of businessOsDefaultOpenGroupIds(pathname)) next.add(id);
        return next;
      });
    });
  }, [pathname]);

  const toggleGroup = useCallback((label: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }, []);

  const afterNav = useCallback(() => {
    onNavLinkClick?.();
  }, [onNavLinkClick]);

  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col bg-[#fafafa] text-neutral-800 dark:bg-zinc-950 dark:text-zinc-200",
        mobileClose
          ? "w-full min-w-[min(100vw,280px)] max-w-[min(100vw,280px)]"
          : "w-full min-w-0",
      )}
    >
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-neutral-200 px-3 dark:border-zinc-700/80">
        {!effectiveCollapsed ? (
          <Link
            href="/admin/ops"
            onClick={afterNav}
            className="min-w-0 flex-1 truncate text-sm font-semibold tracking-tight text-neutral-900 dark:text-zinc-50"
          >
            {ADMIN_STUDIO_NAME}
          </Link>
        ) : (
          <Link
            href="/admin/ops"
            onClick={afterNav}
            className="mx-auto flex size-9 items-center justify-center rounded-md border border-neutral-200 bg-white text-xs font-bold text-neutral-900 dark:border-zinc-600 dark:bg-zinc-800/80 dark:text-zinc-100"
            title={ADMIN_STUDIO_NAME}
          >
            WF
          </Link>
        )}
        {mobileClose ? (
          <button
            type="button"
            onClick={mobileClose}
            className="flex size-8 shrink-0 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            aria-label="Menu sluiten"
          >
            <X className="size-4" />
          </button>
        ) : !effectiveCollapsed ? (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="flex size-8 shrink-0 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            aria-label="Zijbalk inklappen"
          >
            <ChevronLeft className="size-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="absolute -right-3 top-5 z-50 flex size-6 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-500 hover:text-neutral-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100"
            aria-label="Zijbalk uitklappen"
          >
            <ChevronRight className="size-3.5" />
          </button>
        )}
      </div>

      <div className="border-b border-neutral-200 px-3 py-2 dark:border-zinc-700/80">
        <button
          type="button"
          onClick={() => {
            onOpenSearch();
            afterNav();
          }}
          className={cn(
            "sales-os-sidebar-search flex w-full items-center gap-2 rounded-md border border-neutral-200/80 bg-white px-2.5 py-2 text-left text-xs text-neutral-500 hover:border-neutral-300 hover:text-neutral-800 dark:border-zinc-600/80 dark:bg-zinc-800/40 dark:text-zinc-400 dark:hover:border-zinc-500 dark:hover:text-zinc-100",
            effectiveCollapsed && "justify-center px-0",
          )}
        >
          <Search className="size-4 shrink-0 opacity-70" />
          {!effectiveCollapsed ? <span className="truncate">Zoeken…</span> : null}
        </button>
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-2" aria-label="Business OS">
        {effectiveCollapsed ? (
          <div className="flex flex-col gap-0.5">
            {flattenNavLeaves().map((item) => {
              const active = businessOsNavItemIsActive(pathname, item.href, item.label);
              const Icon = item.icon;
              return (
                <Link
                  key={`${item.href}-${item.label}`}
                  href={item.href}
                  onClick={afterNav}
                  title={item.label}
                  className={cn(
                    "flex items-center justify-center rounded-md py-2 transition-colors",
                    active
                      ? "bg-neutral-100 text-neutral-900 dark:bg-zinc-800 dark:text-zinc-50"
                      : "text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900 dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-100",
                  )}
                >
                  <Icon className="size-[18px] shrink-0" aria-hidden />
                </Link>
              );
            })}
          </div>
        ) : (
          BUSINESS_OS_SIDEBAR_NAV.map((node) => {
            if (node.type !== "group") return null;
            const group = node as BusinessOsNavGroup;
            const isOpen = openGroups.has(group.label);
            const groupActive = businessOsGroupHasActive(pathname, group);
            return (
              <div key={group.label} className="rounded-md">
                <button
                  type="button"
                  onClick={() => toggleGroup(group.label)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide transition-colors",
                    groupActive ? "text-neutral-800 dark:text-zinc-200" : "text-neutral-400 hover:text-neutral-600 dark:text-zinc-500 dark:hover:text-zinc-400",
                  )}
                  aria-expanded={isOpen}
                >
                  {group.label}
                  <ChevronDown
                    className={cn(
                      "size-3.5 shrink-0 text-neutral-400 transition-transform duration-200 dark:text-zinc-500",
                      isOpen && "rotate-180",
                    )}
                    aria-hidden
                  />
                </button>
                {isOpen ? (
                  <div className="mt-0.5 flex flex-col gap-0.5 pb-1">
                    {group.children.map((item) => {
                      const active = businessOsNavItemIsActive(pathname, item.href, item.label);
                      const Icon = item.icon;
                      return (
                        <Link
                          key={`${item.href}-${item.label}`}
                          href={item.href}
                          onClick={afterNav}
                          className={cn(
                            "flex items-center gap-3 rounded-md py-2 pl-2 pr-2 text-left transition-colors",
                            active
                              ? "bg-neutral-100 font-medium text-neutral-900 dark:bg-zinc-800 dark:text-zinc-50"
                              : "text-neutral-600 hover:bg-neutral-50 dark:text-zinc-300 dark:hover:bg-zinc-800/50",
                          )}
                        >
                          <Icon
                            className={cn(
                              "size-[18px] shrink-0",
                              active ? "text-neutral-900 dark:text-zinc-50" : "text-neutral-500 dark:text-zinc-400",
                            )}
                          />
                          <span className="truncate text-[13px]">{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </nav>

      <div className="shrink-0 border-t border-neutral-200 px-3 py-2 dark:border-zinc-700/80">
        <Link
          href="/admin/ops/studio"
          onClick={afterNav}
          className={cn(
            "sales-os-sidebar-cta mb-2 flex w-full items-center justify-center gap-2 rounded-md bg-neutral-950 py-2.5 text-xs font-medium text-white hover:bg-neutral-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white",
            effectiveCollapsed && "px-0",
          )}
        >
          <Plus className="size-4" />
          {!effectiveCollapsed ? "Snel aanmaken" : null}
        </Link>
        <div
          className={cn(
            "sales-os-sidebar-user flex items-center gap-2 rounded-md border border-neutral-200/80 bg-white px-2 py-2 dark:border-zinc-600/80 dark:bg-zinc-800/40",
            effectiveCollapsed && "justify-center px-0",
          )}
        >
          <div className="sales-os-sidebar-user-avatar flex size-8 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-[10px] font-semibold text-neutral-700 dark:bg-zinc-600 dark:text-zinc-100">
            AD
          </div>
          {!effectiveCollapsed ? (
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-neutral-900 dark:text-zinc-50">Admin</p>
              <p className="truncate text-[11px] text-neutral-500 dark:text-zinc-400">Workspace</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function SalesSidebar({ collapsed, onToggleCollapse, onOpenSearch }: SalesSidebarProps) {
  const w = collapsed ? "w-[84px]" : "w-[220px]";

  return (
    <aside
      className={cn(
        "sales-os-sidebar fixed left-0 top-0 z-40 hidden h-screen shrink-0 flex-col border-r border-neutral-200 bg-[#fafafa] transition-[width] duration-200 ease-out dark:border-zinc-700/80 dark:bg-zinc-950 lg:flex lg:flex-col",
        w,
      )}
    >
      <SalesSidebarContent
        collapsed={collapsed}
        onToggleCollapse={onToggleCollapse}
        onOpenSearch={onOpenSearch}
      />
    </aside>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Globe2, LayoutDashboard, Menu, Settings, Users, X } from "lucide-react";
import {
  BUSINESS_OS_SIDEBAR_NAV,
  businessOsDefaultOpenGroupIds,
  businessOsGroupHasActive,
  businessOsNavItemIsActive,
  type BusinessOsNavGroup,
} from "@/lib/admin/business-os-nav";
import { ADMIN_STUDIO_NAME } from "@/lib/constants";
import {
  getActiveHubSection,
  HUB_TAB_HREF,
  isSubNavItemActive,
  SUB_NAV,
  type HubSectionId,
} from "@/lib/admin/hub-nav-config";
import { AdminGlobalSearch } from "@/components/admin/admin-global-search";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { cn } from "@/lib/utils";

const HUB_ICONS: Record<HubSectionId, typeof LayoutDashboard> = {
  dashboard: LayoutDashboard,
  klanten: Users,
  websites: Globe2,
  instellingen: Settings,
};

const HUB_LABELS: Record<HubSectionId, string> = {
  dashboard: "Dashboard",
  klanten: "Klanten",
  websites: "Websites",
  instellingen: "Instellingen",
};

const HUB_ORDER: HubSectionId[] = ["dashboard", "klanten", "websites", "instellingen"];

function flattenBusinessOsLeaves() {
  return BUSINESS_OS_SIDEBAR_NAV.flatMap((n) => (n.type === "group" ? n.children : [n]));
}

type AdminHubLayoutProps = {
  children: React.ReactNode;
};

export function AdminHubLayout({ children }: AdminHubLayoutProps) {
  const pathname = usePathname();
  const activeSection = getActiveHubSection(pathname);
  const sub = SUB_NAV[activeSection];
  const [mobileOpen, setMobileOpen] = useState(false);
  const dashboardNav = activeSection === "dashboard";

  const defaultOpen = useMemo(() => businessOsDefaultOpenGroupIds(pathname), [pathname]);
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => defaultOpen);

  useEffect(() => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      for (const id of businessOsDefaultOpenGroupIds(pathname)) next.add(id);
      return next;
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

  const renderGroupsNav = (onNavigate?: () => void) => (
    <div className="flex flex-col gap-1">
      {BUSINESS_OS_SIDEBAR_NAV.map((node) => {
        if (node.type !== "group") return null;
        const group = node as BusinessOsNavGroup;
        const expanded = openGroups.has(group.label);
        return (
          <div key={group.label} className="rounded-lg">
            <button
              type="button"
              onClick={() => toggleGroup(group.label)}
              className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-500 hover:bg-zinc-50"
              aria-expanded={expanded}
            >
              {group.label}
              <ChevronDown
                className={cn("size-4 shrink-0 text-zinc-400 transition-transform duration-200", expanded ? "rotate-180" : "rotate-0")}
                aria-hidden
              />
            </button>
            {expanded ? (
              <div className="ml-1 flex flex-col gap-0.5 border-l border-zinc-100 pl-2 dark:border-zinc-800">
                {group.children.map((item) => {
                  const active = businessOsNavItemIsActive(pathname, item.href, item.label);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={`${item.href}-${item.label}`}
                      href={item.href}
                      onClick={() => onNavigate?.()}
                      className={cn(
                        "flex items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors",
                        active ? "bg-zinc-900 font-medium text-white" : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900",
                      )}
                    >
                      <Icon className="size-4 shrink-0 opacity-80" aria-hidden />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <header className="relative sticky top-0 z-50 border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex h-14 items-stretch justify-between gap-3 px-4 md:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-6">
            <Link
              href="/admin/ops"
              className="flex shrink-0 items-center text-base font-semibold tracking-tight text-zinc-900"
              onClick={() => setMobileOpen(false)}
            >
              {ADMIN_STUDIO_NAME}
            </Link>

            <nav className="hidden h-full min-w-0 lg:flex" aria-label="Hoofdmodules">
              {HUB_ORDER.map((id) => {
                const Icon = HUB_ICONS[id];
                const isActive = activeSection === id;
                return (
                  <Link
                    key={id}
                    href={HUB_TAB_HREF[id]}
                    className={cn(
                      "flex h-full items-center gap-2 border-b-2 px-3 text-sm font-medium transition-colors",
                      isActive
                        ? "border-zinc-900 text-zinc-900"
                        : "border-transparent text-zinc-500 hover:text-zinc-800",
                    )}
                  >
                    <Icon className="size-4 opacity-80" aria-hidden />
                    {HUB_LABELS[id]}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex h-full shrink-0 items-center gap-2 md:gap-3">
            <div className="hidden w-full min-w-[12rem] max-w-xs md:block lg:max-w-md">
              <AdminGlobalSearch />
            </div>
            <Link
              href="/"
              className="hidden text-sm text-zinc-500 hover:text-zinc-800 sm:inline"
              title="Open je publieke homepage (showroom / marketing-site)"
            >
              Showroom
            </Link>
            <div className="hidden sm:block">
              <SignOutButton variant="header" />
            </div>
            <button
              type="button"
              className="inline-flex rounded-lg p-2 text-zinc-600 hover:bg-zinc-100 lg:hidden"
              aria-expanded={mobileOpen}
              aria-label="Menu"
              onClick={() => setMobileOpen((o) => !o)}
            >
              {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>

        <div className="border-t border-zinc-100 px-2 py-2 lg:hidden">
          <div className="flex gap-1 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {HUB_ORDER.map((id) => {
              const Icon = HUB_ICONS[id];
              const isActive = activeSection === id;
              return (
                <Link
                  key={id}
                  href={HUB_TAB_HREF[id]}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium",
                    isActive ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600",
                  )}
                >
                  <Icon className="size-3.5 opacity-90" aria-hidden />
                  {HUB_LABELS[id]}
                </Link>
              );
            })}
          </div>
          <div className="mt-2 md:hidden">
            <AdminGlobalSearch />
          </div>
        </div>

        {mobileOpen ? (
          <div className="absolute left-0 right-0 top-full z-50 max-h-[min(80vh,520px)] overflow-y-auto border-b border-zinc-200 bg-white p-4 shadow-lg lg:hidden">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
              {dashboardNav ? "Menu" : sub.title}
            </p>
            {dashboardNav ? (
              <div className="mt-2">{renderGroupsNav(() => setMobileOpen(false))}</div>
            ) : (
              <ul className="mt-2 space-y-1">
                {sub.items.map((item) => (
                  <li key={`${item.href}-${item.label}`}>
                    <Link
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        "block rounded-lg px-3 py-2 text-sm font-medium",
                        isSubNavItemActive(pathname, item)
                          ? "bg-zinc-900 text-white"
                          : "text-zinc-700 hover:bg-zinc-100",
                      )}
                    >
                      {item.label}
                      {item.description ? (
                        <span className="mt-0.5 block text-xs font-normal opacity-80">{item.description}</span>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4 border-t border-zinc-100 pt-4 sm:hidden">
              <SignOutButton variant="header" className="w-full justify-center" />
            </div>
          </div>
        ) : null}
      </header>

      <div className="flex min-h-[calc(100vh-3.5rem)]">
        <aside className="hidden w-56 shrink-0 border-r border-zinc-200 bg-white lg:block" aria-label="Submenu">
          <div className="sticky top-14 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
              {dashboardNav ? "Business OS" : sub.title}
            </p>
            {dashboardNav ? (
              <nav className="mt-3" aria-label="Business OS menu">
                {renderGroupsNav()}
              </nav>
            ) : (
              <nav className="mt-3 flex flex-col gap-0.5">
                {sub.items.map((item) => {
                  const active = isSubNavItemActive(pathname, item);
                  return (
                    <Link
                      key={`${item.href}-${item.label}`}
                      href={item.href}
                      className={cn(
                        "group rounded-lg px-3 py-2.5 text-sm transition-colors",
                        active
                          ? "bg-zinc-900 font-medium text-white"
                          : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900",
                      )}
                    >
                      <span className="flex items-center justify-between gap-2">
                        {item.label}
                        {active ? (
                          <span className="text-xs opacity-70" aria-hidden>
                            →
                          </span>
                        ) : null}
                      </span>
                      {item.description ? (
                        <span
                          className={cn(
                            "mt-0.5 block text-xs leading-snug",
                            active ? "text-zinc-300" : "text-zinc-400 group-hover:text-zinc-500",
                          )}
                        >
                          {item.description}
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </nav>
            )}
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <div className="border-b border-zinc-200 bg-white px-4 py-2 lg:hidden">
            <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {dashboardNav
                ? flattenBusinessOsLeaves().map((item) => {
                    const active = businessOsNavItemIsActive(pathname, item.href, item.label);
                    const Icon = item.icon;
                    return (
                      <Link
                        key={`${item.href}-${item.label}`}
                        href={item.href}
                        className={cn(
                          "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium",
                          active ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600",
                        )}
                      >
                        <Icon className="size-3.5 opacity-90" aria-hidden />
                        {item.label}
                      </Link>
                    );
                  })
                : sub.items.map((item) => {
                    const active = isSubNavItemActive(pathname, item);
                    return (
                      <Link
                        key={`${item.href}-${item.label}`}
                        href={item.href}
                        className={cn(
                          "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium",
                          active ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600",
                        )}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
            </div>
          </div>
          <main className="mx-auto max-w-6xl p-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:p-8">{children}</main>
        </div>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { Calendar, Clock, LayoutDashboard, Scissors, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { PortalAppointmentsClient } from "@/components/portal/portal-appointments-client";
import { PortalBookingServicesClient } from "@/components/portal/portal-booking-services-client";
import { PortalStaffClient } from "@/components/portal/portal-staff-client";
import { PortalPlanningWeekClient } from "@/components/portal/portal-planning-week-client";

export type PortalBookingsTab = "overzicht" | "afspraken" | "behandelingen" | "medewerkers" | "planning";

const TAB_VALUES: PortalBookingsTab[] = [
  "overzicht",
  "afspraken",
  "behandelingen",
  "medewerkers",
  "planning",
];

function isPortalBookingsTab(v: string | null): v is PortalBookingsTab {
  return v !== null && (TAB_VALUES as string[]).includes(v);
}

type NavItem = { tab: PortalBookingsTab; label: string; icon: typeof LayoutDashboard };

const navItems: NavItem[] = [
  { tab: "overzicht", label: "Overzicht", icon: LayoutDashboard },
  { tab: "afspraken", label: "Afspraken", icon: Calendar },
  { tab: "behandelingen", label: "Diensten", icon: Scissors },
  { tab: "medewerkers", label: "Medewerkers", icon: Users },
  { tab: "planning", label: "Planning", icon: Clock },
];

type OverviewStats = {
  loading: boolean;
  todayCount: number;
  upcomingWeek: number;
  activeStaff: number;
  activeServices: number;
};

function BookingsHubInner({ slug, clientName }: { slug: string; clientName: string }) {
  const enc = encodeURIComponent(decodeURIComponent(slug));
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const tabParam = searchParams.get("tab");
  const activeTab: PortalBookingsTab = isPortalBookingsTab(tabParam) ? tabParam : "overzicht";

  const setTab = useCallback(
    (tab: PortalBookingsTab) => {
      const next = new URLSearchParams(searchParams.toString());
      if (tab === "overzicht") {
        next.delete("tab");
      } else {
        next.set("tab", tab);
      }
      const q = next.toString();
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const [stats, setStats] = useState<OverviewStats>({
    loading: true,
    todayCount: 0,
    upcomingWeek: 0,
    activeStaff: 0,
    activeServices: 0,
  });

  useEffect(() => {
    if (activeTab !== "overzicht") return;

    let cancelled = false;
    (async () => {
      setStats((s) => ({ ...s, loading: true }));
      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const weekEnd = new Date(today);
        weekEnd.setDate(weekEnd.getDate() + 7);

        const [aRes, stRes, svcRes] = await Promise.all([
          fetch(`/api/portal/clients/${enc}/appointments`, { credentials: "include" }),
          fetch(`/api/portal/clients/${enc}/staff`, { credentials: "include" }),
          fetch(`/api/portal/clients/${enc}/booking-services`, { credentials: "include" }),
        ]);
        const aJson = (await aRes.json()) as {
          ok?: boolean;
          appointments?: { starts_at: string; ends_at: string; status?: string }[];
        };
        const stJson = (await stRes.json()) as { ok?: boolean; staff?: { is_active?: boolean }[] };
        const svcJson = (await svcRes.json()) as {
          ok?: boolean;
          services?: { is_active?: boolean }[];
        };

        const list = aRes.ok && aJson.ok && Array.isArray(aJson.appointments) ? aJson.appointments : [];
        const staff = stRes.ok && stJson.ok && Array.isArray(stJson.staff) ? stJson.staff : [];
        const services = svcRes.ok && svcJson.ok && Array.isArray(svcJson.services) ? svcJson.services : [];

        const todayEnd = new Date(today);
        todayEnd.setHours(23, 59, 59, 999);

        let todayCount = 0;
        let upcomingWeek = 0;
        for (const row of list) {
          if (row.status === "cancelled") continue;
          const s = new Date(row.starts_at);
          if (Number.isNaN(s.getTime())) continue;
          if (s >= today && s <= todayEnd) todayCount += 1;
          if (s >= today && s < weekEnd) upcomingWeek += 1;
        }

        const activeStaff = staff.filter((m) => m.is_active !== false).length;
        const activeServices = services.filter((x) => x.is_active !== false).length;

        if (!cancelled) {
          setStats({
            loading: false,
            todayCount,
            upcomingWeek,
            activeStaff,
            activeServices,
          });
        }
      } catch {
        if (!cancelled) {
          setStats({
            loading: false,
            todayCount: 0,
            upcomingWeek: 0,
            activeStaff: 0,
            activeServices: 0,
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeTab, enc]);

  const portalBase = useMemo(() => `/portal/${enc}`, [enc]);

  return (
    <div className="flex min-h-[min(70vh,720px)] flex-col gap-0 lg:flex-row lg:gap-0">
      <aside
        className={cn(
          "hidden shrink-0 border-zinc-200 bg-zinc-900 text-zinc-100 lg:flex lg:w-56 lg:flex-col lg:border-r",
          "dark:border-zinc-700",
        )}
      >
        <div className="border-b border-zinc-700 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Boekingen</p>
          <p className="mt-1 truncate text-sm font-semibold text-white">{clientName}</p>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 p-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.tab;
            return (
              <button
                key={item.tab}
                type="button"
                onClick={() => setTab(item.tab)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                  active ? "bg-zinc-100 font-medium text-zinc-900" : "text-zinc-300 hover:bg-zinc-800 hover:text-white",
                )}
              >
                <Icon className="size-4 shrink-0 opacity-90" aria-hidden />
                {item.label}
              </button>
            );
          })}
        </nav>
        <div className="border-t border-zinc-700 p-2">
          <Link
            href={portalBase}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-white"
          >
            ← Portaal-dashboard
          </Link>
        </div>
      </aside>

      <div
        className={cn(
          "flex gap-0.5 overflow-x-auto border-b border-zinc-200 bg-white px-1 py-1 lg:hidden",
          "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          "dark:border-zinc-800 dark:bg-zinc-900",
        )}
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.tab;
          return (
            <button
              key={item.tab}
              type="button"
              onClick={() => setTab(item.tab)}
              className={cn(
                "flex min-w-[4.25rem] shrink-0 flex-col items-center justify-center rounded-lg px-1 py-2 text-[11px] leading-tight",
                active
                  ? "bg-zinc-200 font-medium text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
                  : "text-zinc-600 dark:text-zinc-400",
              )}
            >
              <Icon className="mb-0.5 size-4 shrink-0" aria-hidden />
              <span className="max-w-[4.25rem] text-center">{item.label}</span>
            </button>
          );
        })}
      </div>

      <main className="min-h-0 min-w-0 flex-1 overflow-auto pb-20 lg:rounded-r-lg lg:border lg:border-zinc-200 lg:pb-0 dark:lg:border-zinc-800">
        {activeTab === "overzicht" ? (
          <div className="space-y-6 p-4 sm:p-6">
            <div>
              <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Overzicht</h1>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Live cijfers uit je studio-agenda (zelfde data als bij Afspraken en Planning).
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Afspraken vandaag" value={stats.loading ? "…" : String(stats.todayCount)} />
              <StatCard label="Komende 7 dagen" value={stats.loading ? "…" : String(stats.upcomingWeek)} />
              <StatCard label="Actieve medewerkers" value={stats.loading ? "…" : String(stats.activeStaff)} />
              <StatCard label="Actieve diensten" value={stats.loading ? "…" : String(stats.activeServices)} />
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Gebruik de tabs hiernaast voor agenda-instellingen, diensten, team en weekplanning.
            </p>
          </div>
        ) : null}

        {activeTab === "afspraken" ? (
          <div className="p-4 sm:p-6">
            <PortalAppointmentsClient slug={slug} clientName={clientName} />
          </div>
        ) : null}

        {activeTab === "behandelingen" ? (
          <div className="space-y-4 p-4 sm:p-6">
            <div>
              <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Diensten</h1>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Behandelingen en duur voor de online boekflow.
              </p>
            </div>
            <PortalBookingServicesClient slug={slug} />
          </div>
        ) : null}

        {activeTab === "medewerkers" ? (
          <div className="space-y-4 p-4 sm:p-6">
            <div>
              <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Medewerkers</h1>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Teamleden voor planning en beschikbaarheid in de boekagenda.
              </p>
            </div>
            <PortalStaffClient slug={slug} />
          </div>
        ) : null}

        {activeTab === "planning" ? (
          <div className="space-y-4 p-4 sm:p-6">
            <div>
              <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Planning</h1>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Weekrooster per medewerker — taakblokken en shifts zoals voorheen op de aparte Planning-pagina.
              </p>
            </div>
            <PortalPlanningWeekClient slug={slug} />
          </div>
        ) : null}
      </main>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40">
      <p className="text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">{value}</p>
      <p className="mt-1 text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
    </div>
  );
}

export function PortalBookingsHub({ slug, clientName }: { slug: string; clientName: string }) {
  return (
    <Suspense
      fallback={
        <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/40">
          Laden…
        </div>
      }
    >
      <BookingsHubInner slug={slug} clientName={clientName} />
    </Suspense>
  );
}

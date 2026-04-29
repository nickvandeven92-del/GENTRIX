"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  CircleHelp,
  CreditCard,
  FileText,
  Images,
  LayoutDashboard,
  MonitorSmartphone,
  Sparkles,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const POLL_MS = 30_000;

type PortalNavProps = {
  slug: string;
  appointmentsEnabled: boolean;
  invoicesEnabled: boolean;
  accountEnabled: boolean;
  supportUnreadInitial?: number;
};

export function PortalNav({
  slug,
  appointmentsEnabled,
  invoicesEnabled,
  accountEnabled,
  supportUnreadInitial = 0,
}: PortalNavProps) {
  const pathname = usePathname();
  const enc = encodeURIComponent(decodeURIComponent(slug));
  const base = `/portal/${enc}`;
  const supportHref = `${base}/support`;
  const unreadApi = `/api/portal/clients/${enc}/support/unread-summary`;

  const [supportUnread, setSupportUnread] = useState(supportUnreadInitial);
  const [supportToast, setSupportToast] = useState(false);
  const lastUnreadRef = useRef(supportUnreadInitial);
  const ignoreFirstPollRef = useRef(true);

  useEffect(() => {
    queueMicrotask(() => {
      setSupportUnread(supportUnreadInitial);
      lastUnreadRef.current = supportUnreadInitial;
      ignoreFirstPollRef.current = true;
    });
  }, [slug, supportUnreadInitial]);

  useEffect(() => {
    if (pathname === supportHref || pathname.startsWith(`${supportHref}/`)) {
      queueMicrotask(() => setSupportToast(false));
    }
  }, [pathname, supportHref]);

  const pollUnread = useCallback(async () => {
    try {
      const res = await fetch(unreadApi, { credentials: "include" });
      const j = (await res.json()) as {
        ok?: boolean;
        totalUnreadStaffMessages?: number;
      };
      if (!res.ok || !j?.ok || typeof j.totalUnreadStaffMessages !== "number") return;
      const n = j.totalUnreadStaffMessages;
      const onSupport =
        typeof pathname === "string" &&
        (pathname === supportHref || pathname.startsWith(`${supportHref}/`));

      if (ignoreFirstPollRef.current) {
        ignoreFirstPollRef.current = false;
        lastUnreadRef.current = n;
        setSupportUnread(n);
        return;
      }

      if (n > lastUnreadRef.current && !onSupport) {
        setSupportToast(true);
      }
      lastUnreadRef.current = n;
      setSupportUnread(n);
    } catch {
      /* */
    }
  }, [unreadApi, pathname, supportHref]);

  useEffect(() => {
    const id = window.setInterval(() => void pollUnread(), POLL_MS);
    queueMicrotask(() => void pollUnread());
    return () => window.clearInterval(id);
  }, [pollUnread]);

  useEffect(() => {
    if (!supportToast) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSupportToast(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [supportToast]);

  const items: { href: string; label: string; icon: typeof LayoutDashboard; support?: boolean }[] = [
    { href: base, label: "Overzicht", icon: LayoutDashboard },
    { href: `${base}/website`, label: "Website", icon: Sparkles },
    { href: `${base}/gallerij`, label: "Gallerij", icon: Images },
    ...(appointmentsEnabled ? [{ href: `${base}/boekingen`, label: "Boekingen-app", icon: MonitorSmartphone }] : []),
    { href: supportHref, label: "Support", icon: CircleHelp, support: true },
    ...(invoicesEnabled ? [{ href: `${base}/facturen`, label: "Facturen", icon: FileText }] : []),
    ...(accountEnabled ? [{ href: `${base}/account`, label: "Account", icon: CreditCard }] : []),
  ];

  const badge =
    supportUnread > 0 ? (
      <span
        className={cn(
          "ml-1.5 inline-flex min-w-[1.125rem] items-center justify-center rounded-full px-1 text-[10px] font-semibold",
          "bg-blue-600 text-white dark:bg-blue-500",
        )}
        aria-label={`${supportUnread} ongelezen supportbericht${supportUnread === 1 ? "" : "en"}`}
      >
        {supportUnread > 99 ? "99+" : supportUnread}
      </span>
    ) : null;

  return (
    <>
      <nav className="w-full lg:w-60 lg:shrink-0" aria-label="Portaal">
        <div
          className={cn(
            "flex gap-1 overflow-x-auto rounded-xl border border-zinc-200 bg-white p-1",
            "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
            "dark:border-zinc-800 dark:bg-zinc-900 lg:hidden",
          )}
        >
          {items.map(({ href, label, icon: Icon, support }) => {
            const active = href === base ? pathname === base : pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap",
                  active
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800",
                )}
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                {label}
                {support ? badge : null}
              </Link>
            );
          })}
        </div>

        <div className="hidden lg:block lg:sticky lg:top-[5.25rem]">
          <div className="rounded-2xl border border-zinc-200 bg-white p-2 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <p className="px-2 py-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Navigatie</p>
            <div className="space-y-0.5">
              {items.map(({ href, label, icon: Icon, support }) => {
                const active = href === base ? pathname === base : pathname === href || pathname.startsWith(`${href}/`);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      "flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm transition-colors",
                      active
                        ? "bg-zinc-900 font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
                        : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800",
                    )}
                  >
                    <Icon className="size-4 shrink-0 opacity-90" aria-hidden />
                    <span>{label}</span>
                    {support ? badge : null}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </nav>

      {supportToast ? (
        <div
          className="fixed right-4 bottom-4 z-[100] max-w-sm rounded-xl border border-zinc-200 bg-white p-4 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
          role="status"
        >
          <div className="flex gap-3">
            <p className="min-w-0 flex-1 text-sm text-zinc-800 dark:text-zinc-100">
              <span className="font-medium">Nieuw studio-antwoord</span>
              <span className="mt-0.5 block text-zinc-600 dark:text-zinc-400">
                Er staat een nieuw bericht voor je in support.
              </span>
            </p>
            <button
              type="button"
              onClick={() => setSupportToast(false)}
              className="shrink-0 rounded-md p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
              aria-label="Sluiten"
            >
              <X className="size-4" />
            </button>
          </div>
          <Link
            href={supportHref}
            onClick={() => setSupportToast(false)}
            className="mt-3 inline-flex w-full items-center justify-center rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            Naar support
          </Link>
        </div>
      ) : null}
    </>
  );
}

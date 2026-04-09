"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { CalendarPlus } from "lucide-react";

type ApptBrief = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  booker_name: string | null;
};

function formatRangeNl(startsAt: string, endsAt: string): string {
  const s = new Date(startsAt);
  const e = new Date(endsAt);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return startsAt;
  return (
    new Intl.DateTimeFormat("nl-NL", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(s) +
    " – " +
    new Intl.DateTimeFormat("nl-NL", { hour: "2-digit", minute: "2-digit" }).format(e)
  );
}

type Props = {
  slug: string;
  appointmentsEnabled: boolean;
};

const POLL_MS = 30_000;

/**
 * Toont een pop-up wanneer er een nieuwe afspraak bijkomt (o.a. via /boek/…)
 * terwijl het portaal open staat.
 */
export function PortalAppointmentNotifier({ slug, appointmentsEnabled }: Props) {
  const pathname = usePathname();
  const enc = encodeURIComponent(decodeURIComponent(slug));
  const base = `/api/portal/clients/${enc}/appointments`;

  const seededRef = useRef(false);
  const knownIdsRef = useRef<Set<string>>(new Set());
  const [notice, setNotice] = useState<ApptBrief[] | null>(null);

  const onAfsprakenPage =
    typeof pathname === "string" && pathname.includes("/portal/") && pathname.endsWith("/afspraken");

  const poll = useCallback(async () => {
    if (!appointmentsEnabled) return;

    try {
      const res = await fetch(base, { credentials: "include" });
      const json = (await res.json()) as {
        ok?: boolean;
        appointments?: Array<{
          id: string;
          title: string;
          starts_at: string;
          ends_at: string;
          booker_name?: string | null;
        }>;
      };

      if (!res.ok || !json.ok || !Array.isArray(json.appointments)) return;

      const list = json.appointments;

      if (!seededRef.current) {
        knownIdsRef.current = new Set(list.map((a) => a.id));
        seededRef.current = true;
        return;
      }

      const fresh = list.filter((a) => !knownIdsRef.current.has(a.id));
      if (fresh.length === 0) return;

      for (const a of fresh) {
        knownIdsRef.current.add(a.id);
      }

      if (onAfsprakenPage) return;

      const mapped: ApptBrief[] = fresh.map((a) => ({
        id: a.id,
        title: a.title?.trim() || "Afspraak",
        starts_at: a.starts_at,
        ends_at: a.ends_at,
        booker_name: a.booker_name?.trim() ? a.booker_name.trim() : null,
      }));

      setNotice((prev) => {
        if (!prev?.length) return mapped;
        const seen = new Set(prev.map((p) => p.id));
        const extra = mapped.filter((m) => !seen.has(m.id));
        return extra.length ? [...prev, ...extra] : prev;
      });
    } catch {
      /* ignore */
    }
  }, [appointmentsEnabled, base, onAfsprakenPage]);

  useEffect(() => {
    seededRef.current = false;
    knownIdsRef.current = new Set();
    setNotice(null);
  }, [slug, appointmentsEnabled]);

  useEffect(() => {
    if (!appointmentsEnabled) return;

    void poll();
    const id = window.setInterval(() => void poll(), POLL_MS);
    return () => window.clearInterval(id);
  }, [appointmentsEnabled, poll]);

  useEffect(() => {
    if (!notice?.length) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setNotice(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [notice?.length]);

  if (!appointmentsEnabled || !notice?.length) return null;

  const heading =
    notice.length === 1 ? "Nieuwe afspraak" : `Nieuwe afspraken (${notice.length})`;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="portal-new-appt-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
        <h2
          id="portal-new-appt-title"
          className="flex items-center gap-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50"
        >
          <CalendarPlus className="size-5 text-emerald-600 dark:text-emerald-400" aria-hidden />
          {heading}
        </h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
          {notice.length === 1
            ? "Er is zojuist een afspraak toegevoegd (bijv. via je online boekagenda)."
            : `Er zijn zojuist ${notice.length} afspraken toegevoegd (bijv. via je online boekagenda).`}
        </p>
        <ul className="mt-4 max-h-48 space-y-3 overflow-y-auto text-sm">
          {notice.map((a) => (
            <li key={a.id} className="rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950/50">
              <p className="font-medium text-zinc-900 dark:text-zinc-50">{a.title}</p>
              <p className="text-zinc-600 dark:text-zinc-400">{formatRangeNl(a.starts_at, a.ends_at)}</p>
              {a.booker_name ? (
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Boeker: {a.booker_name}</p>
              ) : null}
            </li>
          ))}
        </ul>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Sluiten
          </button>
          <Link
            href={`/portal/${enc}/afspraken`}
            onClick={() => setNotice(null)}
            className="inline-flex items-center justify-center rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            Naar afspraken
          </Link>
        </div>
      </div>
    </div>
  );
}

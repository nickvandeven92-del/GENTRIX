"use client";

import { useMemo, useState } from "react";
import { addDays } from "date-fns";
import { ChevronLeft, ChevronRight, CalendarRange } from "lucide-react";
import { TZDate } from "@date-fns/tz";
import type { BookingSettings } from "@/lib/booking/booking-settings";
import { BOOKING_ISO_DAYS } from "@/lib/booking/booking-day-meta";
import { cn } from "@/lib/utils";

type AppointmentRow = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  status: string;
  booker_name: string | null;
  booker_email: string | null;
};

type Props = {
  settings: BookingSettings;
  appointments: AppointmentRow[];
};

function mondayMidnightOfWeekContaining(timeZone: string, nowMs: number): TZDate {
  const z = new TZDate(nowMs, timeZone);
  const noon = new TZDate(z.getFullYear(), z.getMonth(), z.getDate(), 12, 0, 0, timeZone);
  const w = noon.getDay();
  const iso = w === 0 ? 7 : w;
  const monday = addDays(noon, -(iso - 1)) as TZDate;
  return new TZDate(monday.getFullYear(), monday.getMonth(), monday.getDate(), 0, 0, 0, timeZone);
}

function sameCalendarDayInTz(isoUtc: string, col: TZDate, timeZone: string): boolean {
  const t = new TZDate(new Date(isoUtc).getTime(), timeZone);
  return (
    t.getFullYear() === col.getFullYear() &&
    t.getMonth() === col.getMonth() &&
    t.getDate() === col.getDate()
  );
}

function timeRangeNl(isoStart: string, isoEnd: string, timeZone: string): string {
  const a = new Date(isoStart);
  const b = new Date(isoEnd);
  const fmt = new Intl.DateTimeFormat("nl-NL", { hour: "2-digit", minute: "2-digit", timeZone });
  return `${fmt.format(a)}–${fmt.format(b)}`;
}

function openingHintForColumn(col: TZDate, settings: BookingSettings): string {
  const w = col.getDay();
  const iso = w === 0 ? 7 : w;
  const cfg = settings.week.find((x) => x.day === iso);
  if (!cfg?.intervals.length) return "Gesloten · geen /boek-slots";
  return cfg.intervals.map((i) => `${i.start}–${i.end}`).join(", ");
}

export function PortalAppointmentPlanning({ settings, appointments }: Props) {
  const tz = settings.timeZone;
  const [weekOffset, setWeekOffset] = useState(0);

  const monday0 = useMemo(() => mondayMidnightOfWeekContaining(tz, Date.now()), [tz]);
  const weekStart = useMemo(
    () => addDays(monday0, weekOffset * 7) as TZDate,
    [monday0, weekOffset],
  );

  const columns = useMemo(() => {
    const cols: TZDate[] = [];
    for (let i = 0; i < 7; i++) {
      cols.push(addDays(weekStart, i) as TZDate);
    }
    return cols;
  }, [weekStart]);

  const rangeLabel = useMemo(() => {
    const a = columns[0];
    const b = columns[6];
    const fmt = new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "short", year: "numeric" });
    return `${fmt.format(a)} – ${fmt.format(b)}`;
  }, [columns]);

  return (
    <section className="rounded-xl border border-violet-200/90 bg-violet-50/40 p-5 dark:border-violet-900/50 dark:bg-violet-950/20">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-violet-950 dark:text-violet-100">
            <CalendarRange className="size-4 text-violet-600 dark:text-violet-400" aria-hidden />
            Planning (week)
          </h2>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-violet-900/85 dark:text-violet-200/80">
            Zelfde database als de stap-voor-stap boekpagina voor bezoekers: wat hier staat, is wat online of handmatig
            is geboekt. Groene balk = openingstijden voor vrije slots; grijs = die dag geen automatische /boek-slots.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setWeekOffset((o) => o - 1)}
            className="inline-flex items-center rounded-lg border border-violet-300 bg-white px-2 py-1.5 text-xs font-medium text-violet-900 hover:bg-violet-100 dark:border-violet-800 dark:bg-zinc-900 dark:text-violet-100 dark:hover:bg-violet-950/50"
            aria-label="Vorige week"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="min-w-[10rem] text-center text-xs font-medium text-violet-900 dark:text-violet-100">
            {rangeLabel}
          </span>
          <button
            type="button"
            onClick={() => setWeekOffset((o) => o + 1)}
            className="inline-flex items-center rounded-lg border border-violet-300 bg-white px-2 py-1.5 text-xs font-medium text-violet-900 hover:bg-violet-100 dark:border-violet-800 dark:bg-zinc-900 dark:text-violet-100 dark:hover:bg-violet-950/50"
            aria-label="Volgende week"
          >
            <ChevronRight className="size-4" />
          </button>
          {weekOffset !== 0 ? (
            <button
              type="button"
              onClick={() => setWeekOffset(0)}
              className="rounded-lg border border-violet-300 px-2 py-1.5 text-xs font-medium text-violet-800 hover:bg-violet-100 dark:border-violet-800 dark:text-violet-200 dark:hover:bg-violet-950/50"
            >
              Deze week
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-7">
        {columns.map((col, idx) => {
          const isoD = col.getDay() === 0 ? 7 : col.getDay();
          const dayShort = BOOKING_ISO_DAYS.find((d) => d.day === isoD)?.short ?? "";
          const header = new Intl.DateTimeFormat("nl-NL", { weekday: "short", day: "numeric", month: "short" }).format(
            col,
          );
          const dayAppts = appointments.filter(
            (r) => sameCalendarDayInTz(r.starts_at, col, tz) && r.status !== "cancelled",
          );
          const dayApptsAll = appointments.filter((r) => sameCalendarDayInTz(r.starts_at, col, tz));
          const openOnline = settings.week.some((w) => w.day === isoD && w.intervals.length > 0);

          return (
            <div
              key={idx}
              className={cn(
                "flex min-h-[8rem] flex-col rounded-lg border p-2 text-xs",
                openOnline
                  ? "border-emerald-200/90 bg-white dark:border-emerald-900/40 dark:bg-zinc-900/50"
                  : "border-zinc-200/80 bg-zinc-50/90 dark:border-zinc-700 dark:bg-zinc-950/50",
              )}
            >
              <div className="border-b border-zinc-100 pb-1 dark:border-zinc-800">
                <p className="font-semibold text-zinc-900 dark:text-zinc-50">
                  {dayShort} {header}
                </p>
                <p
                  className={cn(
                    "mt-0.5 text-[10px] leading-tight",
                    openOnline ? "text-emerald-800 dark:text-emerald-300" : "text-zinc-500 dark:text-zinc-400",
                  )}
                >
                  {openingHintForColumn(col, settings)}
                </p>
              </div>
              <ul className="mt-2 flex flex-1 flex-col gap-1.5">
                {dayAppts.length === 0 ? (
                  <li className="text-[11px] text-zinc-400 dark:text-zinc-500">—</li>
                ) : (
                  dayAppts.map((r) => (
                    <li
                      key={r.id}
                      className="rounded border border-violet-200/80 bg-violet-50/80 px-1.5 py-1 dark:border-violet-900/50 dark:bg-violet-950/30"
                    >
                      <p className="font-medium text-zinc-900 dark:text-zinc-50">{r.title}</p>
                      <p className="text-[10px] text-zinc-600 dark:text-zinc-400">
                        {timeRangeNl(r.starts_at, r.ends_at, tz)}
                      </p>
                      {r.booker_email?.trim() ? (
                        <p className="truncate text-[10px] text-zinc-500 dark:text-zinc-400">{r.booker_email.trim()}</p>
                      ) : null}
                    </li>
                  ))
                )}
                {dayApptsAll.some((r) => r.status === "cancelled") ? (
                  <li className="text-[10px] text-zinc-400 italic dark:text-zinc-500">
                    +{dayApptsAll.filter((r) => r.status === "cancelled").length} geannuleerd
                  </li>
                ) : null}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}

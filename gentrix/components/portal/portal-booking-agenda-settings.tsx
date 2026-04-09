"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import type { BookingSettings } from "@/lib/booking/booking-settings";
import { BOOKING_MAX_INTERVALS_PER_DAY } from "@/lib/booking/booking-settings";
import { BOOKING_ISO_DAYS } from "@/lib/booking/booking-day-meta";
import { bookingIntervalsOverlap } from "@/lib/booking/validate-booking-intervals";
import { cn } from "@/lib/utils";

const TZ_OPTIONS = [
  "Europe/Amsterdam",
  "Europe/Brussels",
  "Europe/Berlin",
  "Europe/London",
  "UTC",
] as const;

const DEFAULT_BLOCK = { start: "09:00", end: "17:00" };
const EXTRA_BLOCK_SUGGEST = { start: "13:00", end: "17:00" };

type DayRowState = { open: boolean; intervals: { start: string; end: string }[] };

type Props = { slug: string; onSaved?: () => void };

function settingsToRows(s: BookingSettings): DayRowState[] {
  return BOOKING_ISO_DAYS.map(({ day }) => {
    const cfg = s.week.find((w) => w.day === day);
    const iv = cfg?.intervals ?? [];
    return {
      open: iv.length > 0,
      intervals: iv.length > 0 ? iv.map((x) => ({ ...x })) : [{ ...DEFAULT_BLOCK }],
    };
  });
}

function normHM(s: string): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(s.trim());
  if (!m) return "09:00";
  return `${String(parseInt(m[1], 10)).padStart(2, "0")}:${m[2]}`;
}

function rowsToSettings(
  rows: DayRowState[],
  timeZone: string,
  slotDurationMinutes: number,
  bufferMinutes: number,
  leadTimeMinutes: number,
  maxDaysAhead: number,
): BookingSettings {
  return {
    timeZone,
    slotDurationMinutes,
    bufferMinutes,
    leadTimeMinutes,
    maxDaysAhead,
    week: BOOKING_ISO_DAYS.map(({ day }, i) => ({
      day,
      intervals: rows[i].open
        ? rows[i].intervals.map((b) => ({ start: normHM(b.start), end: normHM(b.end) }))
        : [],
    })),
  };
}

export function PortalBookingAgendaSettings({ slug, onSaved }: Props) {
  const enc = encodeURIComponent(slug);
  const base = `/api/portal/clients/${enc}/booking-settings`;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const [timeZone, setTimeZone] = useState("Europe/Amsterdam");
  const [slotDurationMinutes, setSlotDurationMinutes] = useState(30);
  const [bufferMinutes, setBufferMinutes] = useState(0);
  const [leadTimeMinutes, setLeadTimeMinutes] = useState(120);
  const [maxDaysAhead, setMaxDaysAhead] = useState(60);
  const [rows, setRows] = useState<DayRowState[]>(() =>
    BOOKING_ISO_DAYS.map(() => ({ open: false, intervals: [{ ...DEFAULT_BLOCK }] })),
  );

  const load = useCallback(async () => {
    setErr(null);
    setOkMsg(null);
    setLoading(true);
    try {
      const res = await fetch(base);
      const json = (await res.json()) as { ok?: boolean; settings?: BookingSettings; error?: string };
      if (!res.ok || !json.ok || !json.settings) {
        setErr(json.error ?? "Laden mislukt.");
        return;
      }
      const s = json.settings;
      setTimeZone(s.timeZone);
      setSlotDurationMinutes(s.slotDurationMinutes);
      setBufferMinutes(s.bufferMinutes);
      setLeadTimeMinutes(s.leadTimeMinutes);
      setMaxDaysAhead(s.maxDaysAhead);
      setRows(settingsToRows(s));
    } catch {
      setErr("Netwerkfout.");
    } finally {
      setLoading(false);
    }
  }, [base]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    setSaving(true);
    setErr(null);
    setOkMsg(null);
    const dayLabel = BOOKING_ISO_DAYS.map((d) => d.label);

    for (let i = 0; i < rows.length; i++) {
      if (!rows[i].open) continue;
      if (rows[i].intervals.length === 0) {
        setErr(`${dayLabel[i]}: voeg minstens één werkblok toe of zet de dag uit.`);
        setSaving(false);
        return;
      }
      if (rows[i].intervals.length > BOOKING_MAX_INTERVALS_PER_DAY) {
        setErr(`${dayLabel[i]}: maximaal ${BOOKING_MAX_INTERVALS_PER_DAY} blokken per dag.`);
        setSaving(false);
        return;
      }
      for (let k = 0; k < rows[i].intervals.length; k++) {
        const b = rows[i].intervals[k];
        if (normHM(b.start) >= normHM(b.end)) {
          setErr(`${dayLabel[i]}, blok ${k + 1}: start moet voor eind zijn.`);
          setSaving(false);
          return;
        }
      }
      if (bookingIntervalsOverlap(rows[i].intervals)) {
        setErr(
          `${dayLabel[i]}: werkblokken overlappen elkaar. Zorg voor een gat (pauze) tussen twee blokken, of voeg één doorlopend blok in.`,
        );
        setSaving(false);
        return;
      }
    }

    const settings = rowsToSettings(rows, timeZone, slotDurationMinutes, bufferMinutes, leadTimeMinutes, maxDaysAhead);
    try {
      const res = await fetch(base, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setErr(json.error ?? "Opslaan mislukt.");
        return;
      }
      setOkMsg("Opgeslagen. Bezoekers zien de nieuwe tijden op de boekpagina.");
      onSaved?.();
    } catch {
      setErr("Netwerkfout.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50/80 p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950/50 dark:text-zinc-400">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Boekagenda-instellingen laden…
      </div>
    );
  }

  return (
    <section
      id="online-boekagenda"
      className="rounded-xl border border-emerald-200/90 bg-emerald-50/40 p-5 dark:border-emerald-900/50 dark:bg-emerald-950/20"
    >
      <h2 className="text-sm font-semibold text-emerald-950 dark:text-emerald-100">Online boekagenda</h2>
      <p className="mt-1 text-xs leading-relaxed text-emerald-900/80 dark:text-emerald-200/80">
        Zelfde regels als de publieke boekflow voor bezoekers (<code className="rounded bg-white/80 px-1 dark:bg-emerald-950/60">/boek/…</code>
        ). Per dag kun je <strong className="font-medium text-emerald-950 dark:text-emerald-100">meerdere werkblokken</strong>{" "}
        instellen; de <strong className="font-medium text-emerald-950 dark:text-emerald-100">ruimte ertussen</strong> is
        pauze (geen boekbare slots), bijv. lunch tussen ochtend en middag.
      </p>

      {err ? (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400" role="alert">
          {err}
        </p>
      ) : null}
      {okMsg ? (
        <p className="mt-2 text-sm text-emerald-800 dark:text-emerald-300" role="status">
          {okMsg}
        </p>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
          Tijdzone
          <select
            value={timeZone}
            onChange={(e) => setTimeZone(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-2 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
          >
            {TZ_OPTIONS.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
          Slotlengte (min)
          <select
            value={slotDurationMinutes}
            onChange={(e) => setSlotDurationMinutes(Number(e.target.value))}
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-2 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
          >
            {[15, 20, 30, 45, 60].map((n) => (
              <option key={n} value={n}>
                {n} min
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
          Min. vooraf boeken (min)
          <input
            type="number"
            min={0}
            max={1440}
            step={15}
            value={leadTimeMinutes}
            onChange={(e) => setLeadTimeMinutes(Number(e.target.value))}
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-2 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
          />
        </label>
        <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
          Max. dagen vooruit
          <input
            type="number"
            min={1}
            max={120}
            value={maxDaysAhead}
            onChange={(e) => setMaxDaysAhead(Number(e.target.value))}
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-2 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
          />
        </label>
      </div>

      <label className="mt-3 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
        Rust tussen afspraken (min)
        <input
          type="number"
          min={0}
          max={120}
          value={bufferMinutes}
          onChange={(e) => setBufferMinutes(Number(e.target.value))}
          className="mt-1 w-full max-w-xs rounded-lg border border-zinc-300 bg-white px-2 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
        />
      </label>

      <div className="mt-4 space-y-3">
        {BOOKING_ISO_DAYS.map(({ day, label }, i) => (
          <div
            key={day}
            className={cn(
              "rounded-lg border px-3 py-3",
              rows[i].open
                ? "border-emerald-200 bg-white dark:border-emerald-900/40 dark:bg-zinc-900/40"
                : "border-zinc-200 bg-zinc-50/80 dark:border-zinc-700 dark:bg-zinc-950/40",
            )}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="flex items-center gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
                <input
                  type="checkbox"
                  checked={rows[i].open}
                  onChange={(e) => {
                    const open = e.target.checked;
                    setRows((prev) =>
                      prev.map((r, j) =>
                        j === i
                          ? {
                              open,
                              intervals: open && r.intervals.length === 0 ? [{ ...DEFAULT_BLOCK }] : r.intervals,
                            }
                          : r,
                      ),
                    );
                  }}
                  className="rounded border-zinc-400"
                />
                {label}
              </label>
              {rows[i].open ? (
                <button
                  type="button"
                  disabled={rows[i].intervals.length >= BOOKING_MAX_INTERVALS_PER_DAY}
                  onClick={() => {
                    setRows((prev) =>
                      prev.map((r, j) => {
                        if (j !== i) return r;
                        if (r.intervals.length >= BOOKING_MAX_INTERVALS_PER_DAY) return r;
                        return {
                          ...r,
                          intervals: [...r.intervals, { ...EXTRA_BLOCK_SUGGEST }],
                        };
                      }),
                    );
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-900 hover:bg-emerald-100 disabled:opacity-40 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100 dark:hover:bg-emerald-900/40"
                >
                  <Plus className="size-3.5" aria-hidden />
                  Werkblok (pauze ertussen)
                </button>
              ) : null}
            </div>

            {rows[i].open ? (
              <ul className="mt-3 space-y-2">
                {rows[i].intervals.map((block, k) => (
                  <li
                    key={`${day}-${k}`}
                    className="flex flex-wrap items-center gap-2 rounded-md border border-zinc-100 bg-zinc-50/90 px-2 py-2 dark:border-zinc-700 dark:bg-zinc-950/50"
                  >
                    <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                      Blok {k + 1}
                    </span>
                    <input
                      type="time"
                      value={block.start}
                      onChange={(e) => {
                        const v = e.target.value.slice(0, 5);
                        setRows((prev) =>
                          prev.map((r, j) =>
                            j === i
                              ? {
                                  ...r,
                                  intervals: r.intervals.map((b, bi) => (bi === k ? { ...b, start: v } : b)),
                                }
                              : r,
                          ),
                        );
                      }}
                      className="rounded border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-950"
                    />
                    <span className="text-zinc-500">–</span>
                    <input
                      type="time"
                      value={block.end}
                      onChange={(e) => {
                        const v = e.target.value.slice(0, 5);
                        setRows((prev) =>
                          prev.map((r, j) =>
                            j === i
                              ? {
                                  ...r,
                                  intervals: r.intervals.map((b, bi) => (bi === k ? { ...b, end: v } : b)),
                                }
                              : r,
                          ),
                        );
                      }}
                      className="rounded border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-950"
                    />
                    <button
                      type="button"
                      aria-label={`Verwijder blok ${k + 1} op ${label}`}
                      onClick={() => {
                        setRows((prev) =>
                          prev.map((r, j) => {
                            if (j !== i) return r;
                            const next = r.intervals.filter((_, bi) => bi !== k);
                            if (next.length === 0) return { open: false, intervals: [{ ...DEFAULT_BLOCK }] };
                            return { ...r, intervals: next };
                          }),
                        );
                      }}
                      className="ml-auto inline-flex items-center rounded border border-red-200 p-1.5 text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40"
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-zinc-500">Gesloten — geen online slots.</p>
            )}
          </div>
        ))}
      </div>

      <button
        type="button"
        disabled={saving}
        onClick={() => void save()}
        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50 dark:bg-emerald-600 dark:hover:bg-emerald-500"
      >
        {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Save className="size-4" aria-hidden />}
        Opslaan
      </button>
    </section>
  );
}

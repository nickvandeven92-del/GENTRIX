"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { addDays } from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight, Loader2, Plus } from "lucide-react";
import { TZDate } from "@date-fns/tz";
import type { BookingSettings } from "@/lib/booking/booking-settings";
import { staffPlanningHorizonEnd, STAFF_PLANNING_MAX_MONTHS } from "@/lib/staff/staff-shift-validation";
import type { StaffMember } from "@/components/portal/portal-staff-client";
import { cn } from "@/lib/utils";

type ShiftRow = {
  id: string;
  staff_id: string;
  starts_at: string;
  ends_at: string;
  notes: string | null;
};

type Props = { slug: string };

const PALETTE = ["#6366f1", "#0ea5e9", "#22c55e", "#ca8a04", "#ea580c", "#db2777", "#9333ea"];

const INTERN_PREFIX = /^\s*\[intern\]/i;

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

function defaultSettings(): BookingSettings {
  return {
    timeZone: "Europe/Amsterdam",
    slotDurationMinutes: 30,
    bufferMinutes: 0,
    leadTimeMinutes: 120,
    maxDaysAhead: 60,
    week: [],
  };
}

function staffColor(list: StaffMember[], id: string): string {
  const idx = list.findIndex((s) => s.id === id);
  const m = list[idx];
  if (m?.color_hex) return m.color_hex;
  if (idx >= 0) return PALETTE[idx % PALETTE.length];
  return PALETTE[0];
}

function formatShiftRange(isoStart: string, isoEnd: string, timeZone: string): string {
  const fmt = new Intl.DateTimeFormat("nl-NL", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  });
  return `${fmt.format(new Date(isoStart))}–${fmt.format(new Date(isoEnd))}`;
}

function isInternShift(notes: string | null): boolean {
  return INTERN_PREFIX.test(String(notes ?? ""));
}

function buildNotesForSubmit(visibility: "public" | "internal", memo: string): string | null {
  const m = memo.trim();
  if (visibility === "internal") {
    return m ? `[intern] ${m}` : "[intern]";
  }
  return m || null;
}

export function PortalPlanningWeekClient({ slug }: Props) {
  const enc = encodeURIComponent(slug);
  const settingsUrl = `/api/portal/clients/${enc}/booking-settings`;
  const staffUrl = `/api/portal/clients/${enc}/staff`;
  const shiftsBase = `/api/portal/clients/${enc}/staff-shifts`;

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [settings, setSettings] = useState<BookingSettings>(defaultSettings);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [shifts, setShifts] = useState<ShiftRow[]>([]);
  const [weekOffset, setWeekOffset] = useState(0);
  const [savingBulk, setSavingBulk] = useState(false);

  const [planOpen, setPlanOpen] = useState(false);
  const [planStaffId, setPlanStaffId] = useState<string>("");
  const [planStart, setPlanStart] = useState("09:00");
  const [planEnd, setPlanEnd] = useState("17:00");
  const [planDays, setPlanDays] = useState<boolean[]>(() => [true, true, true, true, true, false, false]);
  const [planVisibility, setPlanVisibility] = useState<"public" | "internal">("public");
  const [planMemo, setPlanMemo] = useState("");
  /** Leeg = alle rijen; anders alleen deze medewerker (eigen weekoverzicht). */
  const [tableStaffFilter, setTableStaffFilter] = useState("");

  const tz = settings.timeZone;

  const monday0 = useMemo(() => mondayMidnightOfWeekContaining(tz, Date.now()), [tz]);
  const weekStart = useMemo(() => addDays(monday0, weekOffset * 7) as TZDate, [monday0, weekOffset]);

  const columns = useMemo(() => {
    const cols: TZDate[] = [];
    for (let i = 0; i < 7; i++) cols.push(addDays(weekStart, i) as TZDate);
    return cols;
  }, [weekStart]);

  const rangeLabel = useMemo(() => {
    const a = columns[0];
    const b = columns[6];
    const fmt = new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "short", year: "numeric" });
    return `${fmt.format(a)} – ${fmt.format(b)}`;
  }, [columns]);

  const horizon = useMemo(() => staffPlanningHorizonEnd(), []);
  const canGoNextWeek = useMemo(() => {
    const nextMonday = addDays(weekStart, 7) as TZDate;
    return nextMonday.getTime() <= horizon.getTime();
  }, [weekStart, horizon]);

  const loadWeek = useCallback(async () => {
    const fromMs = weekStart.getTime();
    const toMs = (addDays(weekStart, 7) as TZDate).getTime();
    const from = encodeURIComponent(new Date(fromMs).toISOString());
    const to = encodeURIComponent(new Date(toMs).toISOString());
    const res = await fetch(`${shiftsBase}?from=${from}&to=${to}`, { credentials: "include" });
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; shifts?: ShiftRow[]; error?: string };
    if (!res.ok || !json.ok) {
      setErr(json.error ?? "Diensten laden mislukt.");
      setShifts([]);
      return;
    }
    setShifts(json.shifts ?? []);
  }, [shiftsBase, weekStart]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const [rs, rf] = await Promise.all([
          fetch(settingsUrl, { credentials: "include" }),
          fetch(staffUrl, { credentials: "include" }),
        ]);
        const js = (await rs.json().catch(() => ({}))) as { ok?: boolean; settings?: BookingSettings; error?: string };
        const jf = (await rf.json().catch(() => ({}))) as { ok?: boolean; staff?: StaffMember[]; error?: string };
        if (!cancelled) {
          if (rs.ok && js.ok && js.settings) setSettings(js.settings);
          else if (rs.ok && js.ok) setSettings(defaultSettings());
          if (!rs.ok) setErr(js.error ?? "Instellingen laden mislukt.");

          if (rf.ok && jf.ok) {
            const list = jf.staff ?? [];
            setStaff(list);
            const firstActive = list.find((s) => s.is_active);
            if (firstActive) setPlanStaffId(firstActive.id);
          } else if (!rf.ok) setErr(jf.error ?? "Medewerkers laden mislukt.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [settingsUrl, staffUrl]);

  useEffect(() => {
    if (loading) return;
    void loadWeek();
  }, [loading, loadWeek]);

  function openPlanModal() {
    setPlanOpen(true);
    setPlanVisibility("public");
    setPlanMemo("");
    setPlanStart("09:00");
    setPlanEnd("17:00");
    setPlanDays([true, true, true, true, true, false, false]);
    const active = staff.filter((s) => s.is_active);
    if (active.length && !active.some((s) => s.id === planStaffId)) {
      setPlanStaffId(active[0]?.id ?? "");
    }
  }

  function applyPreset(key: "office" | "morning" | "afternoon") {
    if (key === "office") {
      setPlanStart("09:00");
      setPlanEnd("17:00");
    } else if (key === "morning") {
      setPlanStart("09:00");
      setPlanEnd("13:00");
    } else {
      setPlanStart("13:00");
      setPlanEnd("17:00");
    }
  }

  async function submitPlan() {
    const active = staff.filter((s) => s.is_active);
    const sid = planStaffId;
    if (!sid || !active.some((s) => s.id === sid)) {
      setErr("Kies een medewerker.");
      return;
    }
    const [sh, sm] = planStart.split(":").map((x) => parseInt(x, 10));
    const [eh, em] = planEnd.split(":").map((x) => parseInt(x, 10));
    if (![sh, sm, eh, em].every((n) => Number.isFinite(n))) {
      setErr("Ongeldige tijden.");
      return;
    }
    if (eh < sh || (eh === sh && em <= sm)) {
      setErr("Eindtijd moet na starttijd liggen (zelfde dag).");
      return;
    }
    const selectedIndices = planDays.map((on, i) => (on ? i : -1)).filter((i) => i >= 0);
    if (selectedIndices.length === 0) {
      setErr("Selecteer minstens één dag.");
      return;
    }

    const notes = buildNotesForSubmit(planVisibility, planMemo);
    setSavingBulk(true);
    setErr(null);
    try {
      for (const dayIndex of selectedIndices) {
        const col = columns[dayIndex];
        if (!col) continue;
        const start = new TZDate(col.getFullYear(), col.getMonth(), col.getDate(), sh, sm, 0, tz);
        const end = new TZDate(col.getFullYear(), col.getMonth(), col.getDate(), eh, em, 0, tz);
        if (end.getTime() > horizon.getTime()) {
          setErr(`Je kunt maximaal ${STAFF_PLANNING_MAX_MONTHS} maanden vooruit plannen.`);
          return;
        }
        const res = await fetch(shiftsBase, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            staff_id: sid,
            starts_at: start.toISOString(),
            ends_at: end.toISOString(),
            notes,
          }),
        });
        const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
        if (!res.ok || !json.ok) {
          setErr(json.error ?? "Dienst opslaan mislukt.");
          return;
        }
      }
      setPlanOpen(false);
      await loadWeek();
    } finally {
      setSavingBulk(false);
    }
  }

  async function deleteShift(s: ShiftRow) {
    if (!window.confirm("Deze dienst verwijderen?")) return;
    setErr(null);
    const res = await fetch(`${shiftsBase}/${encodeURIComponent(s.id)}`, { method: "DELETE", credentials: "include" });
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    if (!res.ok || !json.ok) {
      setErr(json.error ?? "Verwijderen mislukt.");
      return;
    }
    await loadWeek();
  }

  const activeStaff = staff.filter((s) => s.is_active);
  const visibleStaff =
    tableStaffFilter && activeStaff.some((s) => s.id === tableStaffFilter)
      ? activeStaff.filter((s) => s.id === tableStaffFilter)
      : activeStaff;

  const shiftsInCell = useCallback(
    (memberId: string, col: TZDate) =>
      shifts
        .filter((s) => s.staff_id === memberId && sameCalendarDayInTz(s.starts_at, col, tz))
        .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()),
    [shifts, tz],
  );

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Planning laden…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {planOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="portal-plan-shift-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPlanOpen(false);
          }}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="portal-plan-shift-title" className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Taak inplannen
            </h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
              Eén of meerdere dagen tegelijk. Tijden in {tz}. Diensten gemarkeerd als intern tellen niet mee voor online
              boeken.
            </p>

            <div className="mt-5 space-y-4">
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Medewerker
                <select
                  value={planStaffId}
                  onChange={(e) => setPlanStaffId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
                >
                  {activeStaff.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="flex flex-wrap gap-2">
                <span className="w-full text-xs font-medium text-zinc-600 dark:text-zinc-400">Snelkeuze tijden</span>
                <button
                  type="button"
                  onClick={() => applyPreset("office")}
                  className="rounded-lg border border-zinc-200 px-2 py-1 text-xs font-medium text-zinc-700 dark:border-zinc-600 dark:text-zinc-200"
                >
                  Kantoor 09–17
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset("morning")}
                  className="rounded-lg border border-zinc-200 px-2 py-1 text-xs font-medium text-zinc-700 dark:border-zinc-600 dark:text-zinc-200"
                >
                  Snipperdag ochtend
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset("afternoon")}
                  className="rounded-lg border border-zinc-200 px-2 py-1 text-xs font-medium text-zinc-700 dark:border-zinc-600 dark:text-zinc-200"
                >
                  Snipperdag middag
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  Start
                  <input
                    type="time"
                    value={planStart}
                    onChange={(e) => setPlanStart(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
                  />
                </label>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  Eind
                  <input
                    type="time"
                    value={planEnd}
                    onChange={(e) => setPlanEnd(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
                  />
                </label>
              </div>

              <fieldset>
                <legend className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Dagen (deze week)</legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {columns.map((col, i) => {
                    const label = new Intl.DateTimeFormat("nl-NL", { weekday: "short", day: "numeric", month: "short" }).format(
                      col,
                    );
                    return (
                      <label
                        key={col.getTime()}
                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-zinc-200 px-2 py-1.5 text-xs dark:border-zinc-700"
                      >
                        <input
                          type="checkbox"
                          checked={planDays[i] ?? false}
                          onChange={(e) => {
                            const next = [...planDays];
                            next[i] = e.target.checked;
                            setPlanDays(next);
                          }}
                          className="rounded border-zinc-300"
                        />
                        {label}
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Online boekbaar
                <select
                  value={planVisibility}
                  onChange={(e) => setPlanVisibility(e.target.value === "internal" ? "internal" : "public")}
                  className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
                >
                  <option value="public">Ja — telt mee voor beschikbare tijden op de website</option>
                  <option value="internal">Nee (intern) — niet zichtbaar als vrije slot voor klanten</option>
                </select>
              </label>

              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Notitie (optioneel)
                <input
                  value={planMemo}
                  onChange={(e) => setPlanMemo(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
                  placeholder="bijv. kantoor, thuiswerk, training…"
                />
              </label>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={savingBulk}
                onClick={() => void submitPlan()}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-zinc-900 py-2.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
              >
                {savingBulk ? <Loader2 className="size-4 animate-spin" /> : null}
                Opslaan
              </button>
              <button
                type="button"
                disabled={savingBulk}
                onClick={() => setPlanOpen(false)}
                className="rounded-lg border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-800 dark:border-zinc-600 dark:text-zinc-100"
              >
                Annuleren
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {err ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {err}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-100">
          <CalendarDays className="size-4 text-zinc-500" aria-hidden />
          {rangeLabel}
          <span className="text-xs font-normal text-zinc-500">({tz})</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={activeStaff.length === 0}
            onClick={openPlanModal}
            className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
          >
            <Plus className="size-4" aria-hidden />
            Taak inplannen
          </button>
          <button
            type="button"
            onClick={() => setWeekOffset((o) => o - 1)}
            className="inline-flex items-center rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
            aria-label="Vorige week"
          >
            <ChevronLeft className="size-4" />
          </button>
          {weekOffset !== 0 ? (
            <button
              type="button"
              onClick={() => setWeekOffset(0)}
              className="rounded-lg border border-zinc-200 px-2 py-1.5 text-xs font-medium text-zinc-700 dark:border-zinc-600 dark:text-zinc-200"
            >
              Vandaag
            </button>
          ) : null}
          <button
            type="button"
            disabled={!canGoNextWeek}
            onClick={() => setWeekOffset((o) => o + 1)}
            className="inline-flex items-center rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-zinc-800 enabled:hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:enabled:hover:bg-zinc-800"
            aria-label="Volgende week"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      <p className="text-xs text-zinc-600 dark:text-zinc-400">
        Weekoverzicht per medewerker. Gebruik <strong>Taak inplannen</strong> om één blok voor meerdere dagen tegelijk te
        zetten. Zodra er voor een dag minstens één <strong>online boekbare</strong> dienst staat, worden vrije
        boektijden op de website beperkt tot de <strong>verenigde</strong> werktijden van die diensten (binnen je vaste
        openingstijden). Diensten als <strong>intern</strong> of met <code className="rounded bg-zinc-100 px-0.5 dark:bg-zinc-800">[afwezig]</code> in de notitie tellen daarbij niet mee. Geen enkele
        boekbare dienst op een dag → dan gelden alleen je openingstijden (zoals voorheen). Maximaal{" "}
        <strong>{STAFF_PLANNING_MAX_MONTHS} maanden</strong> vooruit.
      </p>

      {activeStaff.length === 0 ? (
        <p className="text-sm text-zinc-500">Geen actieve medewerkers. Voeg ze toe onder het tabblad Medewerkers.</p>
      ) : (
        <div className="space-y-2">
          {activeStaff.length > 1 ? (
            <label className="flex flex-wrap items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
              <span className="shrink-0 text-xs font-medium uppercase tracking-wide text-zinc-500">Weergave</span>
              <select
                value={tableStaffFilter}
                onChange={(e) => setTableStaffFilter(e.target.value)}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
              >
                <option value="">Alle medewerkers</option>
                {activeStaff.map((m) => (
                  <option key={m.id} value={m.id}>
                    Alleen {m.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/80">
                <th className="sticky left-0 z-10 border-r border-zinc-200 bg-zinc-50 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/80">
                  Medewerker
                </th>
                {columns.map((col) => (
                  <th
                    key={col.getTime()}
                    className="px-2 py-2 text-center text-xs font-medium text-zinc-700 dark:text-zinc-200"
                  >
                    {new Intl.DateTimeFormat("nl-NL", { weekday: "short", day: "numeric", month: "short" }).format(col)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleStaff.map((m) => (
                <tr key={m.id} className="border-b border-zinc-100 dark:border-zinc-800">
                  <td
                    className="sticky left-0 z-10 border-r border-zinc-200 bg-white px-3 py-2 font-medium text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950"
                    style={{ boxShadow: "1px 0 0 0 rgb(228 228 231)" }}
                  >
                    <span className="inline-flex items-center gap-2">
                      <span
                        className="h-8 w-1 shrink-0 rounded-full"
                        style={{ backgroundColor: staffColor(staff, m.id) }}
                        aria-hidden
                      />
                      {m.name}
                    </span>
                  </td>
                  {columns.map((col) => {
                    const list = shiftsInCell(m.id, col);
                    return (
                      <td
                        key={`${m.id}-${col.getTime()}`}
                        className="align-top px-1.5 py-2 text-xs text-zinc-600 dark:text-zinc-400"
                      >
                        <div className="flex min-h-[48px] flex-col gap-1">
                          {list.length === 0 ? (
                            <span className="text-[11px] text-zinc-400">—</span>
                          ) : (
                            list.map((s) => {
                              const intern = isInternShift(s.notes);
                              const bg = staffColor(staff, m.id);
                              return (
                                <button
                                  key={s.id}
                                  type="button"
                                  title="Klik om te verwijderen"
                                  onClick={() => void deleteShift(s)}
                                  className={cn(
                                    "rounded-md px-1.5 py-1 text-left text-[11px] font-medium leading-tight text-white shadow-sm ring-1 ring-black/10 hover:brightness-110",
                                    intern && "border border-dashed border-zinc-400 bg-zinc-500 text-white ring-0",
                                  )}
                                  style={intern ? undefined : { backgroundColor: bg }}
                                >
                                  {formatShiftRange(s.starts_at, s.ends_at, tz)}
                                  {intern ? <span className="block text-[10px] opacity-90">intern</span> : null}
                                </button>
                              );
                            })
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </div>
      )}
    </div>
  );
}

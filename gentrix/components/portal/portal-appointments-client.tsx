"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarPlus, Download, ExternalLink, Loader2, Pencil, Phone, XCircle } from "lucide-react";
import type { BookingSettings } from "@/lib/booking/booking-settings";
import { DEFAULT_BOOKING_SETTINGS } from "@/lib/booking/booking-settings";
import type { StaffMember } from "@/components/portal/portal-staff-client";
import { PortalAppointmentPlanning } from "@/components/portal/portal-appointment-planning";
import { PortalBookingAgendaSettings } from "@/components/portal/portal-booking-agenda-settings";
import { publicLiveBookingHref } from "@/lib/site/studio-section-visibility";
import { cn } from "@/lib/utils";

type AppointmentRow = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  status: string;
  notes: string | null;
  staff_id: string | null;
  booking_service_id: string | null;
  booker_name: string | null;
  booker_email: string | null;
  booker_wants_confirmation: boolean;
  booker_wants_reminder: boolean;
  reminder_sent_at: string | null;
};

type PortalBookingServiceRow = {
  id: string;
  name: string;
  duration_minutes: number;
  is_active: boolean;
};

function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function addMinutesToDatetimeLocalValue(startValue: string, minutes: number): string {
  const d = new Date(startValue);
  if (Number.isNaN(d.getTime())) return "";
  d.setMinutes(d.getMinutes() + minutes);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatRangeNl(startsAt: string, endsAt: string): string {
  const s = new Date(startsAt);
  const e = new Date(endsAt);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return startsAt;
  return new Intl.DateTimeFormat("nl-NL", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(s) + " – " + new Intl.DateTimeFormat("nl-NL", { hour: "2-digit", minute: "2-digit" }).format(e);
}

type Props = { slug: string; clientName: string };

export function PortalAppointmentsClient({ slug, clientName }: Props) {
  const enc = encodeURIComponent(slug);
  const liveBookingPath = publicLiveBookingHref(decodeURIComponent(slug));
  const base = `/api/portal/clients/${enc}/appointments`;
  const settingsBase = `/api/portal/clients/${enc}/booking-settings`;
  const staffBase = `/api/portal/clients/${enc}/staff`;
  const servicesUrl = `/api/portal/clients/${enc}/booking-services`;

  const [rows, setRows] = useState<AppointmentRow[]>([]);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [bookingServices, setBookingServices] = useState<PortalBookingServiceRow[]>([]);
  const [bookingSettings, setBookingSettings] = useState<BookingSettings>(DEFAULT_BOOKING_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [starts, setStarts] = useState("");
  const [ends, setEnds] = useState("");
  const [notes, setNotes] = useState("");
  const [createStaffId, setCreateStaffId] = useState<string>("");
  const [createBookingServiceId, setCreateBookingServiceId] = useState<string>("");
  const [bookerName, setBookerName] = useState("");
  const [bookerEmail, setBookerEmail] = useState("");
  const [bookerWantsConfirmation, setBookerWantsConfirmation] = useState(false);
  const [bookerWantsReminder, setBookerWantsReminder] = useState(false);
  const [saving, setSaving] = useState(false);
  const [bookerInfoModal, setBookerInfoModal] = useState<{ email: string } | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editStarts, setEditStarts] = useState("");
  const [editEnds, setEditEnds] = useState("");

  const load = useCallback(async () => {
    setErr(null);
    setLoading(true);
    try {
      const [aRes, sRes, stRes, svcRes] = await Promise.all([
        fetch(base),
        fetch(settingsBase),
        fetch(staffBase),
        fetch(servicesUrl),
      ]);
      const json = (await aRes.json()) as { ok?: boolean; appointments?: AppointmentRow[]; error?: string };
      const sJson = (await sRes.json()) as { ok?: boolean; settings?: BookingSettings; error?: string };
      const stJson = (await stRes.json()) as { ok?: boolean; staff?: StaffMember[] };
      const svcJson = (await svcRes.json()) as {
        ok?: boolean;
        services?: { id: string; name: string; duration_minutes: number; is_active: boolean }[];
      };

      if (sRes.ok && sJson.ok && sJson.settings) {
        setBookingSettings(sJson.settings);
      } else {
        setBookingSettings(DEFAULT_BOOKING_SETTINGS);
      }

      if (stRes.ok && stJson.ok) {
        setStaffMembers(stJson.staff ?? []);
      } else {
        setStaffMembers([]);
      }

      if (svcRes.ok && svcJson.ok) {
        setBookingServices(
          (svcJson.services ?? []).map((s) => ({
            id: s.id,
            name: s.name,
            duration_minutes: s.duration_minutes,
            is_active: Boolean(s.is_active),
          })),
        );
      } else {
        setBookingServices([]);
      }

      if (!aRes.ok || !json.ok) {
        setErr(json.error ?? "Laden mislukt.");
        setRows([]);
        return;
      }
      const list = json.appointments ?? [];
      setRows(
        list.map((r) => ({
          ...r,
          staff_id: r.staff_id ?? null,
          booking_service_id: r.booking_service_id ?? null,
          booker_name: r.booker_name ?? null,
          booker_email: r.booker_email ?? null,
          booker_wants_confirmation: Boolean(r.booker_wants_confirmation),
          booker_wants_reminder: Boolean(r.booker_wants_reminder),
          reminder_sent_at: r.reminder_sent_at ?? null,
        })),
      );
    } catch {
      setErr("Netwerkfout.");
      setRows([]);
      setBookingSettings(DEFAULT_BOOKING_SETTINGS);
      setBookingServices([]);
    } finally {
      setLoading(false);
    }
  }, [base, settingsBase, staffBase, servicesUrl]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!createBookingServiceId || !starts.trim()) return;
    const svc = bookingServices.find((s) => s.id === createBookingServiceId && s.is_active);
    if (!svc) return;
    setEnds(addMinutesToDatetimeLocalValue(starts, svc.duration_minutes));
  }, [createBookingServiceId, starts, bookingServices]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim() || undefined,
          starts_at: new Date(starts).toISOString(),
          ends_at: new Date(ends).toISOString(),
          notes: notes.trim() || null,
          staff_id: createStaffId.trim() || null,
          booking_service_id: createBookingServiceId.trim() || null,
          booker_name: bookerName.trim() || null,
          booker_email: bookerEmail.trim() || null,
          booker_wants_confirmation: bookerWantsConfirmation,
          booker_wants_reminder: bookerWantsReminder,
        }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setErr(json.error ?? "Opslaan mislukt.");
        return;
      }
      const sentTo = bookerEmail.trim();
      if (bookerWantsConfirmation && sentTo) {
        setBookerInfoModal({ email: sentTo });
      }
      setTitle("");
      setStarts("");
      setEnds("");
      setNotes("");
      setCreateBookingServiceId("");
      setBookerName("");
      setBookerEmail("");
      setBookerWantsConfirmation(false);
      setBookerWantsReminder(false);
      await load();
    } catch {
      setErr("Netwerkfout.");
    } finally {
      setSaving(false);
    }
  }

  async function patchAppointment(id: string, body: Record<string, unknown>) {
    setErr(null);
    try {
      const res = await fetch(`${base}/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setErr(json.error ?? "Bijwerken mislukt.");
        return;
      }
      setEditingId(null);
      await load();
    } catch {
      setErr("Netwerkfout.");
    }
  }

  function startEdit(row: AppointmentRow) {
    setEditingId(row.id);
    setEditStarts(toDatetimeLocalValue(row.starts_at));
    setEditEnds(toDatetimeLocalValue(row.ends_at));
  }

  async function submitReschedule(id: string) {
    await patchAppointment(id, {
      starts_at: new Date(editStarts).toISOString(),
      ends_at: new Date(editEnds).toISOString(),
    });
  }

  return (
    <div className="space-y-8">
      {bookerInfoModal ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="portal-appt-confirm-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
            <h2 id="portal-appt-confirm-title" className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Bevestiging naar boeker
            </h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
              Er is een bevestiging met agenda-bestand (.ics) verstuurd naar{" "}
              <strong className="text-zinc-800 dark:text-zinc-100">{bookerInfoModal.email}</strong>.
            </p>
            <button
              type="button"
              onClick={() => setBookerInfoModal(null)}
              className="mt-6 w-full rounded-lg bg-zinc-900 py-2.5 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
            >
              OK
            </button>
          </div>
        </div>
      ) : null}

      {err ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {err}
        </p>
      ) : null}

      <PortalBookingAgendaSettings slug={slug} onSaved={() => void load()} />

      {!loading ? (
        <PortalAppointmentPlanning settings={bookingSettings} appointments={rows} />
      ) : null}

      <section className="rounded-xl border border-violet-200 bg-violet-50/50 p-5 dark:border-violet-900/40 dark:bg-violet-950/25">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-violet-950 dark:text-violet-100">
              Voorbeeld: online boekpagina
            </h2>
            <p className="mt-1 max-w-xl text-xs text-violet-900/85 dark:text-violet-200/85">
              Dit is dezelfde stap-voor-stap flow als bezoekers zien op{" "}
              <code className="rounded bg-white/80 px-1 dark:bg-violet-950/50">{liveBookingPath}</code>.
              Handmatig invoeren doe je hieronder — niet in dit venster.
            </p>
          </div>
          <a
            href={liveBookingPath}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-violet-300 bg-white px-3 py-2 text-xs font-medium text-violet-900 hover:bg-violet-50 dark:border-violet-700 dark:bg-violet-950/40 dark:text-violet-100 dark:hover:bg-violet-900/40"
          >
            <ExternalLink className="size-3.5" aria-hidden />
            Open in nieuw tabblad
          </a>
        </div>
        <div className="mt-4 overflow-hidden rounded-xl border border-violet-200/90 bg-white shadow-sm dark:border-violet-800/60 dark:bg-zinc-900">
          <iframe
            title="Voorbeeld online boekpagina voor bezoekers"
            src={liveBookingPath}
            className="h-[min(680px,82vh)] w-full border-0"
          />
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          <CalendarPlus className="size-4 text-violet-600 dark:text-violet-400" aria-hidden />
          Handmatig afspraak invoeren
        </h2>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Voor telefonische of walk-in boekingen. Voor online klanten geldt het voorbeeld hierboven.
        </p>
        <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={(e) => void onCreate(e)}>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 sm:col-span-2">
            Titel (optioneel)
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
              placeholder="Afspraak"
            />
          </label>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Start
            <input
              type="datetime-local"
              required
              value={starts}
              onChange={(e) => setStarts(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </label>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Einde
            <input
              type="datetime-local"
              required
              value={ends}
              onChange={(e) => setEnds(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </label>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 sm:col-span-2">
            Notitie
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </label>

          {bookingServices.filter((s) => s.is_active).length > 0 ? (
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 sm:col-span-2">
              Behandeling (optioneel, zelfde lijst als op /boek)
              <select
                value={createBookingServiceId}
                onChange={(e) => setCreateBookingServiceId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
              >
                <option value="">— geen —</option>
                {bookingServices
                  .filter((s) => s.is_active)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.duration_minutes} min)
                    </option>
                  ))}
              </select>
              <span className="mt-1 block text-[11px] font-normal text-zinc-500 dark:text-zinc-400">
                Met behandeling wordt het eindtijdveld automatisch op de duur gezet (aanpasbaar).
              </span>
            </label>
          ) : null}

          {staffMembers.filter((s) => s.is_active).length > 0 ? (
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 sm:col-span-2">
              Medewerker (optioneel)
              <select
                value={createStaffId}
                onChange={(e) => setCreateStaffId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
              >
                <option value="">— niet gekoppeld —</option>
                {staffMembers
                  .filter((s) => s.is_active)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
              </select>
            </label>
          ) : null}

          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 sm:col-span-2">Boeker (optioneel)</p>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Naam boeker
            <input
              value={bookerName}
              onChange={(e) => setBookerName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
              placeholder="Klant"
            />
          </label>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            E-mail boeker
            <input
              type="email"
              value={bookerEmail}
              onChange={(e) => setBookerEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
              placeholder="nodig voor bevestiging/herinnering"
            />
          </label>
          <div className="space-y-2 rounded-lg border border-zinc-100 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950/50 sm:col-span-2">
            <label className="flex cursor-pointer items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300">
              <input
                type="checkbox"
                checked={bookerWantsConfirmation}
                onChange={(e) => setBookerWantsConfirmation(e.target.checked)}
                className="mt-0.5"
              />
              <span>Boeker ontvangt bevestiging per e-mail (.ics).</span>
            </label>
            <label className="flex cursor-pointer items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300">
              <input
                type="checkbox"
                checked={bookerWantsReminder}
                onChange={(e) => setBookerWantsReminder(e.target.checked)}
                className="mt-0.5"
              />
              <span>Boeker krijgt herinnering één dag van tevoren (e-mail).</span>
            </label>
          </div>

          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
            >
              {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              Opslaan
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Gepland & historie</h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            <Phone className="mr-1 inline size-3.5 align-text-bottom" aria-hidden />
            Liever bellen? Gebruik het nummer uit je commerciële gegevens.
          </p>
        </div>

        {loading ? (
          <p className="mt-6 flex items-center gap-2 text-sm text-zinc-500">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Laden…
          </p>
        ) : rows.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">Nog geen afspraken.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {rows.map((row) => (
              <li
                key={row.id}
                className={cn(
                  "rounded-lg border border-zinc-200 p-4 dark:border-zinc-700",
                  row.status === "cancelled" && "opacity-60",
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-zinc-900 dark:text-zinc-50">{row.title}</p>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">{formatRangeNl(row.starts_at, row.ends_at)}</p>
                    {row.booking_service_id ? (
                      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                        Behandeling:{" "}
                        {bookingServices.find((s) => s.id === row.booking_service_id)?.name ??
                          row.booking_service_id.slice(0, 8) + "…"}
                      </p>
                    ) : null}
                    {row.staff_id ? (
                      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                        Medewerker:{" "}
                        {staffMembers.find((s) => s.id === row.staff_id)?.name ?? row.staff_id.slice(0, 8) + "…"}
                      </p>
                    ) : null}
                    {row.notes?.trim() ? (
                      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{row.notes}</p>
                    ) : null}
                    {row.booker_email?.trim() ? (
                      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                        Boeker: {row.booker_name?.trim() ? `${row.booker_name.trim()} · ` : null}
                        {row.booker_email.trim()}
                        {row.booker_wants_reminder ? " · herinnering aan" : null}
                      </p>
                    ) : null}
                    {row.status === "cancelled" ? (
                      <p className="mt-1 text-xs font-medium uppercase text-red-600 dark:text-red-400">Geannuleerd</p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {row.status === "scheduled" ? (
                      <>
                        <a
                          href={`${base}/${encodeURIComponent(row.id)}/ics`}
                          className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 px-2 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                        >
                          <Download className="size-3.5" aria-hidden />
                          .ics
                        </a>
                        <button
                          type="button"
                          onClick={() => startEdit(row)}
                          className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 px-2 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                        >
                          <Pencil className="size-3.5" aria-hidden />
                          Verzetten
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm("Afspraak annuleren?")) {
                              void patchAppointment(row.id, { status: "cancelled" });
                            }
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2 py-1.5 text-xs font-medium text-red-800 hover:bg-red-50 dark:border-red-900 dark:text-red-200 dark:hover:bg-red-950/40"
                        >
                          <XCircle className="size-3.5" aria-hidden />
                          Annuleren
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>
                {editingId === row.id ? (
                  <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                    <label className="text-xs text-zinc-600 dark:text-zinc-400">
                      Nieuwe start
                      <input
                        type="datetime-local"
                        value={editStarts}
                        onChange={(e) => setEditStarts(e.target.value)}
                        className="mt-1 block rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-950"
                      />
                    </label>
                    <label className="text-xs text-zinc-600 dark:text-zinc-400">
                      Nieuw einde
                      <input
                        type="datetime-local"
                        value={editEnds}
                        onChange={(e) => setEditEnds(e.target.value)}
                        className="mt-1 block rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-950"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => void submitReschedule(row.id)}
                      className="rounded-lg bg-zinc-900 px-3 py-2 text-xs font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
                    >
                      Opslaan tijden
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="rounded-lg border border-zinc-300 px-3 py-2 text-xs dark:border-zinc-600"
                    >
                      Annuleren
                    </button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Werkdagen onder &quot;Online boekagenda&quot; en het iframe hierboven gebruiken dezelfde instellingen als de
        publieke pagina{" "}
        <code className="rounded bg-zinc-100 px-1 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">{liveBookingPath}</code>
        . Bij een ingevulde <strong className="text-zinc-700 dark:text-zinc-300">factuur e-mail</strong> (commercie)
        sturen we jou een bevestiging met <strong className="text-zinc-700 dark:text-zinc-300">.ics</strong> bij nieuwe
        en verzette afspraken; bij annulering een korte mail. Optioneel: bevestiging/herinnering naar de boeker
        (e-mail + vinkjes). ({clientName})
      </p>
    </div>
  );
}

import { buildAppointmentIcsCalendar } from "@/lib/calendar/appointment-ics";
import { sendTransactionalEmail } from "@/lib/email/resend-send";

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatNlRange(startsAt: string, endsAt: string): string {
  const s = new Date(startsAt);
  const e = new Date(endsAt);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return startsAt;
  const d = new Intl.DateTimeFormat("nl-NL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(s);
  const t = new Intl.DateTimeFormat("nl-NL", { hour: "2-digit", minute: "2-digit" }).format(e);
  return `${d} tot ${t}`;
}

export type AppointmentEmailRow = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  status: string;
  notes: string | null;
  booker_name?: string | null;
  booker_email?: string | null;
  booker_wants_confirmation?: boolean;
  booker_wants_reminder?: boolean;
  reminder_sent_at?: string | null;
};

/**
 * Stuurt optioneel een bevestiging; faalt stil naar de API (alleen console in dev).
 */
export async function trySendAppointmentCreatedEmail(params: {
  to: string | null | undefined;
  clientName: string;
  appointment: AppointmentEmailRow;
}): Promise<void> {
  const to = params.to?.trim();
  if (!to) return;
  if (params.appointment.status !== "scheduled") return;

  const starts = new Date(params.appointment.starts_at);
  const ends = new Date(params.appointment.ends_at);
  const ics = buildAppointmentIcsCalendar({
    uid: `${params.appointment.id}@portal-website-fabriek`,
    title: params.appointment.title,
    startsAt: starts,
    endsAt: ends,
    notes: params.appointment.notes,
    organizerName: params.clientName,
  });
  const icsB64 = Buffer.from(ics, "utf8").toString("base64");

  const when = formatNlRange(params.appointment.starts_at, params.appointment.ends_at);
  const html = `
    <p>Hallo,</p>
    <p>Je afspraak bij <strong>${escapeHtml(params.clientName)}</strong> staat gepland.</p>
    <p><strong>${escapeHtml(params.appointment.title)}</strong><br/>${escapeHtml(when)}</p>
    ${
      params.appointment.notes?.trim()
        ? `<p>Notitie: ${escapeHtml(params.appointment.notes.trim())}</p>`
        : ""
    }
    <p>Voeg de bijlage toe aan je agenda (telefoon of computer).</p>
    <p style="color:#666;font-size:13px;">Dit bericht is automatisch verstuurd.</p>
  `.trim();

  const text = [
    `Afspraak bij ${params.clientName}`,
    `${params.appointment.title}`,
    when,
    params.appointment.notes?.trim() ?? "",
    "",
    "Zie de bijlage (.ics) voor je agenda.",
  ]
    .filter(Boolean)
    .join("\n");

  const result = await sendTransactionalEmail({
    to,
    subject: `Afspraak bevestigd — ${params.clientName}`,
    html,
    text,
    attachments: [{ filename: "afspraak.ics", content: icsB64 }],
  });

  if (!result.ok && process.env.NODE_ENV === "development") {
    console.warn("[email] Aanmaken:", result.error);
  }
}

export async function trySendAppointmentUpdatedEmail(params: {
  to: string | null | undefined;
  clientName: string;
  appointment: AppointmentEmailRow;
}): Promise<void> {
  const to = params.to?.trim();
  if (!to) return;
  if (params.appointment.status !== "scheduled") return;

  const starts = new Date(params.appointment.starts_at);
  const ends = new Date(params.appointment.ends_at);
  const ics = buildAppointmentIcsCalendar({
    uid: `${params.appointment.id}@portal-website-fabriek`,
    title: params.appointment.title,
    startsAt: starts,
    endsAt: ends,
    notes: params.appointment.notes,
    organizerName: params.clientName,
  });
  const icsB64 = Buffer.from(ics, "utf8").toString("base64");
  const when = formatNlRange(params.appointment.starts_at, params.appointment.ends_at);

  const html = `
    <p>Hallo,</p>
    <p>Je afspraak bij <strong>${escapeHtml(params.clientName)}</strong> is gewijzigd.</p>
    <p><strong>${escapeHtml(params.appointment.title)}</strong><br/>${escapeHtml(when)}</p>
    ${
      params.appointment.notes?.trim()
        ? `<p>Notitie: ${escapeHtml(params.appointment.notes.trim())}</p>`
        : ""
    }
    <p>Gebruik de nieuwe bijlage om je agenda bij te werken.</p>
    <p style="color:#666;font-size:13px;">Dit bericht is automatisch verstuurd.</p>
  `.trim();

  const result = await sendTransactionalEmail({
    to,
    subject: `Afspraak gewijzigd — ${params.clientName}`,
    html,
    text: `Afspraak gewijzigd bij ${params.clientName}\n${params.appointment.title}\n${when}`,
    attachments: [{ filename: "afspraak.ics", content: icsB64 }],
  });

  if (!result.ok && process.env.NODE_ENV === "development") {
    console.warn("[email] Wijziging:", result.error);
  }
}

export async function trySendAppointmentCancelledEmail(params: {
  to: string | null | undefined;
  clientName: string;
  appointment: AppointmentEmailRow;
}): Promise<void> {
  const to = params.to?.trim();
  if (!to) return;

  const when = formatNlRange(params.appointment.starts_at, params.appointment.ends_at);
  const html = `
    <p>Hallo,</p>
    <p>Je afspraak bij <strong>${escapeHtml(params.clientName)}</strong> is geannuleerd.</p>
    <p><strong>${escapeHtml(params.appointment.title)}</strong><br/>${escapeHtml(when)}</p>
    <p style="color:#666;font-size:13px;">Dit bericht is automatisch verstuurd.</p>
  `.trim();

  const result = await sendTransactionalEmail({
    to,
    subject: `Afspraak geannuleerd — ${params.clientName}`,
    html,
    text: `Afspraak geannuleerd bij ${params.clientName}\n${params.appointment.title}\n${when}`,
  });

  if (!result.ok && process.env.NODE_ENV === "development") {
    console.warn("[email] Annulering:", result.error);
  }
}

function bookerGreeting(bookerName: string | null | undefined): string {
  const n = bookerName?.trim();
  if (n) return `Hallo ${escapeHtml(n)},`;
  return "Hallo,";
}

/**
 * Bevestiging naar de boeker (eindklant) na aanmaken; optioneel .ics.
 */
export async function trySendBookerAppointmentConfirmationEmail(params: {
  to: string;
  clientName: string;
  bookerName: string | null;
  appointment: AppointmentEmailRow;
}): Promise<void> {
  const to = params.to?.trim();
  if (!to) return;
  if (params.appointment.status !== "scheduled") return;

  const starts = new Date(params.appointment.starts_at);
  const ends = new Date(params.appointment.ends_at);
  const ics = buildAppointmentIcsCalendar({
    uid: `${params.appointment.id}@portal-website-fabriek`,
    title: params.appointment.title,
    startsAt: starts,
    endsAt: ends,
    notes: params.appointment.notes,
    organizerName: params.clientName,
  });
  const icsB64 = Buffer.from(ics, "utf8").toString("base64");
  const when = formatNlRange(params.appointment.starts_at, params.appointment.ends_at);

  const html = `
    ${bookerGreeting(params.bookerName)}
    <p>Je afspraak bij <strong>${escapeHtml(params.clientName)}</strong> is bevestigd.</p>
    <p><strong>${escapeHtml(params.appointment.title)}</strong><br/>${escapeHtml(when)}</p>
    ${
      params.appointment.notes?.trim()
        ? `<p>Notitie: ${escapeHtml(params.appointment.notes.trim())}</p>`
        : ""
    }
    <p>Voeg de bijlage toe aan je agenda als je dat handig vindt.</p>
    <p style="color:#666;font-size:13px;">Dit bericht is automatisch verstuurd.</p>
  `.trim();

  const result = await sendTransactionalEmail({
    to,
    subject: `Bevestiging: afspraak bij ${params.clientName}`,
    html,
    text: `Afspraak bevestigd bij ${params.clientName}\n${params.appointment.title}\n${when}`,
    attachments: [{ filename: "afspraak.ics", content: icsB64 }],
  });

  if (!result.ok && process.env.NODE_ENV === "development") {
    console.warn("[email] Boeker bevestiging:", result.error);
  }
}

export async function trySendBookerAppointmentUpdatedEmail(params: {
  to: string;
  clientName: string;
  bookerName: string | null;
  appointment: AppointmentEmailRow;
}): Promise<void> {
  const to = params.to?.trim();
  if (!to) return;
  if (params.appointment.status !== "scheduled") return;

  const starts = new Date(params.appointment.starts_at);
  const ends = new Date(params.appointment.ends_at);
  const ics = buildAppointmentIcsCalendar({
    uid: `${params.appointment.id}@portal-website-fabriek`,
    title: params.appointment.title,
    startsAt: starts,
    endsAt: ends,
    notes: params.appointment.notes,
    organizerName: params.clientName,
  });
  const icsB64 = Buffer.from(ics, "utf8").toString("base64");
  const when = formatNlRange(params.appointment.starts_at, params.appointment.ends_at);

  const html = `
    ${bookerGreeting(params.bookerName)}
    <p>Je afspraak bij <strong>${escapeHtml(params.clientName)}</strong> is verzet.</p>
    <p><strong>${escapeHtml(params.appointment.title)}</strong><br/>${escapeHtml(when)}</p>
    ${
      params.appointment.notes?.trim()
        ? `<p>Notitie: ${escapeHtml(params.appointment.notes.trim())}</p>`
        : ""
    }
    <p>Gebruik de bijlage om je agenda bij te werken.</p>
    <p style="color:#666;font-size:13px;">Dit bericht is automatisch verstuurd.</p>
  `.trim();

  const result = await sendTransactionalEmail({
    to,
    subject: `Afspraak gewijzigd — ${params.clientName}`,
    html,
    text: `Afspraak gewijzigd bij ${params.clientName}\n${params.appointment.title}\n${when}`,
    attachments: [{ filename: "afspraak.ics", content: icsB64 }],
  });

  if (!result.ok && process.env.NODE_ENV === "development") {
    console.warn("[email] Boeker wijziging:", result.error);
  }
}

export async function trySendBookerAppointmentCancelledEmail(params: {
  to: string;
  clientName: string;
  bookerName: string | null;
  appointment: AppointmentEmailRow;
}): Promise<void> {
  const to = params.to?.trim();
  if (!to) return;

  const when = formatNlRange(params.appointment.starts_at, params.appointment.ends_at);
  const html = `
    ${bookerGreeting(params.bookerName)}
    <p>Je afspraak bij <strong>${escapeHtml(params.clientName)}</strong> is geannuleerd.</p>
    <p><strong>${escapeHtml(params.appointment.title)}</strong><br/>${escapeHtml(when)}</p>
    <p style="color:#666;font-size:13px;">Dit bericht is automatisch verstuurd.</p>
  `.trim();

  const result = await sendTransactionalEmail({
    to,
    subject: `Afspraak geannuleerd — ${params.clientName}`,
    html,
    text: `Afspraak geannuleerd bij ${params.clientName}\n${params.appointment.title}\n${when}`,
  });

  if (!result.ok && process.env.NODE_ENV === "development") {
    console.warn("[email] Boeker annulering:", result.error);
  }
}

/** @returns true als de mail daadwerkelijk verzonden is (niet overgeslagen door ontbrekende API-key). */
export async function trySendBookerAppointmentReminderEmail(params: {
  to: string;
  clientName: string;
  bookerName: string | null;
  appointment: AppointmentEmailRow;
}): Promise<boolean> {
  const to = params.to?.trim();
  if (!to) return false;
  if (params.appointment.status !== "scheduled") return false;

  const when = formatNlRange(params.appointment.starts_at, params.appointment.ends_at);
  const html = `
    ${bookerGreeting(params.bookerName)}
    <p>Dit is een herinnering: je hebt morgen een afspraak bij <strong>${escapeHtml(params.clientName)}</strong>.</p>
    <p><strong>${escapeHtml(params.appointment.title)}</strong><br/>${escapeHtml(when)}</p>
    ${
      params.appointment.notes?.trim()
        ? `<p>Notitie: ${escapeHtml(params.appointment.notes.trim())}</p>`
        : ""
    }
    <p style="color:#666;font-size:13px;">Dit bericht is automatisch verstuurd.</p>
  `.trim();

  const result = await sendTransactionalEmail({
    to,
    subject: `Herinnering: morgen afspraak bij ${params.clientName}`,
    html,
    text: `Herinnering: morgen afspraak bij ${params.clientName}\n${params.appointment.title}\n${when}`,
  });

  if (!result.ok && process.env.NODE_ENV === "development") {
    console.warn("[email] Boeker herinnering:", result.error);
  }

  return result.ok === true && !("skipped" in result && result.skipped);
}

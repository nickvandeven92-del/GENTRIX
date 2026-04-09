/** Escape voor tekstvelden in iCalendar (RFC 5545). */
function icsEscapeText(s: string): string {
  return s
    .replaceAll("\\", "\\\\")
    .replaceAll("\n", "\\n")
    .replaceAll(",", "\\,")
    .replaceAll(";", "\\;");
}

function toIcsUtc(dt: Date): string {
  return (
    dt.getUTCFullYear() +
    String(dt.getUTCMonth() + 1).padStart(2, "0") +
    String(dt.getUTCDate()).padStart(2, "0") +
    "T" +
    String(dt.getUTCHours()).padStart(2, "0") +
    String(dt.getUTCMinutes()).padStart(2, "0") +
    String(dt.getUTCSeconds()).padStart(2, "0") +
    "Z"
  );
}

export type BuildAppointmentIcsInput = {
  uid: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
  notes?: string | null;
  /** Organisator / locatie — bijv. bedrijfsnaam */
  organizerName?: string;
};

export function buildAppointmentIcsCalendar(input: BuildAppointmentIcsInput): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Website Fabriek//Portal//NL",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${input.uid}`,
    `DTSTAMP:${toIcsUtc(new Date())}`,
    `DTSTART:${toIcsUtc(input.startsAt)}`,
    `DTEND:${toIcsUtc(input.endsAt)}`,
    `SUMMARY:${icsEscapeText(input.title)}`,
  ];
  if (input.notes?.trim()) {
    lines.push(`DESCRIPTION:${icsEscapeText(input.notes.trim())}`);
  }
  if (input.organizerName?.trim()) {
    lines.push(`LOCATION:${icsEscapeText(input.organizerName.trim())}`);
  }
  lines.push("END:VEVENT", "END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}

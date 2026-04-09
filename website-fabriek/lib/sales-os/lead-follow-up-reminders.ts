export type FollowUpReminderTier = "d3" | "d1" | "d0";

export type FollowUpReminderStateV1 = {
  at?: string | null;
  fired?: FollowUpReminderTier[];
};

function ymdToUtcNoon(ymd: string): number {
  const [y, m, d] = ymd.split("-").map(Number);
  return Date.UTC(y, m - 1, d, 12, 0, 0);
}

/** Kalenderdagen tussen twee YYYY-MM-DD strings (later − eerder). */
export function diffCalendarDaysYmd(fromYmd: string, toYmd: string): number {
  return Math.round((ymdToUtcNoon(toYmd) - ymdToUtcNoon(fromYmd)) / (24 * 60 * 60 * 1000));
}

export function parseFollowUpReminderState(raw: unknown): FollowUpReminderStateV1 {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const o = raw as Record<string, unknown>;
  const at = typeof o.at === "string" ? o.at : o.at === null ? null : undefined;
  const firedRaw = o.fired;
  const fired: FollowUpReminderTier[] = [];
  if (Array.isArray(firedRaw)) {
    for (const x of firedRaw) {
      if (x === "d3" || x === "d1" || x === "d0") fired.push(x);
    }
  }
  return { at: at ?? undefined, fired };
}

/** Zorgt dat state bij de huidige next_follow_up_at hoort; anders leeg fired. */
export function alignReminderStateToAnchor(
  raw: unknown,
  nextFollowUpAt: string,
): { at: string; fired: FollowUpReminderTier[] } {
  const parsed = parseFollowUpReminderState(raw);
  if (parsed.at === nextFollowUpAt && Array.isArray(parsed.fired)) {
    return { at: nextFollowUpAt, fired: [...parsed.fired] };
  }
  return { at: nextFollowUpAt, fired: [] };
}

export function tierForDiffDays(diff: number): FollowUpReminderTier | null {
  if (diff === 3) return "d3";
  if (diff === 1) return "d1";
  if (diff === 0) return "d0";
  return null;
}

export function formatFollowUpDisplayNl(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("nl-NL", {
    timeZone: "Europe/Amsterdam",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function todayLabelNl(ref: Date): string {
  return new Intl.DateTimeFormat("nl-NL", {
    timeZone: "Europe/Amsterdam",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(ref);
}

export function buildFollowUpReminderNoteLine(
  tier: FollowUpReminderTier,
  nextFollowUpAtIso: string,
  cronRunAt: Date,
): string {
  const today = todayLabelNl(cronRunAt);
  const when = formatFollowUpDisplayNl(nextFollowUpAtIso);
  if (tier === "d3") {
    return `[${today} — automatische herinnering] Nog 3 dagen tot de geplande follow-up (${when}).`;
  }
  if (tier === "d1") {
    return `[${today} — automatische herinnering] Morgen staat de follow-up gepland (${when}).`;
  }
  return `[${today} — automatische herinnering] Vandaag staat de follow-up gepland (${when}).`;
}

export function prependLeadNote(existing: string | null, line: string): string {
  const prev = existing?.trim() ?? "";
  if (!prev) return line;
  return `${line}\n\n${prev}`;
}

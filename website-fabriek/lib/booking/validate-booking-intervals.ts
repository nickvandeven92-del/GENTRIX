function hmToMinutes(hm: string): number {
  const [h, m] = hm.split(":").map((x) => parseInt(x, 10));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return NaN;
  return h * 60 + m;
}

/** Gesorteerd op start; alleen geldige start<eind. */
export function normalizedIntervalMinutes(
  intervals: { start: string; end: string }[],
): { startMin: number; endMin: number }[] {
  return intervals
    .map((i) => ({
      startMin: hmToMinutes(i.start),
      endMin: hmToMinutes(i.end),
    }))
    .filter((x) => Number.isFinite(x.startMin) && Number.isFinite(x.endMin) && x.endMin > x.startMin)
    .sort((a, b) => a.startMin - b.startMin);
}

/** True als twee blokken elkaar overlappen (geen gat = ook overlap i.h.b. dubbele slots). */
export function bookingIntervalsOverlap(intervals: { start: string; end: string }[]): boolean {
  const mins = normalizedIntervalMinutes(intervals);
  for (let i = 1; i < mins.length; i++) {
    if (mins[i].startMin < mins[i - 1].endMin) return true;
  }
  return false;
}

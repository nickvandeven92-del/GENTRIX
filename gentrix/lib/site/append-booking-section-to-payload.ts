import type { TailwindSection } from "@/lib/ai/tailwind-sections-schema";
import { buildDefaultBookingSection } from "@/lib/site/default-booking-section";

export type AppendBookingSectionResult =
  | { ok: true; sections: TailwindSection[]; replaced: boolean }
  | { ok: false; error: "already_exists" };

/**
 * Voegt standaard `id: "booking"` toe vóór `footer` (of aan het eind).
 * Bij `replaceExisting` wordt een bestaande booking-sectie vervangen.
 */
export function appendDefaultBookingSectionToSections(
  sections: TailwindSection[],
  options?: { replaceExisting?: boolean; headline?: string },
): AppendBookingSectionResult {
  const has = sections.some((s) => s.id === "booking");
  if (has && !options?.replaceExisting) {
    return { ok: false, error: "already_exists" };
  }

  let next = sections;
  let replaced = false;
  if (has && options?.replaceExisting) {
    next = sections.filter((s) => s.id !== "booking");
    replaced = true;
  }

  const booking = buildDefaultBookingSection({ headline: options?.headline });
  const footerIdx = next.findIndex((s) => s.id === "footer");
  const insertAt = footerIdx >= 0 ? footerIdx : next.length;
  const merged = [...next.slice(0, insertAt), booking, ...next.slice(insertAt)];
  return { ok: true, sections: merged, replaced };
}

/**
 * Na AI-generatie: verwijdert eventuele model-sectie `id: "booking"` (voorkomt dubbel) en voegt het vaste
 * canonical blok met `__STUDIO_BOOKING_PATH__` toe. Zichtbaarheid op /site hangt van `appointments_enabled` af.
 */
export function ensureCanonicalBookingSectionInTailwindSections(sections: TailwindSection[]): TailwindSection[] {
  const withoutModelBooking = sections.filter((s) => s.id !== "booking");
  const merged = appendDefaultBookingSectionToSections(withoutModelBooking, { replaceExisting: false });
  return merged.ok ? merged.sections : withoutModelBooking;
}

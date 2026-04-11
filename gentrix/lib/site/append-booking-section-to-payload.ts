import type { TailwindSection } from "@/lib/ai/tailwind-sections-schema";
import { buildDefaultBookingSection } from "@/lib/site/default-booking-section";
import { buildDefaultShopSection } from "@/lib/site/default-shop-section";

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
 * canonical blok met `__STUDIO_BOOKING_PATH__` toe. CRM bepaalt zichtbaarheid/activatie; de placeholder
 * resolvet altijd naar `/boek/{slug}` (inactive-pagina als de feature nog uit staat).
 */
export function ensureCanonicalBookingSectionInTailwindSections(sections: TailwindSection[]): TailwindSection[] {
  const withoutModelBooking = sections.filter((s) => s.id !== "booking");
  const merged = appendDefaultBookingSectionToSections(withoutModelBooking, { replaceExisting: false });
  return merged.ok ? merged.sections : withoutModelBooking;
}

export type AppendShopSectionResult =
  | { ok: true; sections: TailwindSection[]; replaced: boolean }
  | { ok: false; error: "already_exists" };

/**
 * Voegt standaard `id: "shop"` toe vóór `footer` (of aan het eind), naast het booking-blok.
 */
export function appendDefaultShopSectionToSections(
  sections: TailwindSection[],
  options?: { replaceExisting?: boolean; headline?: string },
): AppendShopSectionResult {
  const has = sections.some((s) => s.id === "shop");
  if (has && !options?.replaceExisting) {
    return { ok: false, error: "already_exists" };
  }

  let next = sections;
  let replaced = false;
  if (has && options?.replaceExisting) {
    next = sections.filter((s) => s.id !== "shop");
    replaced = true;
  }

  const shop = buildDefaultShopSection({ headline: options?.headline });
  const footerIdx = next.findIndex((s) => s.id === "footer");
  const insertAt = footerIdx >= 0 ? footerIdx : next.length;
  const merged = [...next.slice(0, insertAt), shop, ...next.slice(insertAt)];
  return { ok: true, sections: merged, replaced };
}

/**
 * Na AI-generatie: verwijdert eventuele model-sectie `id: "shop"` en voegt het vaste
 * vier-productenblok toe. CRM bepaalt zichtbaarheid/activatie; `/winkel/{slug}` blijft een geldige route.
 */
export function ensureCanonicalShopSectionInTailwindSections(sections: TailwindSection[]): TailwindSection[] {
  const withoutModelShop = sections.filter((s) => s.id !== "shop");
  const merged = appendDefaultShopSectionToSections(withoutModelShop, { replaceExisting: false });
  return merged.ok ? merged.sections : withoutModelShop;
}

/** Booking- en shop-secties in vaste volgorde (booking → shop → footer). */
export function ensureCanonicalBookingAndShopSectionsInTailwindSections(
  sections: TailwindSection[],
): TailwindSection[] {
  return ensureCanonicalShopSectionInTailwindSections(ensureCanonicalBookingSectionInTailwindSections(sections));
}

import type { TailwindSection, TailwindSectionsPayload } from "@/lib/ai/tailwind-sections-schema";
import { buildDefaultBookingSection } from "@/lib/site/default-booking-section";
import { buildDefaultShopSection } from "@/lib/site/default-shop-section";
import type { PublicSiteModuleFlags } from "@/lib/site/public-site-modules-registry";

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
 * Verwijdert `id: "booking"` en `id: "shop"` uit model-output (geen canonieke injectie).
 * Standaardblokken voeg je toe via admin (`append-booking-section` / `append-shop-section`).
 */
export function stripModelBookingAndShopSectionsFromTailwindSections(
  sections: TailwindSection[],
): TailwindSection[] {
  return sections.filter((s) => s.id !== "booking" && s.id !== "shop");
}

/**
 * Na ophalen van model-JSON: model-`booking` verwijderen en het vaste canonieke blok met
 * `__STUDIO_BOOKING_PATH__` toevoegen. Onder meer voor handmatige/normalisatie-flows; **niet** meer
 * standaard na elke site-generatie.
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
/**
 * CRM-modules die **aan** staan vereisen canonieke sectie-id's (`shop`, `booking`) in de snapshot (site-IR).
 * AI-output strip't die secties; bij opslaan voegen we het vaste studio-blok toe zodat persist niet faalt.
 */
export function ensureCanonicalModuleSectionsForCrmFlags(
  payload: TailwindSectionsPayload,
  flags: PublicSiteModuleFlags,
): TailwindSectionsPayload {
  let sections = payload.sections;
  let changed = false;
  if (flags.webshopEnabled && !sections.some((s) => s.id === "shop")) {
    const r = appendDefaultShopSectionToSections(sections);
    if (r.ok) {
      sections = r.sections;
      changed = true;
    }
  }
  if (flags.appointmentsEnabled && !sections.some((s) => s.id === "booking")) {
    const r = appendDefaultBookingSectionToSections(sections);
    if (r.ok) {
      sections = r.sections;
      changed = true;
    }
  }
  return changed ? { ...payload, sections } : payload;
}

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
 * Model-`shop` verwijderen en het vaste vier-productenblok toevoegen. Onder meer voor admin-append;
 * **niet** standaard na elke site-generatie.
 */
export function ensureCanonicalShopSectionInTailwindSections(sections: TailwindSection[]): TailwindSection[] {
  const withoutModelShop = sections.filter((s) => s.id !== "shop");
  const merged = appendDefaultShopSectionToSections(withoutModelShop, { replaceExisting: false });
  return merged.ok ? merged.sections : withoutModelShop;
}

/** Booking- en shop-secties in vaste volgorde (booking → shop → footer) — optioneel, bv. migratie. */
export function ensureCanonicalBookingAndShopSectionsInTailwindSections(
  sections: TailwindSection[],
): TailwindSection[] {
  return ensureCanonicalShopSectionInTailwindSections(ensureCanonicalBookingSectionInTailwindSections(sections));
}

/**
 * Na site-generatie: standaard **geen** booking/shop injecteren (strip model-output).
 * In **layout-upgrade**-modus blijft normalisatie naar de canonieke blokken (oude gedrag voor bestaande sites).
 */
export function finalizeBookingShopAfterAiGeneration(
  sections: TailwindSection[],
  options?: { preserveLayoutUpgrade?: boolean },
): TailwindSection[] {
  if (options?.preserveLayoutUpgrade) {
    return ensureCanonicalBookingAndShopSectionsInTailwindSections(sections);
  }
  return stripModelBookingAndShopSectionsFromTailwindSections(sections);
}

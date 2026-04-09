import { STUDIO_BOOKING_PATH_PLACEHOLDER } from "@/lib/site/studio-section-visibility";

/** Query `?preset=` op `/admin/ops/studio`. */
export const STUDIO_WORKFLOW_PRESET_ADD_BOOKING = "add-booking";

/**
 * Wordt onderaan de briefing geplakt bij preset “add-booking” (upgrade + lay-out behoud).
 * Het model moet het placeholdertoken letterlijk in href zetten.
 */
export const ADD_BOOKING_UPGRADE_INSTRUCTION = `=== STUDIO: uitbreiding online boeken (upgrade, lay-out behouden) ===
Behoud ALLE bestaande sectie-id's en de bestaande html van die secties ongewijzigd, behalve als je uitsluitend navigatie of footer uitbreidt met één extra link in dezelfde stijl.
- Voeg een sectie met id "booking" toe ALS die nog niet bestaat. Bestaat "booking" al: maak de CTA duidelijker en zorg dat de hoofdlink klopt.
- Primaire knop: bv. "Boek een afspraak" of "Plan online" — gebruik voor href **exact** dit token (geen #, geen andere URL): ${STUDIO_BOOKING_PATH_PLACEHOLDER}
- Voeg dezelfde boek-link op één logische plek toe in vaste navigatie en/of footer.
- Geen ingesloten agenda-widget, geen iframe-kalender, geen formulier dat naar een verzonnen endpoint post.`;

export function isAddBookingPreset(preset: string | null | undefined): boolean {
  return preset?.trim() === STUDIO_WORKFLOW_PRESET_ADD_BOOKING;
}

import type { TailwindSection } from "@/lib/ai/tailwind-sections-schema";
import { STUDIO_BOOKING_PATH_PLACEHOLDER } from "@/lib/site/studio-section-visibility";

/**
 * Publieke site: als afspraken-module uit staat, geen booking-sectie en geen werkende boek-placeholders.
 */
export function filterTailwindSectionsForAppointments(
  sections: TailwindSection[],
  appointmentsEnabled: boolean,
): TailwindSection[] {
  if (appointmentsEnabled) return sections;
  return sections
    .filter((s) => s.id !== "booking")
    .map((s) => ({
      ...s,
      html: s.html.split(STUDIO_BOOKING_PATH_PLACEHOLDER).join("#"),
    }));
}

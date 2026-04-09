import { createServiceRoleClient } from "@/lib/supabase/service-role";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type PublicBookingSlotDurationResult =
  | { ok: true; slotDurationMinutes?: number }
  | { ok: false; status: number; error: string };

/**
 * Bepaalt slotduur voor publieke booking-slots: verplicht `service` UUID zodra er actieve behandelingen zijn.
 */
export async function resolvePublicBookingSlotDurationMinutes(
  clientId: string,
  serviceQueryParam: string | null | undefined,
): Promise<PublicBookingSlotDurationResult> {
  const hasServices = await clientHasActiveBookingServices(clientId);
  const raw = serviceQueryParam?.trim() ?? "";

  if (!hasServices) {
    if (raw) {
      return { ok: false, status: 400, error: "Deze zaak gebruikt geen behandelingen in het boekformulier." };
    }
    return { ok: true };
  }

  if (!raw || !UUID_RE.test(raw)) {
    return {
      ok: false,
      status: 400,
      error: "Kies eerst een behandeling (parameter service ontbreekt of is ongeldig).",
    };
  }

  const svc = await resolveActiveBookingService(clientId, raw);
  if (!svc) {
    return { ok: false, status: 400, error: "Onbekende of inactieve behandeling." };
  }

  return { ok: true, slotDurationMinutes: svc.duration_minutes };
}

/** Minstens één actieve behandeling → verplicht kiezen bij /boek. */
export async function clientHasActiveBookingServices(clientId: string): Promise<boolean> {
  const supabase = createServiceRoleClient();
  const { count, error } = await supabase
    .from("client_booking_services")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId)
    .eq("is_active", true);

  if (error?.message?.includes("client_booking_services") || error?.code === "42P01") return false;
  return (count ?? 0) > 0;
}

export type ResolvedBookingService = {
  id: string;
  name: string;
  duration_minutes: number;
};

/** Actieve behandeling van deze klant, of null. */
export async function resolveActiveBookingService(
  clientId: string,
  serviceId: string,
): Promise<ResolvedBookingService | null> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("client_booking_services")
    .select("id, name, duration_minutes")
    .eq("client_id", clientId)
    .eq("id", serviceId)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !data) return null;
  return {
    id: data.id as string,
    name: String(data.name),
    duration_minutes: Number(data.duration_minutes),
  };
}

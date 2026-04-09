import type { BookingSettings } from "@/lib/booking/booking-settings";
import { parseBookingSettings } from "@/lib/booking/booking-settings";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { isPostgrestUnknownColumnError } from "@/lib/supabase/postgrest-unknown-column";

export async function loadBookingSettingsForClientId(clientId: string): Promise<BookingSettings> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.from("clients").select("booking_settings").eq("id", clientId).maybeSingle();

  if (error && isPostgrestUnknownColumnError(error, "booking_settings")) {
    return parseBookingSettings(null);
  }
  if (error || !data) return parseBookingSettings(null);
  return parseBookingSettings((data as { booking_settings?: unknown }).booking_settings);
}

import { getClientNotificationTarget } from "@/lib/data/get-client-notification-target";
import {
  trySendAppointmentCreatedEmail,
  trySendBookerAppointmentConfirmationEmail,
  type AppointmentEmailRow,
} from "@/lib/email/appointment-notifications";
import { trySendPortalAppointmentPushNotifications } from "@/lib/push/try-send-portal-appointment-push";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export type InsertClientAppointmentParams = {
  clientId: string;
  clientName: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
  notes: string | null;
  staffId?: string | null;
  bookingServiceId?: string | null;
  bookerName: string | null;
  bookerEmail: string | null;
  bookerWantsConfirmation: boolean;
  bookerWantsReminder: boolean;
};

const SELECT_ROW =
  "id, title, starts_at, ends_at, status, notes, staff_id, booking_service_id, created_at, updated_at, booker_name, booker_email, booker_wants_confirmation, booker_wants_reminder, reminder_sent_at";

export async function insertClientAppointment(
  params: InsertClientAppointmentParams,
): Promise<{ ok: true; appointment: Record<string, unknown> } | { ok: false; error: string }> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("client_appointments")
    .insert({
      client_id: params.clientId,
      title: params.title,
      starts_at: params.startsAt.toISOString(),
      ends_at: params.endsAt.toISOString(),
      notes: params.notes,
      staff_id: params.staffId?.trim() || null,
      booking_service_id: params.bookingServiceId?.trim() || null,
      status: "scheduled",
      booker_name: params.bookerName,
      booker_email: params.bookerEmail,
      booker_wants_confirmation: params.bookerWantsConfirmation,
      booker_wants_reminder: params.bookerWantsReminder,
    })
    .select(SELECT_ROW)
    .single();

  if (error) {
    return { ok: false, error: error.message };
  }

  const row = data as AppointmentEmailRow;
  const target = await getClientNotificationTarget(params.clientId);
  void trySendAppointmentCreatedEmail({
    to: target.email,
    clientName: params.clientName,
    appointment: row,
  });

  const bookerTo = params.bookerEmail?.trim();
  if (params.bookerWantsConfirmation && bookerTo) {
    void trySendBookerAppointmentConfirmationEmail({
      to: bookerTo,
      clientName: params.clientName,
      bookerName: params.bookerName,
      appointment: row,
    });
  }

  void trySendPortalAppointmentPushNotifications({
    clientId: params.clientId,
    appointmentTitle: row.title,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    bookerName: row.booker_name ?? null,
  });

  return { ok: true, appointment: data as Record<string, unknown> };
}

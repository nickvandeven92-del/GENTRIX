-- Publieke boekagenda: openingstijden + slotduur (JSON), geïnterpreteerd door /api/.../booking-slots.

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS booking_settings jsonb;

COMMENT ON COLUMN public.clients.booking_settings IS
  'JSON: timeZone, slotDurationMinutes, bufferMinutes, leadTimeMinutes, maxDaysAhead, week[{day(1=ma..7=zo), intervals[{start,end HH:mm}]}].';

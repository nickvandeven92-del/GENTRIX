-- Boeker (eindklant) + herinnering-tracking voor afspraken.

ALTER TABLE public.client_appointments
  ADD COLUMN IF NOT EXISTS booker_name text,
  ADD COLUMN IF NOT EXISTS booker_email text,
  ADD COLUMN IF NOT EXISTS booker_wants_confirmation boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS booker_wants_reminder boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;

COMMENT ON COLUMN public.client_appointments.booker_name IS
  'Optionele naam van degene die boekt (publieke boeking of portaal).';
COMMENT ON COLUMN public.client_appointments.booker_email IS
  'E-mail voor bevestiging/herinnering; verplicht als een van de wants_* vlaggen true is.';
COMMENT ON COLUMN public.client_appointments.booker_wants_confirmation IS
  'true = stuur (transactionele) bevestiging naar booker_email na aanmaken/wijzigen.';
COMMENT ON COLUMN public.client_appointments.booker_wants_reminder IS
  'true = stuur herinnering ca. 1 dag van tevoren (cron + reminder_sent_at).';
COMMENT ON COLUMN public.client_appointments.reminder_sent_at IS
  'Gezet wanneer dag-herinnering verstuurd is; gereset bij verzetten start/einde.';

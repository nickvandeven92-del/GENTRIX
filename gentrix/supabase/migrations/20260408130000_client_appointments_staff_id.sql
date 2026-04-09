-- Optionele koppeling afspraak ↔ medewerker (publiek boeken per persoon).

ALTER TABLE public.client_appointments
  ADD COLUMN IF NOT EXISTS staff_id uuid REFERENCES public.client_staff (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS client_appointments_client_staff_starts_idx
  ON public.client_appointments (client_id, staff_id, starts_at ASC)
  WHERE status = 'scheduled' AND staff_id IS NOT NULL;

COMMENT ON COLUMN public.client_appointments.staff_id IS
  'Optioneel: geboekte medewerker. NULL = legacy / pool zonder persoonskeuze.';

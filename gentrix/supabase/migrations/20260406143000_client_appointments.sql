-- Klantportaal: optioneel afspraken-module per client + afsprakenregels.

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS appointments_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.clients.appointments_enabled IS
  'true = route /portal/{slug}/afspraken en API tonen; false = alleen overzicht (mock/HTML).';

CREATE TABLE IF NOT EXISTS public.client_appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients (id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Afspraak',
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'scheduled',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT client_appointments_status_check CHECK (status IN ('scheduled', 'cancelled')),
  CONSTRAINT client_appointments_time_order CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS client_appointments_client_starts_idx
  ON public.client_appointments (client_id, starts_at DESC);

COMMENT ON TABLE public.client_appointments IS
  'Afspraken voor klanten met appointments_enabled; portaal-UI + .ics-download.';

DROP TRIGGER IF EXISTS client_appointments_set_updated_at ON public.client_appointments;
CREATE TRIGGER client_appointments_set_updated_at
  BEFORE UPDATE ON public.client_appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_clients_updated_at();

ALTER TABLE public.client_appointments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "client_appointments_select_authenticated" ON public.client_appointments;
DROP POLICY IF EXISTS "client_appointments_insert_authenticated" ON public.client_appointments;
DROP POLICY IF EXISTS "client_appointments_update_authenticated" ON public.client_appointments;
DROP POLICY IF EXISTS "client_appointments_delete_authenticated" ON public.client_appointments;

CREATE POLICY "client_appointments_select_authenticated"
  ON public.client_appointments FOR SELECT TO authenticated USING (true);
CREATE POLICY "client_appointments_insert_authenticated"
  ON public.client_appointments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "client_appointments_update_authenticated"
  ON public.client_appointments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "client_appointments_delete_authenticated"
  ON public.client_appointments FOR DELETE TO authenticated USING (true);

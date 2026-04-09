-- Behandelingen / diensten voor online boeken (naam, duur, prijs, actief).

CREATE TABLE IF NOT EXISTS public.client_booking_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients (id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  duration_minutes int NOT NULL,
  price_cents int,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT client_booking_services_duration_check CHECK (duration_minutes >= 10 AND duration_minutes <= 480),
  CONSTRAINT client_booking_services_price_check CHECK (price_cents IS NULL OR price_cents >= 0)
);

CREATE INDEX IF NOT EXISTS client_booking_services_client_sort_idx
  ON public.client_booking_services (client_id, sort_order ASC, id ASC);

COMMENT ON TABLE public.client_booking_services IS
  'Behandelingen voor /boek: duur bepaalt slotlengte; alleen actieve tonen publiek.';

DROP TRIGGER IF EXISTS client_booking_services_set_updated_at ON public.client_booking_services;
CREATE TRIGGER client_booking_services_set_updated_at
  BEFORE UPDATE ON public.client_booking_services
  FOR EACH ROW
  EXECUTE FUNCTION public.set_clients_updated_at();

ALTER TABLE public.client_appointments
  ADD COLUMN IF NOT EXISTS booking_service_id uuid REFERENCES public.client_booking_services (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS client_appointments_booking_service_idx
  ON public.client_appointments (client_id, booking_service_id)
  WHERE booking_service_id IS NOT NULL;

COMMENT ON COLUMN public.client_appointments.booking_service_id IS
  'Optioneel: gekozen behandeling bij online boeken.';

ALTER TABLE public.client_booking_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "client_booking_services_select_authenticated"
  ON public.client_booking_services FOR SELECT TO authenticated USING (true);
CREATE POLICY "client_booking_services_insert_authenticated"
  ON public.client_booking_services FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "client_booking_services_update_authenticated"
  ON public.client_booking_services FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "client_booking_services_delete_authenticated"
  ON public.client_booking_services FOR DELETE TO authenticated USING (true);

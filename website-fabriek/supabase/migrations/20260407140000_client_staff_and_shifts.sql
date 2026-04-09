-- Medewerkers + geplande diensten (intern rooster; los van client_appointments / publiek boeken).

CREATE TABLE IF NOT EXISTS public.client_staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients (id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  color_hex text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT client_staff_color_hex_check CHECK (
    color_hex IS NULL OR color_hex ~ '^#[0-9A-Fa-f]{6}$'
  )
);

CREATE INDEX IF NOT EXISTS client_staff_client_sort_idx
  ON public.client_staff (client_id, sort_order ASC, id ASC);

COMMENT ON TABLE public.client_staff IS
  'Medewerkers per klant; gebruikt in portaal weekplanning (drag-and-drop).';

CREATE TABLE IF NOT EXISTS public.client_staff_shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients (id) ON DELETE CASCADE,
  staff_id uuid NOT NULL REFERENCES public.client_staff (id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT client_staff_shifts_time_order CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS client_staff_shifts_client_starts_idx
  ON public.client_staff_shifts (client_id, starts_at ASC);

DROP TRIGGER IF EXISTS client_staff_shifts_set_updated_at ON public.client_staff_shifts;
CREATE TRIGGER client_staff_shifts_set_updated_at
  BEFORE UPDATE ON public.client_staff_shifts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_clients_updated_at();

ALTER TABLE public.client_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_staff_shifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "client_staff_select_authenticated"
  ON public.client_staff FOR SELECT TO authenticated USING (true);
CREATE POLICY "client_staff_insert_authenticated"
  ON public.client_staff FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "client_staff_update_authenticated"
  ON public.client_staff FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "client_staff_delete_authenticated"
  ON public.client_staff FOR DELETE TO authenticated USING (true);

CREATE POLICY "client_staff_shifts_select_authenticated"
  ON public.client_staff_shifts FOR SELECT TO authenticated USING (true);
CREATE POLICY "client_staff_shifts_insert_authenticated"
  ON public.client_staff_shifts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "client_staff_shifts_update_authenticated"
  ON public.client_staff_shifts FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "client_staff_shifts_delete_authenticated"
  ON public.client_staff_shifts FOR DELETE TO authenticated USING (true);

-- Aanvragen via /site/{slug}/bestellen (concept of live); alleen server-side insert (service role).
CREATE TABLE IF NOT EXISTS public.studio_site_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  client_subfolder_slug text NOT NULL,
  is_concept_preview boolean NOT NULL DEFAULT false,
  customer_email text NOT NULL,
  payload_json jsonb NOT NULL
);

CREATE INDEX IF NOT EXISTS studio_site_orders_client_created_idx
  ON public.studio_site_orders (client_subfolder_slug, created_at DESC);

COMMENT ON TABLE public.studio_site_orders IS 'Publieke website-bestel-/betaalformulier (IBAN, adres); notificatie naar studio via Resend.';

ALTER TABLE public.studio_site_orders ENABLE ROW LEVEL SECURITY;

-- Tracking: elke hit op /p/{flyer_public_token} (QR) wordt gelogd voor studio-feedback.
CREATE TABLE IF NOT EXISTS public.flyer_scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients (id) ON DELETE CASCADE,
  scanned_at timestamptz NOT NULL DEFAULT now(),
  user_agent text,
  referer text
);

CREATE INDEX IF NOT EXISTS flyer_scans_client_id_scanned_at_idx
  ON public.flyer_scans (client_id, scanned_at DESC);

COMMENT ON TABLE public.flyer_scans IS 'Flyer/QR opens: server-side insert bij GET /p/{token}.';

ALTER TABLE public.flyer_scans ENABLE ROW LEVEL SECURITY;

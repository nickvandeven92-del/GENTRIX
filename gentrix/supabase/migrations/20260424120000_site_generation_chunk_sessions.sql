-- Sessies voor sectie-gewijze site-generatie (chunked merge-flow); serverless-vriendelijk: elke stap = eigen request.

CREATE TABLE IF NOT EXISTS public.site_generation_chunk_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  payload jsonb NOT NULL,
  CONSTRAINT site_generation_chunk_sessions_payload_is_object CHECK (jsonb_typeof(payload) = 'object')
);

CREATE INDEX IF NOT EXISTS site_generation_chunk_sessions_expires_at_idx
  ON public.site_generation_chunk_sessions (expires_at);

COMMENT ON TABLE public.site_generation_chunk_sessions IS
  'Tussenstatus voor chunked studio-generatie (prepare + secties + merge). Rijen na expires_at mogen periodiek worden opgeruimd.';

ALTER TABLE public.site_generation_chunk_sessions ENABLE ROW LEVEL SECURITY;

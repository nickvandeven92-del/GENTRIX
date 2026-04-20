-- Async site-generatie (jobs + polling i.p.v. lange NDJSON-stream naar de browser).

CREATE TABLE IF NOT EXISTS public.site_generation_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.clients (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'queued',
  request_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  progress_message text,
  result_json jsonb,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  CONSTRAINT site_generation_jobs_status_check CHECK (
    status IN ('queued', 'running', 'succeeded', 'failed')
  )
);

CREATE INDEX IF NOT EXISTS site_generation_jobs_client_id_created_at_idx
  ON public.site_generation_jobs (client_id, created_at DESC);

CREATE INDEX IF NOT EXISTS site_generation_jobs_status_created_at_idx
  ON public.site_generation_jobs (status, created_at DESC);

COMMENT ON TABLE public.site_generation_jobs IS 'Async site-generatie; UI pollt tot succeeded/failed.';

ALTER TABLE public.site_generation_jobs ENABLE ROW LEVEL SECURITY;

-- Canonieke site-snapshots + generatie-runs; clients wijzen naar draft/published.

CREATE TABLE IF NOT EXISTS public.site_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'unknown',
  payload_json jsonb NOT NULL,
  parent_snapshot_id uuid REFERENCES public.site_snapshots (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS site_snapshots_client_id_created_at_idx
  ON public.site_snapshots (client_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.site_generation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  operation text NOT NULL,
  prompt_excerpt text,
  interpretation_json jsonb,
  model text,
  input_snapshot_id uuid REFERENCES public.site_snapshots (id) ON DELETE SET NULL,
  output_snapshot_id uuid REFERENCES public.site_snapshots (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS site_generation_runs_client_id_created_at_idx
  ON public.site_generation_runs (client_id, created_at DESC);

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS draft_snapshot_id uuid REFERENCES public.site_snapshots (id) ON DELETE SET NULL;

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS published_snapshot_id uuid REFERENCES public.site_snapshots (id) ON DELETE SET NULL;

-- Eén migratie-snapshot per bestaande klant (alleen als nog geen snapshots).
INSERT INTO public.site_snapshots (client_id, source, payload_json)
SELECT c.id, 'migration', c.site_data_json::jsonb
FROM public.clients c
WHERE NOT EXISTS (SELECT 1 FROM public.site_snapshots s WHERE s.client_id = c.id);

UPDATE public.clients c
SET
  draft_snapshot_id = COALESCE(c.draft_snapshot_id, sub.id),
  published_snapshot_id = COALESCE(c.published_snapshot_id, sub.id)
FROM (
  SELECT DISTINCT ON (client_id) id, client_id
  FROM public.site_snapshots
  WHERE source = 'migration'
  ORDER BY client_id, created_at ASC
) sub
WHERE c.id = sub.client_id
  AND (c.draft_snapshot_id IS NULL OR c.published_snapshot_id IS NULL);

ALTER TABLE public.site_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_generation_runs ENABLE ROW LEVEL SECURITY;

-- Geen policies: alleen service role (server) — zelfde patroon als gevoelige admin-data.

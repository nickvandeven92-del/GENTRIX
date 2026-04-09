-- Fase 3–5: snapshot-metadata, expliciete publish-flow (app), generatie-kwaliteit.

-- Fase 4: tooling-velden op snapshots
ALTER TABLE public.site_snapshots
  ADD COLUMN IF NOT EXISTS label text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS created_by text NOT NULL DEFAULT 'user';

COMMENT ON COLUMN public.site_snapshots.created_by IS 'user | ai | generator | migration | system';

UPDATE public.site_snapshots
SET created_by = CASE source
  WHEN 'editor' THEN 'user'
  WHEN 'ai_command' THEN 'ai'
  WHEN 'generator' THEN 'generator'
  WHEN 'migration' THEN 'migration'
  ELSE 'system'
END
WHERE source IS NOT NULL;

-- Fase 5: kwaliteit / observability op generation runs
ALTER TABLE public.site_generation_runs
  ADD COLUMN IF NOT EXISTS prompt_hash text,
  ADD COLUMN IF NOT EXISTS preset_ids jsonb,
  ADD COLUMN IF NOT EXISTS layout_archetypes jsonb,
  ADD COLUMN IF NOT EXISTS command_chain jsonb,
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS outcome text;

COMMENT ON COLUMN public.site_generation_runs.status IS 'success | failure | partial';
COMMENT ON COLUMN public.site_generation_runs.outcome IS 'kept | published | abandoned | unknown';

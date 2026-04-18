-- Gefaseerde site-job: checkpoint na compositie + tweede invocatie voor hoofdstream (Vercel wall-clock reset).

ALTER TABLE public.site_generation_jobs
  ADD COLUMN IF NOT EXISTS generation_checkpoint jsonb,
  ADD COLUMN IF NOT EXISTS generation_split_phase text NOT NULL DEFAULT 'single';

COMMENT ON COLUMN public.site_generation_jobs.generation_checkpoint IS
  'JSON-checkpoint vóór hoofd-HTML-stream (SITE_GENERATION_PHASED_JOB=1).';

COMMENT ON COLUMN public.site_generation_jobs.generation_split_phase IS
  'single = één run; awaiting_continue = checkpoint klaar, wacht POST …/continue; running_continue = fase 2 bezig.';

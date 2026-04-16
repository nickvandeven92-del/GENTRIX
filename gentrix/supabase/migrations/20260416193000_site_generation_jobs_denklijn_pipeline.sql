-- Server-job: denklijn + pipeline-feedback beschikbaar voor polling (i.p.v. alleen NDJSON-stream).

ALTER TABLE public.site_generation_jobs
  ADD COLUMN IF NOT EXISTS pipeline_feedback_json jsonb,
  ADD COLUMN IF NOT EXISTS denklijn_text text,
  ADD COLUMN IF NOT EXISTS denklijn_skip_reason text,
  ADD COLUMN IF NOT EXISTS design_contract_json jsonb,
  ADD COLUMN IF NOT EXISTS design_contract_warning text;

COMMENT ON COLUMN public.site_generation_jobs.pipeline_feedback_json IS 'generation_meta.feedback (JSON) voor studio Details.';
COMMENT ON COLUMN public.site_generation_jobs.denklijn_text IS 'design_rationale-tekst (server-job + poll).';
COMMENT ON COLUMN public.site_generation_jobs.denklijn_skip_reason IS 'Optioneel: waarom denklijn ontbrak.';
COMMENT ON COLUMN public.site_generation_jobs.design_contract_json IS 'DesignGenerationContract (JSON) na denklijn.';
COMMENT ON COLUMN public.site_generation_jobs.design_contract_warning IS 'Contractparse-waarschuwing, indien van toepassing.';

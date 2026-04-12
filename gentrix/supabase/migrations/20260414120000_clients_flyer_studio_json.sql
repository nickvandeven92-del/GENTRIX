-- Optionele teksten/sjablonen voor A4-flyer (PDF); los van site-snapshot zodat studio-opslag niets wist.
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS flyer_studio_json jsonb;

COMMENT ON COLUMN public.clients.flyer_studio_json IS
  'Flyerstudio: actieve copy + opgeslagen presets voor PDF (badge, kop, body, template-id).';

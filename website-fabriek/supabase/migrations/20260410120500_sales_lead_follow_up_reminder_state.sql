-- Idempotente state voor automatische follow-up herinneringen in sales_leads.notes
ALTER TABLE public.sales_leads
  ADD COLUMN IF NOT EXISTS follow_up_reminder_state jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.sales_leads.follow_up_reminder_state IS
  'JSON: { "at": ISO next_follow_up_at anchor, "fired": ["d3","d1","d0"] }. Reset bij nieuwe follow-up-datum.';

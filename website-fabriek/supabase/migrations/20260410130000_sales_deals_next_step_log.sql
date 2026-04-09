-- Sales OS: historie van vastgelegde volgende stappen (deal-detail).

ALTER TABLE public.sales_deals
  ADD COLUMN IF NOT EXISTS next_step_log jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.sales_deals.next_step_log IS
  'Chronologische log: { message, due_at, logged_at }[] — na vastleggen worden next_step en next_step_due_at geleegd tot de volgende planning.';

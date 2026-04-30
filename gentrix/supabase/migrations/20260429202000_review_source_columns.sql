alter table public.clients
  add column if not exists review_source_settings jsonb not null default '{}'::jsonb,
  add column if not exists review_source_items jsonb not null default '[]'::jsonb;

-- Usage per Claude API-call (logging vanuit de app) voor kostenoverzicht in het admin-portaal.
create table if not exists public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  operation text not null
    check (operation in ('generate_site', 'edit_site', 'site_chat')),
  model text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cache_creation_input_tokens integer,
  cache_read_input_tokens integer
);

create index if not exists ai_usage_events_created_at_idx
  on public.ai_usage_events (created_at desc);

comment on table public.ai_usage_events is 'Token usage per Messages API-call; gebruikt voor geschatte kosten in /admin/portal.';

alter table public.ai_usage_events enable row level security;

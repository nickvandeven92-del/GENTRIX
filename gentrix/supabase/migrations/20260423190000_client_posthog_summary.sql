-- Samenvatting productgedrag per klant (dagelijkse sync via cron); leesbaar in admin-klantdossier.
create table if not exists public.client_posthog_summary (
  client_id uuid primary key references public.clients (id) on delete cascade,
  subfolder_slug text not null,
  lookback_days integer not null default 7
    check (lookback_days > 0 and lookback_days <= 90),
  pageviews integer not null default 0
    check (pageviews >= 0),
  sessions_started integer not null default 0
    check (sessions_started >= 0),
  scroll_milestones integer not null default 0
    check (scroll_milestones >= 0),
  last_event_at timestamptz,
  signals jsonb not null default '[]'::jsonb,
  recent_events jsonb not null default '[]'::jsonb,
  fetch_error text,
  fetched_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists client_posthog_summary_subfolder_slug_key
  on public.client_posthog_summary (subfolder_slug);

create index if not exists client_posthog_summary_fetched_at_idx
  on public.client_posthog_summary (fetched_at desc);

comment on table public.client_posthog_summary is
  'Samenvatting productgedrag per klant; gevuld door geplande sync (service role).';

alter table public.client_posthog_summary enable row level security;

create policy "client_posthog_summary_select_authenticated"
  on public.client_posthog_summary
  for select
  to authenticated
  using (true);

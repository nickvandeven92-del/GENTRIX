-- Eerstepartij site-analytics (Gentrix Studio) — gescheiden van `public.analytics_events` (Chameleon webshop).
create table if not exists public.site_analytics_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  client_id uuid not null references public.clients (id) on delete cascade,
  site_slug text not null,
  event_type text not null,
  visitor_id text not null,
  session_id text not null,
  page_path text,
  page_key text,
  properties jsonb not null default '{}'::jsonb,
  user_agent text,
  device_class text not null default 'unknown',
  referrer text
);

create index if not exists site_analytics_events_client_created_idx
  on public.site_analytics_events (client_id, created_at desc);

create index if not exists site_analytics_events_event_type_idx
  on public.site_analytics_events (event_type, created_at desc);

create index if not exists site_analytics_events_site_slug_idx
  on public.site_analytics_events (site_slug, created_at desc);

create index if not exists site_analytics_events_created_idx
  on public.site_analytics_events (created_at desc);

comment on table public.site_analytics_events is
  'Eerstepartij bezoekdata van /site (ingest via Next API + service role). Niet: Chameleon `analytics_events`.';

alter table public.site_analytics_events enable row level security;

-- Publiek: geen directe toegang (ingest via server-route + service role).
-- Studio / CRM: lezen voor ingelogde app-gebruikers (select voor authenticated).
create policy "site_analytics_events_select_authenticated"
  on public.site_analytics_events
  for select
  to authenticated
  using (true);

-- Geen insert/update/delete voor authenticated — alleen service role (API) schrijft.

-- Aggregaties in één roundtrip; security invoker = RLS van de oproeper (zoals tabel zelf).
create or replace function public.site_analytics_dashboard(p_since timestamptz)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'page_views', coalesce((
      select count(*)::int
      from public.site_analytics_events
      where created_at >= p_since
        and event_type = 'page_view'
    ), 0),
    'clicks_by_key', coalesce((
      select jsonb_object_agg(k, c)
      from (
        select
          coalesce(
            nullif(btrim(e.properties->>'analytics_key'), ''),
            '(geen data-analytics)'
          ) as k,
          count(*)::int as c
        from public.site_analytics_events e
        where e.created_at >= p_since
          and e.event_type = 'click_event'
        group by 1
      ) s
    ), '{}'::jsonb),
    'conversions', coalesce((
      select count(*)::int
      from public.site_analytics_events
      where created_at >= p_since
        and event_type = 'conversion_event'
    ), 0),
    'conversions_by_name', coalesce((
      select jsonb_object_agg(n, c)
      from (
        select
          coalesce(
            nullif(btrim(e.properties->>'conversion_name'), ''),
            '(onbenoemd)'
          ) as n,
          count(*)::int as c
        from public.site_analytics_events e
        where e.created_at >= p_since
          and e.event_type = 'conversion_event'
        group by 1
      ) u
    ), '{}'::jsonb),
    'scroll_by_depth', coalesce((
      select jsonb_object_agg(d, c)
      from (
        select
          coalesce(
            nullif(btrim(e.properties->>'depth_pct'), ''),
            '(? )'
          ) as d,
          count(*)::int as c
        from public.site_analytics_events e
        where e.created_at >= p_since
          and e.event_type = 'scroll_depth'
        group by 1
      ) x
    ), '{}'::jsonb),
    'engagement', coalesce((
      select jsonb_object_agg(sec::text, c)
      from (
        select
          (e.properties->>'engagement_sec')::int as sec,
          count(*)::int as c
        from public.site_analytics_events e
        where e.created_at >= p_since
          and e.event_type = 'engagement_ping'
          and e.properties->>'engagement_sec' is not null
        group by 1
      ) p
      where sec is not null
    ), '{}'::jsonb),
    'top_pages', coalesce((
      select jsonb_agg(jsonb_build_object('path', p, 'count', c) order by c desc)
      from (
        select page_path as p, count(*)::int as c
        from public.site_analytics_events
        where created_at >= p_since
          and event_type = 'page_view'
          and coalesce(btrim(page_path), '') <> ''
        group by page_path
        order by c desc
        limit 25
      ) t
    ), '[]'::jsonb),
    'device_mix', coalesce((
      select jsonb_object_agg(device_class, c)
      from (
        select device_class, count(*)::int as c
        from public.site_analytics_events
        where created_at >= p_since
          and event_type = 'page_view'
        group by device_class
      ) d
    ), '{}'::jsonb)
  );
$$;

comment on function public.site_analytics_dashboard(timestamptz) is
  'Samenvatting first-party /site analytics voor CRM (ingelogde app-gebruiker).';

grant execute on function public.site_analytics_dashboard(timestamptz) to authenticated;
revoke all on function public.site_analytics_dashboard(timestamptz) from public;

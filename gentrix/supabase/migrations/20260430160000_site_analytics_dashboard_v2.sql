-- v2: bruikbare aggregaties voor /admin/ops/analytics
create index if not exists site_analytics_events_session_time_idx
  on public.site_analytics_events (session_id, created_at);

create or replace function public.site_analytics_dashboard_v2(p_since timestamptz)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with
  e as (select * from public.site_analytics_events where created_at >= p_since),
  summary as (
    select
      (select count(*)::int from e where event_type = 'page_view') as page_views,
      (select count(*)::int from e where event_type = 'click_event') as clicks,
      (select count(*)::int from e where event_type = 'conversion_event') as conversions,
      (select count(distinct visitor_id)::int from e where event_type = 'page_view') as unique_visitors
  ),
  page_pv as (
    select
      coalesce(nullif(btrim(page_path), ''), '(geen pad)') as page_path,
      coalesce(nullif(btrim(page_key), ''), '(geen key)') as page_key,
      count(*)::int as page_views,
      count(distinct visitor_id)::int as unique_visitors
    from e where event_type = 'page_view' group by 1, 2
  ),
  page_clk as (
    select
      coalesce(nullif(btrim(page_path), ''), '(geen pad)') as page_path,
      coalesce(nullif(btrim(page_key), ''), '(geen key)') as page_key, count(*)::int as clicks
    from e where event_type = 'click_event' group by 1, 2
  ),
  page_conv as (
    select
      coalesce(nullif(btrim(page_path), ''), '(geen pad)') as page_path,
      coalesce(nullif(btrim(page_key), ''), '(geen key)') as page_key, count(*)::int as convs
    from e where event_type = 'conversion_event' group by 1, 2
  ),
  page_eng as (
    select
      coalesce(nullif(btrim(page_path), ''), '(geen pad)') as page_path,
      coalesce(nullif(btrim(page_key), ''), '(geen key)') as page_key, session_id,
      max((properties->>'engagement_sec')::int) as mx
    from e
    where event_type = 'engagement_ping' and (properties->>'engagement_sec') is not null
    group by 1, 2, 3
  ),
  page_eng_avg as (select page_path, page_key, round(avg(mx)::numeric, 1) as avg_eng from page_eng group by 1, 2),
  page_scroll as (
    select
      coalesce(nullif(btrim(page_path), ''), '(geen pad)') as page_path,
      coalesce(nullif(btrim(page_key), ''), '(geen key)') as page_key,
      btrim((properties->>'depth_pct')::text) as dp, count(*)::int as c
    from e
    where event_type = 'scroll_depth' and (properties->>'depth_pct') is not null
    group by 1, 2, 3
  ),
  page_scroll_pivot as (
    select
      page_path, page_key,
      coalesce(sum(c) filter (where dp in ('25', '25.0')), 0)::int as s25,
      coalesce(sum(c) filter (where dp in ('50', '50.0')), 0)::int as s50,
      coalesce(sum(c) filter (where dp in ('75', '75.0')), 0)::int as s75,
      coalesce(sum(c) filter (where dp in ('100', '100.0')), 0)::int as s100
    from page_scroll
    group by 1, 2
  ),
  page_dev_pivot as (
    select
      coalesce(nullif(btrim(page_path), ''), '(geen pad)') as page_path,
      coalesce(nullif(btrim(page_key), ''), '(geen key)') as page_key,
      sum(case when device_class = 'mobile' then 1 else 0 end)::int as page_views_mobile,
      sum(case when coalesce(device_class, '') <> 'mobile' then 1 else 0 end)::int as page_views_non_mobile
    from e
    where event_type = 'page_view'
    group by 1, 2
  ),
  page_rows as (
    select
      p.page_path, p.page_key, p.page_views, p.unique_visitors,
      coalesce(c.clicks, 0) as clicks, coalesce(v.convs, 0) as conversions,
      case when p.page_views > 0
        then round((100.0 * coalesce(c.clicks, 0) / p.page_views)::numeric, 2) else 0::numeric end as click_through_rate_pct,
      case when p.page_views > 0
        then round((100.0 * coalesce(v.convs, 0) / p.page_views)::numeric, 2) else 0::numeric end as conversion_rate_pct,
      coalesce(ea.avg_eng, 0) as avg_engagement_seconds,
      coalesce(sp.s25, 0) as scroll_25, coalesce(sp.s50, 0) as scroll_50, coalesce(sp.s75, 0) as scroll_75, coalesce(sp.s100, 0) as scroll_100,
      case when p.unique_visitors > 0
        then round(100.0 * coalesce(sp.s25, 0)::numeric / p.unique_visitors, 1) else 0::numeric end as reach_25_pct,
      case when coalesce(sp.s25, 0) > 0
        then round(100.0 * coalesce(sp.s50, 0)::numeric / sp.s25, 1) else 0::numeric end as of_25_reach_50_pct,
      case when coalesce(sp.s50, 0) > 0
        then round(100.0 * coalesce(sp.s75, 0)::numeric / sp.s50, 1) else 0::numeric end as of_50_reach_75_pct,
      case when coalesce(sp.s75, 0) > 0
        then round(100.0 * coalesce(sp.s100, 0)::numeric / sp.s75, 1) else 0::numeric end as of_75_reach_100_pct,
      coalesce(dp.page_views_mobile, 0) as page_views_mobile, coalesce(dp.page_views_non_mobile, 0) as page_views_non_mobile
    from page_pv p
    left join page_clk c on c.page_path = p.page_path and c.page_key = p.page_key
    left join page_conv v on v.page_path = p.page_path and v.page_key = p.page_key
    left join page_eng_avg ea on ea.page_path = p.page_path and ea.page_key = p.page_key
    left join page_scroll_pivot sp on sp.page_path = p.page_path and sp.page_key = p.page_key
    left join page_dev_pivot dp on dp.page_path = p.page_path and dp.page_key = p.page_key
  ),
  page_sorted as (select * from page_rows order by page_views desc limit 100),
  cta_aid as (
    select
      e2.*,
      coalesce(
        nullif(btrim(e2.properties->>'analytics_id'), ''),
        nullif(btrim(e2.properties->>'analytics_key'), '')
      ) as ex_aid
    from e e2
    where e2.event_type = 'click_event'
  ),
  cta_agg as (
    select
      coalesce(ck.ex_aid, '(geen id)') as analytics_id,
      coalesce(nullif(btrim(ck.properties->>'label'), ''), nullif(btrim(ck.properties->>'link_text'), ''), '') as label,
      coalesce(nullif(btrim(ck.properties->>'element_role'), ''), 'other') as element_role,
      coalesce(nullif(btrim(ck.properties->>'section_id'), ''), '') as section_id,
      coalesce(nullif(btrim(ck.page_path), ''), '(geen pad)') as page_path,
      count(*)::int as clicks,
      count(distinct ck.visitor_id)::int as unique_clickers
    from cta_aid ck
    group by 1, 2, 3, 4, 5
  ),
  cta_clk_total as (select coalesce(nullif(sum(c.clicks), 0), 1) as t from cta_agg cta0),
  first_clicks as (
    select
      coalesce(ck2.ex_aid, '(geen id)') as aid, ck2.session_id, min(ck2.created_at) as t1
    from cta_aid ck2
    group by 1, 2
  ),
  cta_post as (
    select
      f.aid, count(distinct f.session_id)::int as downstream_conversions
    from first_clicks f
    where exists (
      select 1 from e ev
      where ev.session_id = f.session_id
        and ev.event_type = 'conversion_event'
        and ev.created_at > f.t1
    )
    group by 1
  ),
  cta_merged as (
    select
      c.*, coalesce(p.downstream_conversions, 0) as downstream_conversions,
      (select t from cta_clk_total) as click_total
    from cta_agg c
    left join cta_post p on p.aid = c.analytics_id
  ),
  cta_sorted as (
    select
      cm.analytics_id, cm.label, cm.element_role, cm.section_id, cm.page_path, cm.clicks, cm.unique_clickers,
      case when cm.click_total > 0
        then round(100.0 * cm.clicks::numeric / cm.click_total, 2) else 0::numeric end as click_share,
      cm.downstream_conversions,
      case when cm.unique_clickers > 0
        then round(100.0 * cm.downstream_conversions::numeric / cm.unique_clickers, 2) else 0::numeric end
        as conversion_after_click_rate
    from cta_merged cm
    order by cm.clicks desc
    limit 150
  ),
  pv_s as (select count(distinct session_id)::int as n from e where event_type = 'page_view'),
  en_s as (
    select count(distinct e1.session_id)::int as n
    from e e1
    where (
        (e1.event_type = 'engagement_ping' and (e1.properties->>'engagement_sec')::int >= 10)
        or (e1.event_type = 'scroll_depth' and (e1.properties->>'depth_pct')::int >= 50)
      )
      and exists (
        select 1 from e p where p.session_id = e1.session_id and p.event_type = 'page_view'
      )
  ),
  clk_s as (select count(distinct session_id)::int as n from e where event_type = 'click_event'),
  ch_st as (
    select count(distinct session_id)::int as n from e
    where event_type = 'conversion_event' and btrim(coalesce(properties->>'conversion_name', '')) = 'checkout_started'
  ),
  ch_done as (
    select count(distinct session_id)::int as n from e
    where event_type = 'conversion_event' and btrim(coalesce(properties->>'conversion_name', '')) in ('checkout_completed', 'order_completed', 'aankoop_voltooid', 'aankoop-confirmed', 'aankoop_bevestigd', 'aankoop_bevestigd')
  ),
  sc_g as (
    select btrim((properties->>'depth_pct')::text) as dp, count(*)::int as c
    from e where event_type = 'scroll_depth' and (properties->>'depth_pct') is not null
    group by 1
  ),
  d_g as (select device_class, count(*)::int as c from e where event_type = 'page_view' group by 1),
  cv_n as (
    select btrim(coalesce(properties->>'conversion_name', '(onbenoemd)')) as nm, count(*)::int as c
    from e where event_type = 'conversion_event' group by 1 order by c desc limit 50
  )
  select jsonb_build_object(
    'summary', (select to_jsonb(s) from summary s),
    'page_performance', coalesce((select jsonb_agg(to_jsonb(ps) order by ps.page_views desc) from page_sorted ps), '[]'::jsonb),
    'cta_performance', coalesce((select jsonb_agg(to_jsonb(cs) order by cs.clicks desc) from cta_sorted cs), '[]'::jsonb),
    'funnel', jsonb_build_object(
      'page_view_sessions', (select n from pv_s),
      'engaged_sessions', (select n from en_s),
      'cta_click_sessions', (select n from clk_s),
      'checkout_started_sessions', (select n from ch_st),
      'checkout_completed_sessions', (select n from ch_done),
      'pct_engaged_of_pageview', (
        select case when (select n from pv_s) > 0
          then round(100.0 * (select n from en_s)::numeric / (select n from pv_s), 1) else 0::numeric end
      ),
      'pct_cta_of_pageview', (
        select case when (select n from pv_s) > 0
          then round(100.0 * (select n from clk_s)::numeric / (select n from pv_s), 1) else 0::numeric end
      )
    ),
    'scroll_by_depth_global', (select coalesce(jsonb_object_agg(sc_g.dp, sc_g.c), '{}'::jsonb) from sc_g),
    'scroll_by_page', coalesce(
      (select jsonb_agg(to_jsonb(pgp) order by pgp.s25 desc) from (select * from page_scroll_pivot order by s25 desc nulls last limit 50) pgp), '[]'::jsonb
    ),
    'device_breakdown', (select coalesce(jsonb_object_agg(d_g.device_class, d_g.c), '{}'::jsonb) from d_g),
    'conversion_names', (select coalesce(jsonb_object_agg(cv_n.nm, cv_n.c), '{}'::jsonb) from cv_n)
  );
$$;

comment on function public.site_analytics_dashboard_v2(timestamptz) is
  'Eerstepartij: pagina/CTA/funnel/scroll (v2)';

grant execute on function public.site_analytics_dashboard_v2(timestamptz) to authenticated;
revoke all on function public.site_analytics_dashboard_v2(timestamptz) from public;

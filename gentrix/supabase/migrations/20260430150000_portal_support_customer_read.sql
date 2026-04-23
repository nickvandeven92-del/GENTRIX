-- Portaal: gelezen-markering voor support + efficiënte unread-telling per thread.

alter table public.client_support_threads
  add column if not exists customer_last_read_at timestamptz not null default now();

comment on column public.client_support_threads.customer_last_read_at is
  'Laatste moment waarop de klant het gesprek in het portaal heeft geopend; studio-berichten daarna tellen als ongelezen.';

create or replace function public.portal_support_unread_staff_by_thread(p_client_id uuid)
returns table (thread_id uuid, unread_count bigint)
language sql
stable
as $$
  select
    m.thread_id,
    count(*)::bigint as unread_count
  from public.client_support_messages m
  inner join public.client_support_threads t
    on t.id = m.thread_id
    and t.client_id = p_client_id
  where m.author_kind = 'staff'
    and m.created_at > t.customer_last_read_at
  group by m.thread_id;
$$;

comment on function public.portal_support_unread_staff_by_thread(uuid) is
  'Aantal ongelezen studio-berichten per support-thread (voor portaal-badge en lijst).';

grant execute on function public.portal_support_unread_staff_by_thread(uuid) to service_role;
grant execute on function public.portal_support_unread_staff_by_thread(uuid) to authenticated;

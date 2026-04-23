-- Support-chat: threads per klant + berichten (klant vs studio met weergavenaam).

create type public.client_support_thread_status as enum ('open', 'closed');

create table public.client_support_threads (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  status public.client_support_thread_status not null default 'open',
  subject text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz,
  closed_by_staff_user_id uuid,
  constraint client_support_threads_subject_len check (char_length(trim(subject)) between 1 and 200)
);

create index client_support_threads_client_status_updated_idx
  on public.client_support_threads (client_id, status, updated_at desc);

comment on table public.client_support_threads is
  'Support-onderwerp per klant; gesloten = gearchiveerd maar doorzoekbaar.';

create table public.client_support_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.client_support_threads (id) on delete cascade,
  author_kind text not null,
  body text not null,
  portal_user_id uuid,
  staff_user_id uuid,
  staff_display_name text,
  created_at timestamptz not null default now(),
  constraint client_support_messages_author_kind_check check (author_kind in ('customer', 'staff')),
  constraint client_support_messages_body_len check (char_length(body) between 1 and 8000),
  constraint client_support_messages_customer_shape check (
    author_kind <> 'customer'
    or (
      portal_user_id is not null
      and staff_user_id is null
      and staff_display_name is null
    )
  ),
  constraint client_support_messages_staff_shape check (
    author_kind <> 'staff'
    or (
      staff_user_id is not null
      and staff_display_name is not null
      and char_length(trim(staff_display_name)) >= 1
      and portal_user_id is null
    )
  )
);

create index client_support_messages_thread_created_idx
  on public.client_support_messages (thread_id, created_at asc);

comment on table public.client_support_messages is
  'Klantbericht: portal_user_id. Studio: staff_user_id + staff_display_name (snapshot bij verzenden).';

-- Thread updated_at bij nieuw bericht
create or replace function public.touch_client_support_thread_updated_at()
returns trigger
language plpgsql
as $$
begin
  update public.client_support_threads
  set updated_at = now()
  where id = new.thread_id;
  return new;
end;
$$;

create trigger client_support_messages_touch_thread_updated_at
  after insert on public.client_support_messages
  for each row
  execute function public.touch_client_support_thread_updated_at();

create or replace function public.set_client_support_threads_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger client_support_threads_set_updated_at
  before update on public.client_support_threads
  for each row
  execute function public.set_client_support_threads_updated_at();

alter table public.client_support_threads enable row level security;
alter table public.client_support_messages enable row level security;

create policy "client_support_threads_select_authenticated"
  on public.client_support_threads
  for select
  to authenticated
  using (true);

create policy "client_support_threads_insert_authenticated"
  on public.client_support_threads
  for insert
  to authenticated
  with check (true);

create policy "client_support_threads_update_authenticated"
  on public.client_support_threads
  for update
  to authenticated
  using (true)
  with check (true);

create policy "client_support_messages_select_authenticated"
  on public.client_support_messages
  for select
  to authenticated
  using (true);

create policy "client_support_messages_insert_authenticated"
  on public.client_support_messages
  for insert
  to authenticated
  with check (true);

-- Commercieel ontkoppelen: support mee opruimen
create or replace function public.unlink_client_commercial_keep_site(p_subfolder_slug text)
returns jsonb
language plpgsql
as $$
declare
  v_id uuid;
  v_slug text;
begin
  v_slug := trim(p_subfolder_slug);
  if v_slug is null or v_slug = '' then
    return jsonb_build_object('ok', false, 'error', 'empty_slug');
  end if;

  select id into v_id from public.clients where subfolder_slug = v_slug;
  if v_id is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  if exists (select 1 from public.clients where id = v_id and commercial_unlinked_at is not null) then
    return jsonb_build_object('ok', true, 'subfolder_slug', v_slug, 'already_unlinked', true);
  end if;

  delete from public.client_staff_shifts where client_id = v_id;
  delete from public.client_staff where client_id = v_id;
  delete from public.client_appointments where client_id = v_id;
  delete from public.client_booking_services where client_id = v_id;

  delete from public.invoices where client_id = v_id;
  delete from public.quotes where client_id = v_id;

  delete from public.client_dossier_notes where client_id = v_id;
  delete from public.client_support_threads where client_id = v_id;
  delete from public.portal_push_subscriptions where client_id = v_id;
  delete from public.flyer_scans where client_id = v_id;
  delete from public.site_generation_jobs where client_id = v_id;

  delete from public.sales_tasks
  where linked_entity_type in ('client', 'website')
    and linked_entity_id = v_id;

  update public.sales_deals set client_id = null where client_id = v_id;

  update public.clients
  set
    name = 'Losse website (' || v_slug || ')',
    description = null,
    billing_email = null,
    phone = null,
    contact_name = null,
    company_legal_name = null,
    contact_name = null,
    vat_number = null,
    billing_address = null,
    billing_postal_code = null,
    billing_city = null,
    plan_type = null,
    plan_label = null,
    payment_status = 'none',
    payment_provider = null,
    payment_reference = null,
    subscription_renews_at = null,
    delivered_at = null,
    contract_accepted_at = null,
    internal_notes = null,
    pipeline_stage = 'lead',
    portal_user_id = null,
    portal_invoices_enabled = false,
    portal_account_enabled = false,
    appointments_enabled = false,
    webshop_enabled = false,
    booking_settings = null,
    subscription_cancel_at_period_end = false,
    subscription_cancel_requested_at = null,
    client_number = 'WEB-' || replace(v_id::text, '-', ''),
    commercial_unlinked_at = now(),
    updated_at = now()
  where id = v_id;

  return jsonb_build_object('ok', true, 'subfolder_slug', v_slug, 'client_id', v_id);
end;
$$;

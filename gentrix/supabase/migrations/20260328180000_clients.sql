-- Website Fabriek: clients (tenants / gegenereerde sites)
-- Run in Supabase SQL Editor or via supabase db push

create extension if not exists "pgcrypto";

create type public.client_status as enum (
  'draft',
  'active',
  'paused',
  'archived'
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  subfolder_slug text not null,
  site_data_json jsonb not null default '{}'::jsonb,
  status public.client_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clients_subfolder_slug_format check (
    subfolder_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    and char_length(subfolder_slug) between 2 and 64
  )
);

create unique index clients_subfolder_slug_key on public.clients (subfolder_slug);
create index clients_status_idx on public.clients (status);

create or replace function public.set_clients_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger clients_set_updated_at
  before update on public.clients
  for each row
  execute function public.set_clients_updated_at();

alter table public.clients enable row level security;

-- Pas aan zodra je auth-rollen en policies exact wil; service role omzeilt RLS voor server-only routes.
create policy "clients_select_authenticated"
  on public.clients
  for select
  to authenticated
  using (true);

create policy "clients_insert_authenticated"
  on public.clients
  for insert
  to authenticated
  with check (true);

create policy "clients_update_authenticated"
  on public.clients
  for update
  to authenticated
  using (true)
  with check (true);

create policy "clients_delete_authenticated"
  on public.clients
  for delete
  to authenticated
  using (true);

comment on table public.clients is 'Klanten / sites: JSON-payload voor renderer, unieke slug per subpad.';

-- =============================================================================
-- Stem je handmatige `clients`-tabel af op de Website Fabriek / Studio-app.
--
-- Jouw oude kolommen: business_name, slug, site_data, status (text, o.a. 'concept')
-- App verwacht:        name, subfolder_slug, site_data_json, status (enum)
--
-- Voer dit EENMALIG uit in Supabase → SQL Editor. Daarna: API → Reload schema.
-- =============================================================================

create extension if not exists "pgcrypto";

do $$
begin
  create type public.client_status as enum (
    'draft',
    'active',
    'paused',
    'archived'
  );
exception
  when duplicate_object then null;
end $$;

-- Dubbele kolommen opruimen (bijv. na gedeeltelijke migratie)
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'clients' and column_name = 'business_name'
  ) and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'clients' and column_name = 'name'
  ) then
    update public.clients
    set name = coalesce(nullif(trim(name), ''), nullif(trim(business_name), ''))
    where name is null or trim(name) = '';
    alter table public.clients drop column business_name;
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'clients' and column_name = 'slug'
  ) and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'clients' and column_name = 'subfolder_slug'
  ) then
    update public.clients
    set subfolder_slug = coalesce(nullif(trim(subfolder_slug), ''), nullif(trim(slug), ''))
    where subfolder_slug is null or trim(subfolder_slug) = '';
    alter table public.clients drop column slug;
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'clients' and column_name = 'site_data'
  ) and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'clients' and column_name = 'site_data_json'
  ) then
    update public.clients
    set site_data_json = coalesce(site_data_json, site_data)
    where site_data_json is null or site_data_json = 'null'::jsonb;
    alter table public.clients drop column site_data;
  end if;
end $$;

-- Kolommen hernoemen (alleen als je nog de oude namen hebt)
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'clients' and column_name = 'business_name'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'clients' and column_name = 'name'
  ) then
    alter table public.clients rename column business_name to name;
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'clients' and column_name = 'slug'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'clients' and column_name = 'subfolder_slug'
  ) then
    alter table public.clients rename column slug to subfolder_slug;
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'clients' and column_name = 'site_data'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'clients' and column_name = 'site_data_json'
  ) then
    alter table public.clients rename column site_data to site_data_json;
  end if;
end $$;

-- updated_at + trigger (app sorteert hierop)
alter table public.clients add column if not exists updated_at timestamptz not null default now();

create or replace function public.set_clients_updated_at()
returns trigger
language plpgsql
as $fn$
begin
  new.updated_at = now();
  return new;
end;
$fn$;

drop trigger if exists clients_set_updated_at on public.clients;
create trigger clients_set_updated_at
  before update on public.clients
  for each row
  execute function public.set_clients_updated_at();

-- status: text → enum (alleen als het nog geen client_status is)
do $$
declare
  udt text;
begin
  select c.udt_name into udt
  from information_schema.columns c
  where c.table_schema = 'public' and c.table_name = 'clients' and c.column_name = 'status';

  if udt is null then
    return;
  elsif udt = 'client_status' then
    return;
  end if;

  alter table public.clients add column status_app public.client_status;

  update public.clients
  set status_app = case
    when lower(trim(status::text)) in ('concept', 'draft', 'conceptueel') then 'draft'::public.client_status
    when lower(trim(status::text)) in ('active', 'live', 'published', 'publiek') then 'active'::public.client_status
    when lower(trim(status::text)) = 'paused' then 'paused'::public.client_status
    when lower(trim(status::text)) = 'archived' then 'archived'::public.client_status
    else 'draft'::public.client_status
  end;

  alter table public.clients drop column status;
  alter table public.clients rename column status_app to status;
  alter table public.clients alter column status set not null;
  alter table public.clients alter column status set default 'draft'::public.client_status;
end $$;

-- Verplichte velden voor de app
update public.clients
set name = coalesce(nullif(trim(name), ''), initcap(replace(subfolder_slug, '-', ' ')))
where name is null or trim(name) = '';

update public.clients
set name = 'Klant'
where name is null or trim(name) = '';

alter table public.clients alter column name set not null;

alter table public.clients alter column site_data_json set default '{}'::jsonb;
update public.clients set site_data_json = '{}'::jsonb where site_data_json is null;
alter table public.clients alter column site_data_json set not null;

-- Slug-formaat (zelfde als app)
alter table public.clients drop constraint if exists clients_subfolder_slug_format;
alter table public.clients add constraint clients_subfolder_slug_format check (
  subfolder_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  and char_length(subfolder_slug) between 2 and 64
);

create unique index if not exists clients_subfolder_slug_key on public.clients (subfolder_slug);
create index if not exists clients_status_idx on public.clients (status);

-- RLS + policies (veilig opnieuw uitvoeren)
alter table public.clients enable row level security;

drop policy if exists "clients_select_authenticated" on public.clients;
drop policy if exists "clients_insert_authenticated" on public.clients;
drop policy if exists "clients_update_authenticated" on public.clients;
drop policy if exists "clients_delete_authenticated" on public.clients;
drop policy if exists "clients_select_anon_active" on public.clients;

create policy "clients_select_authenticated"
  on public.clients for select to authenticated using (true);

create policy "clients_insert_authenticated"
  on public.clients for insert to authenticated with check (true);

create policy "clients_update_authenticated"
  on public.clients for update to authenticated using (true) with check (true);

create policy "clients_delete_authenticated"
  on public.clients for delete to authenticated using (true);

create policy "clients_select_anon_active"
  on public.clients for select to anon
  using (status = 'active');

notify pgrst, 'reload schema';

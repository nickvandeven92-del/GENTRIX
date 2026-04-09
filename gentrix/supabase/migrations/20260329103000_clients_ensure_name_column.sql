-- Repareert PostgREST: "Could not find the 'name' column of 'clients' in the schema cache"
-- als `clients` handmatig of zonder volledige migratie is aangemaakt.

alter table public.clients add column if not exists name text;

-- Bestaande rijen zonder naam: afgeleid van slug
update public.clients
set name = initcap(replace(subfolder_slug, '-', ' '))
where name is null or trim(name) = '';

update public.clients
set name = 'Klant'
where name is null;

alter table public.clients alter column name set default 'Klant';
alter table public.clients alter column name set not null;

-- PostgREST-schema-cache verversen (Supabase)
notify pgrst, 'reload schema';

-- Studio-pakket voor AI-generatie: starter | premium | elite
alter table public.clients
  add column if not exists generation_package text not null default 'starter';

do $$
begin
  alter table public.clients
    add constraint clients_generation_package_check
    check (generation_package in ('starter', 'premium', 'elite'));
exception
  when duplicate_object then null;
end $$;

comment on column public.clients.generation_package is 'AI-studio pakket: starter (basis), premium (ondernemer-dashboard mock), elite (afspraken + klant-dashboard mock).';

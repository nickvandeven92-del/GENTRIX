-- Productmodel: standalone | basis | premium | custom (vervangt starter | premium | elite)
alter table public.clients drop constraint if exists clients_generation_package_check;

update public.clients
set generation_package = case generation_package
  when 'starter' then 'basis'
  when 'elite' then 'premium'
  else generation_package
end;

update public.clients
set generation_package = 'basis'
where generation_package is null
   or generation_package not in ('standalone', 'basis', 'premium', 'custom');

alter table public.clients
  alter column generation_package set default 'basis';

do $$
begin
  alter table public.clients
    add constraint clients_generation_package_check
    check (generation_package in ('standalone', 'basis', 'premium', 'custom'));
exception
  when duplicate_object then null;
end $$;

comment on column public.clients.generation_package is
  'Product/AI-pakket: standalone (eenmalig, marketing), basis (abbo marketing+onderhoud), premium (abbo + portaal-mock), custom (maatwerk: integraties, chat, WhatsApp — statische placeholders).';

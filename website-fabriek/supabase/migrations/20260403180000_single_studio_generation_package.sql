-- Eén studio-product: normaliseer legacy pakketwaarden naar `studio` en beperk constraint.

alter table public.clients drop constraint if exists clients_generation_package_check;

update public.clients
set generation_package = 'studio'
where generation_package is null
   or generation_package <> 'studio';

alter table public.clients alter column generation_package set default 'studio';

alter table public.clients
  add constraint clients_generation_package_check
  check (generation_package = 'studio');

comment on column public.clients.generation_package is
  'Vast: Site studio — één generator (marketing + optioneel portaal-mock + briefing-maatwerk).';

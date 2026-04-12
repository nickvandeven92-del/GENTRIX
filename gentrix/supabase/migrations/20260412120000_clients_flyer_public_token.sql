-- Korte publieke link voor flyers/QR: /p/{uuid} → redirect naar concept- of livesite.
alter table public.clients
  add column if not exists flyer_public_token uuid;

comment on column public.clients.flyer_public_token is
  'Publiek UUID voor /p/{token}; wijst naar dit dossier (QR/flyer).';

create unique index if not exists clients_flyer_public_token_uidx
  on public.clients (flyer_public_token)
  where flyer_public_token is not null;

update public.clients
set flyer_public_token = gen_random_uuid()
where flyer_public_token is null;

alter table public.clients
  alter column flyer_public_token set default gen_random_uuid();

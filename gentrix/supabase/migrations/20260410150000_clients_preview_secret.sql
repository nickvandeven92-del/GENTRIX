-- Geheime token voor publieke concept-preview (/preview/{slug}?token=) zonder status active.

alter table public.clients
  add column if not exists preview_secret text;

comment on column public.clients.preview_secret is
  'Unieke token; alleen met deze queryparam is /preview/{subfolder_slug} zichtbaar (concept voor klant).';

-- Optionele PIN voor /agenda (tablet): na dezelfde Supabase-login als het portaal, extra stap op gedeeld apparaat.
alter table public.clients
  add column if not exists agenda_kiosk_pin_hash text null;

comment on column public.clients.agenda_kiosk_pin_hash is
  'Scrypt-hash (v1$…) van 4–6 cijfers; optioneel. Zie /agenda/{slug}.';

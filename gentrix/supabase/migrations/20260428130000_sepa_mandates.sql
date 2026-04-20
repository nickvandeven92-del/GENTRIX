-- SEPA-machtigingen per klant.
-- Bewijs dat een incasso-machtiging geldig was: vereist bij MOI-claim.

create table public.sepa_mandates (
  id                        uuid primary key default gen_random_uuid(),
  client_id                 uuid not null references public.clients(id) on delete cascade,

  -- Mollie-referenties (null zolang nog niet gekoppeld)
  mollie_mandate_id         text,

  -- Mandaatidentificatie
  mandate_reference         text not null,
  mandate_date              date not null,

  -- IBAN: alleen laatste 4 cijfers opslaan (privacy + PCI)
  iban_last4                char(4) not null,
  account_holder            text,
  bank_name                 text,

  -- Status
  status                    text not null default 'valid',

  -- Pre-notificatie
  prenotification_agreement text,

  -- Consent-bewijs
  consent_text_version      text,
  consent_at                timestamptz,
  consent_ip                text,
  confirmation_email_sent   boolean not null default false,

  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

comment on table  public.sepa_mandates                        is 'SEPA-machtigingen per klant; bewaar voor MOI-claims.';
comment on column public.sepa_mandates.iban_last4             is 'Alleen de laatste 4 cijfers van het IBAN (privacy).';
comment on column public.sepa_mandates.status                 is 'valid | pending | invalid | revoked';
comment on column public.sepa_mandates.mandate_reference      is 'Unieke mandaatreferentie (intern of van Mollie).';
comment on column public.sepa_mandates.consent_text_version   is 'Versie-label van de machtigingstekst waarmee klant akkoord ging.';

do $$
begin
  alter table public.sepa_mandates
    add constraint sepa_mandates_status_check
    check (status in ('valid', 'pending', 'invalid', 'revoked'));
exception
  when duplicate_object then null;
end $$;

create index if not exists sepa_mandates_client_id_idx on public.sepa_mandates (client_id);
create index if not exists sepa_mandates_status_idx    on public.sepa_mandates (status);

create or replace function public.set_sepa_mandates_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger sepa_mandates_set_updated_at
  before update on public.sepa_mandates
  for each row execute function public.set_sepa_mandates_updated_at();

alter table public.sepa_mandates enable row level security;

create policy "sepa_mandates_select_authenticated"
  on public.sepa_mandates for select to authenticated using (true);

create policy "sepa_mandates_insert_authenticated"
  on public.sepa_mandates for insert to authenticated with check (true);

create policy "sepa_mandates_update_authenticated"
  on public.sepa_mandates for update to authenticated using (true) with check (true);

create policy "sepa_mandates_delete_authenticated"
  on public.sepa_mandates for delete to authenticated using (true);

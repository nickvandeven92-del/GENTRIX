-- Uitbreiding clients voor Mollie-koppeling, uitgebreide billing status,
-- incasso-opvolging, service-schorsing en consent/bewijs velden.

-- === Abonnement & Mollie ===
alter table public.clients
  add column if not exists billing_status       text not null default 'active',
  add column if not exists mollie_customer_id   text,
  add column if not exists mollie_subscription_id text,
  add column if not exists subscription_start_date date,
  add column if not exists billing_interval     text,
  add column if not exists prenotification_agreement text;

comment on column public.clients.billing_status         is 'active | pending_first_collection | paid | past_due | retry_scheduled | chargeback | suspended | cancelled';
comment on column public.clients.mollie_customer_id     is 'Mollie klant-ID: cst_xxx';
comment on column public.clients.mollie_subscription_id is 'Actief Mollie abonnement-ID: sub_xxx';
comment on column public.clients.billing_interval       is 'monthly | quarterly | yearly | one_time';
comment on column public.clients.prenotification_agreement is 'Pre-notificatieafspraak, bijv. "maandelijks rond de 1e"';

do $$
begin
  alter table public.clients
    add constraint clients_billing_status_check
    check (billing_status in (
      'active', 'pending_first_collection', 'paid',
      'past_due', 'retry_scheduled', 'chargeback',
      'suspended', 'cancelled'
    ));
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.clients
    add constraint clients_billing_interval_check
    check (billing_interval is null or billing_interval in ('monthly', 'quarterly', 'yearly', 'one_time'));
exception
  when duplicate_object then null;
end $$;

create index if not exists clients_billing_status_idx on public.clients (billing_status);
create index if not exists clients_mollie_customer_idx on public.clients (mollie_customer_id) where mollie_customer_id is not null;

-- === Incasso-opvolging (collections) ===
alter table public.clients
  add column if not exists failed_collection_count    int not null default 0,
  add column if not exists last_reminder_sent_at      timestamptz,
  add column if not exists next_retry_at              timestamptz,
  add column if not exists manual_payment_link_sent   boolean not null default false,
  add column if not exists debt_collection_transferred boolean not null default false,
  add column if not exists billing_exception_granted  boolean not null default false;

comment on column public.clients.failed_collection_count   is 'Aantal mislukte incassopogingen (huidig incassocyclus)';
comment on column public.clients.next_retry_at             is 'Geplande datum voor volgende automatische incassopoging';
comment on column public.clients.debt_collection_transferred is 'Dossier overgedragen aan incassobureau';
comment on column public.clients.billing_exception_granted is 'Handmatige uitzondering verleend (betaalregeling e.d.)';

-- === Service schorsing ===
alter table public.clients
  add column if not exists service_suspended        boolean not null default false,
  add column if not exists service_suspension_reason text,
  add column if not exists domain_paused            boolean not null default false,
  add column if not exists email_addon_paused       boolean not null default false,
  add column if not exists booking_paused           boolean not null default false,
  add column if not exists shop_paused              boolean not null default false;

comment on column public.clients.service_suspended          is 'Site/dienst actief geschorst wegens wanbetaling of andere reden';
comment on column public.clients.service_suspension_reason  is 'Reden van schorsing (billing: past_due / chargeback / manual)';
comment on column public.clients.domain_paused              is 'Custom domain doorgestuurd / gepauzeerd';
comment on column public.clients.email_addon_paused         is 'E-mail add-on gepauzeerd';
comment on column public.clients.booking_paused             is 'Booking/agenda module gepauzeerd wegens billing';
comment on column public.clients.shop_paused                is 'Webshop module gepauzeerd wegens billing';

create index if not exists clients_service_suspended_idx on public.clients (service_suspended) where service_suspended = true;

-- === Consent & bewijs ===
alter table public.clients
  add column if not exists checkout_consent_text_version text,
  add column if not exists checkout_consent_ip           text,
  add column if not exists checkout_confirmation_email_sent boolean not null default false;

comment on column public.clients.checkout_consent_text_version is 'Versie-label van de machtigingstekst waarmee klant akkoord ging';
comment on column public.clients.checkout_consent_ip           is 'IP-adres bij checkout-akkoord (indien beschikbaar via provider)';
comment on column public.clients.checkout_confirmation_email_sent is 'Bevestigingsmail na akkoord verstuurd';

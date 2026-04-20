-- Incasso-pogingen per klant: volledige geschiedenis per poging.
-- Elke automatische of handmatige incassopoging krijgt een regel.

create table public.payment_attempts (
  id                    uuid primary key default gen_random_uuid(),
  client_id             uuid not null references public.clients(id) on delete cascade,

  -- Wanneer geprobeerd
  attempted_at          timestamptz not null default now(),

  -- Bedrag en periode
  amount                numeric(10, 2) not null,
  currency              text not null default 'EUR',
  period_label          text,

  -- Mollie-referenties
  mollie_payment_id     text,
  mollie_subscription_id text,

  -- Resultaat
  status                text not null,
  failure_reason        text,
  webhook_received_at   timestamptz,

  -- Vrij veld voor handmatige aantekening
  manual_note           text,

  created_at            timestamptz not null default now()
);

comment on table  public.payment_attempts                   is 'Elke incasso- of betaalpoging per klant; nodig voor incasso-history.';
comment on column public.payment_attempts.period_label      is 'Leesbare periode, bijv. "april 2026".';
comment on column public.payment_attempts.mollie_payment_id is 'Mollie betaal-ID: tr_xxx';
comment on column public.payment_attempts.mollie_subscription_id is 'Mollie abonnement-ID: sub_xxx';
comment on column public.payment_attempts.status            is 'paid | failed | pending | open | chargeback | refunded';
comment on column public.payment_attempts.failure_reason    is 'Reden van mislukken (van Mollie of handmatig ingevuld).';
comment on column public.payment_attempts.webhook_received_at is 'Tijdstip ontvangst Mollie-webhook voor deze poging.';

do $$
begin
  alter table public.payment_attempts
    add constraint payment_attempts_status_check
    check (status in ('paid', 'failed', 'pending', 'open', 'chargeback', 'refunded'));
exception
  when duplicate_object then null;
end $$;

create index if not exists payment_attempts_client_id_idx    on public.payment_attempts (client_id);
create index if not exists payment_attempts_attempted_at_idx on public.payment_attempts (attempted_at desc);
create index if not exists payment_attempts_status_idx       on public.payment_attempts (status);

alter table public.payment_attempts enable row level security;

create policy "payment_attempts_select_authenticated"
  on public.payment_attempts for select to authenticated using (true);

create policy "payment_attempts_insert_authenticated"
  on public.payment_attempts for insert to authenticated with check (true);

create policy "payment_attempts_update_authenticated"
  on public.payment_attempts for update to authenticated using (true) with check (true);

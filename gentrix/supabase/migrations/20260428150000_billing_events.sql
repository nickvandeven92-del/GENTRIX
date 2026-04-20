-- Billing-events auditlog: elke significante billing-statuswijziging krijgt een regel.
-- Geeft een complete tijdlijn per klant (payment_paid, chargeback_received, service_suspended, etc.).

create table public.billing_events (
  id                  uuid primary key default gen_random_uuid(),
  client_id           uuid not null references public.clients(id) on delete cascade,

  -- Wat er is gebeurd
  event_type          text not null,
  occurred_at         timestamptz not null default now(),

  -- Wie/wat heeft dit veroorzaakt
  actor               text not null default 'system',

  -- Optioneel gekoppeld aan een betaalpoging
  payment_attempt_id  uuid references public.payment_attempts(id) on delete set null,

  -- Bedrag (bijv. bij chargeback)
  amount              numeric(10, 2),

  -- Extra context als JSON (bijv. mollie event data)
  metadata            jsonb not null default '{}'::jsonb,

  -- Vrij tekstveld
  note                text,

  created_at          timestamptz not null default now()
);

comment on table  public.billing_events            is 'Auditlog voor billing-lifecycle per klant.';
comment on column public.billing_events.event_type is
  'payment_paid | payment_failed | retry_scheduled | chargeback_received | '
  'service_suspended | service_reactivated | manual_payment_received | '
  'mandate_created | mandate_revoked | subscription_cancelled | billing_exception_granted';
comment on column public.billing_events.actor      is '"system" | "mollie_webhook" | "admin" of admin-UUID.';
comment on column public.billing_events.metadata   is 'Vrije JSON, bijv. Mollie webhook payload of extra context.';

do $$
begin
  alter table public.billing_events
    add constraint billing_events_event_type_check
    check (event_type in (
      'payment_paid',
      'payment_failed',
      'retry_scheduled',
      'chargeback_received',
      'service_suspended',
      'service_reactivated',
      'manual_payment_received',
      'mandate_created',
      'mandate_revoked',
      'subscription_cancelled',
      'billing_exception_granted'
    ));
exception
  when duplicate_object then null;
end $$;

create index if not exists billing_events_client_id_idx   on public.billing_events (client_id);
create index if not exists billing_events_occurred_at_idx on public.billing_events (occurred_at desc);
create index if not exists billing_events_event_type_idx  on public.billing_events (event_type);

alter table public.billing_events enable row level security;

create policy "billing_events_select_authenticated"
  on public.billing_events for select to authenticated using (true);

create policy "billing_events_insert_authenticated"
  on public.billing_events for insert to authenticated with check (true);

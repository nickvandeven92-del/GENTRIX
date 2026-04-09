-- Commercie, abonnement, pipeline en custom domein (admin); koppel later aan Stripe/Mollie via payment_reference.

alter table public.clients
  add column if not exists billing_email text,
  add column if not exists phone text,
  add column if not exists company_legal_name text,
  add column if not exists vat_number text,
  add column if not exists billing_address text,
  add column if not exists plan_type text,
  add column if not exists plan_label text,
  add column if not exists payment_status text not null default 'none',
  add column if not exists payment_provider text,
  add column if not exists payment_reference text,
  add column if not exists subscription_renews_at timestamptz,
  add column if not exists delivered_at timestamptz,
  add column if not exists contract_accepted_at timestamptz,
  add column if not exists internal_notes text,
  add column if not exists pipeline_stage text not null default 'lead',
  add column if not exists custom_domain text,
  add column if not exists domain_verified boolean not null default false,
  add column if not exists domain_dns_target text;

comment on column public.clients.plan_type is 'one_time | subscription | trial | custom';
comment on column public.clients.payment_status is 'none | pending | paid | refunded | failed';
comment on column public.clients.pipeline_stage is 'lead | paid | building | delivered | live | support';
comment on column public.clients.domain_dns_target is 'CNAME-doel dat je de klant geeft, bijv. sites.jouwdomein.nl of Vercel-target';

do $$
begin
  alter table public.clients
    add constraint clients_plan_type_check
    check (plan_type is null or plan_type in ('one_time', 'subscription', 'trial', 'custom'));
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.clients
    add constraint clients_payment_status_check
    check (payment_status in ('none', 'pending', 'paid', 'refunded', 'failed'));
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.clients
    add constraint clients_pipeline_stage_check
    check (pipeline_stage in ('lead', 'paid', 'building', 'delivered', 'live', 'support'));
exception
  when duplicate_object then null;
end $$;

create index if not exists clients_payment_status_idx on public.clients (payment_status);
create index if not exists clients_pipeline_stage_idx on public.clients (pipeline_stage);
create index if not exists clients_custom_domain_idx on public.clients (custom_domain) where custom_domain is not null;

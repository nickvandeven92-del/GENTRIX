-- Portaal: abonnement opzeggen per einde lopende periode (klantactie + zichtbaar in admin).

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS subscription_cancel_at_period_end boolean NOT NULL DEFAULT false;

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS subscription_cancel_requested_at timestamptz;

COMMENT ON COLUMN public.clients.subscription_cancel_at_period_end IS
  'true = klant heeft opgezegd; abonnement loopt tot subscription_renews_at (of volgens afspraak).';

COMMENT ON COLUMN public.clients.subscription_cancel_requested_at IS
  'Tijdstip van eerste opzegverzoek via portaal.';

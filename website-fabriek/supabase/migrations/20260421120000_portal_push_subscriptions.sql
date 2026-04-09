-- Browser push (Web Push) voor nieuwe afspraken: alleen server-side via service role.

CREATE TABLE IF NOT EXISTS public.portal_push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients (id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT portal_push_subscriptions_endpoint_key UNIQUE (endpoint)
);

CREATE INDEX IF NOT EXISTS portal_push_subscriptions_client_id_idx
  ON public.portal_push_subscriptions (client_id);

CREATE INDEX IF NOT EXISTS portal_push_subscriptions_user_client_idx
  ON public.portal_push_subscriptions (user_id, client_id);

ALTER TABLE public.portal_push_subscriptions ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.portal_push_subscriptions IS
  'Web Push subscriptions voor portaalgebruikers; alleen via API met service role.';

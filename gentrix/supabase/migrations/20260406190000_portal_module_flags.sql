-- Portaal: optioneel facturen- en account-tab uitzetten per klant (naast afspraken).

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS portal_invoices_enabled boolean NOT NULL DEFAULT true;

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS portal_account_enabled boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.clients.portal_invoices_enabled IS
  'false = geen Facturen-tab in /portal/{slug}.';

COMMENT ON COLUMN public.clients.portal_account_enabled IS
  'false = geen Account-tab (abonnement/opzeggen) in /portal/{slug}.';

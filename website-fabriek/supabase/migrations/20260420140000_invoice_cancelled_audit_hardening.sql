-- Facturen: status 'cancelled', striktere nummer-check, audittrail.
-- Service role (admin API) schrijft audit; RLS blokkeert directe client-toegang.

-- ---------------------------------------------------------------------------
-- 1) Status 'cancelled'
-- ---------------------------------------------------------------------------
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_status_check;
ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_status_check
  CHECK (status IN ('draft', 'sent', 'paid', 'cancelled'));

-- Verzonden/betaald moeten een nummer hebben; concept en geannuleerd mogen NULL (concept of nooit definitief).
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_sent_paid_require_number;
ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_sent_paid_require_number
  CHECK (status NOT IN ('sent', 'paid') OR invoice_number IS NOT NULL);

-- Definitief nummer: vast formaat INV-YYYY-NNN (administratief jaar; app gebruikt Europe/Amsterdam).
UPDATE public.invoices
SET invoice_number = NULL
WHERE invoice_number IS NOT NULL AND length(trim(invoice_number)) = 0;

ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_invoice_number_format;
ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_invoice_number_format
  CHECK (
    invoice_number IS NULL
    OR invoice_number ~ '^INV-[0-9]{4}-[0-9]{3}$'
  );

COMMENT ON CONSTRAINT invoices_invoice_number_format ON public.invoices IS
  'Alleen NULL (concept) of INV-YYYY-NNN. Losse client-nummers in dit veld worden door de API geweigerd.';

-- ---------------------------------------------------------------------------
-- 2) Audit events (entity-agnostisch opgezet; nu vooral invoice)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invoice_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL DEFAULT 'invoice',
  entity_id uuid NOT NULL REFERENCES public.invoices (id) ON DELETE CASCADE,
  action text NOT NULL,
  previous_status text,
  next_status text,
  invoice_number_before text,
  invoice_number_after text,
  actor_user_id uuid,
  reason_code text,
  source text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS invoice_audit_events_entity_idx
  ON public.invoice_audit_events (entity_type, entity_id, created_at DESC);

COMMENT ON TABLE public.invoice_audit_events IS
  'Audittrail facturen (status, nummers, geweigerde transities). Alleen server-side service role.';

ALTER TABLE public.invoice_audit_events ENABLE ROW LEVEL SECURITY;

-- Geen policies: authenticated kan niet lezen/schrijven; service_role bypasses RLS.

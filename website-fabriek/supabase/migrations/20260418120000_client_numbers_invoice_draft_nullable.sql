-- Professionele documentnummering: klantnummers + factuurnummer pas definitief na versturen.
-- Volgorde: kolommen → backfill → constraints/indexen.

-- ---------------------------------------------------------------------------
-- 1) Klanten: client_number (CL-YYYY-NNN)
-- ---------------------------------------------------------------------------
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS client_number text;

WITH c_ordered AS (
  SELECT
    c.id,
    ROW_NUMBER() OVER (
      PARTITION BY EXTRACT(YEAR FROM (c.created_at AT TIME ZONE 'Europe/Amsterdam'))
      ORDER BY c.created_at
    ) AS rn,
    EXTRACT(YEAR FROM (c.created_at AT TIME ZONE 'Europe/Amsterdam'))::int AS y
  FROM public.clients c
  WHERE c.client_number IS NULL
)
UPDATE public.clients c
SET client_number = 'CL-' || o.y || '-' || LPAD(o.rn::text, 3, '0')
FROM c_ordered o
WHERE c.id = o.id;

CREATE UNIQUE INDEX IF NOT EXISTS clients_client_number_key ON public.clients (client_number);

ALTER TABLE public.clients ALTER COLUMN client_number SET NOT NULL;

COMMENT ON COLUMN public.clients.client_number IS 'Vast administratief klantnummer (CL-YYYY-NNN); nooit hergebruiken.';

-- ---------------------------------------------------------------------------
-- 2) Facturen: concept zonder definitief nummer; uniek alleen op niet-NULL
-- ---------------------------------------------------------------------------
-- Bestaande unieke index op invoice_number (alle rijen)
DROP INDEX IF EXISTS public.invoices_invoice_number_key;

-- Conceptfacturen: geen definitief factuurnummer tot versturen
UPDATE public.invoices SET invoice_number = NULL WHERE status = 'draft';

ALTER TABLE public.invoices ALTER COLUMN invoice_number DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS invoices_invoice_number_unique_not_null
  ON public.invoices (invoice_number)
  WHERE invoice_number IS NOT NULL;

-- Verzonden/betaald moeten altijd een nummer hebben
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_sent_paid_require_number;
ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_sent_paid_require_number
  CHECK (status = 'draft' OR invoice_number IS NOT NULL);

COMMENT ON COLUMN public.invoices.invoice_number IS
  'Definitief factuurnummer (INV-YYYY-NNN), toegekend bij eerste verzending; blijft behouden bij terugzetten naar concept.';

-- Offertes: quote_number blijft verplicht (OFF-YYYY-NNN bij aanmaak)
-- (geen wijziging; bestaande NOT NULL + unique blijven)

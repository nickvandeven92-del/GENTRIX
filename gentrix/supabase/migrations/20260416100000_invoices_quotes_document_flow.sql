-- Documentflow: nummers, snapshots, regels, datums. Achterstallig = afgeleid (geen status 'overdue' meer).
-- RLS: nog steeds authenticated=true; strakker beleid kan later via app_metadata / service role only.

-- ---------------------------------------------------------------------------
-- Tabellen regels
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices (id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity numeric(12, 2) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price numeric(14, 2) NOT NULL CHECK (unit_price >= 0),
  line_total numeric(14, 2) NOT NULL CHECK (line_total >= 0),
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS invoice_items_invoice_id_idx ON public.invoice_items (invoice_id);
CREATE INDEX IF NOT EXISTS invoice_items_invoice_position_idx ON public.invoice_items (invoice_id, position);

CREATE TABLE IF NOT EXISTS public.quote_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES public.quotes (id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity numeric(12, 2) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price numeric(14, 2) NOT NULL CHECK (unit_price >= 0),
  line_total numeric(14, 2) NOT NULL CHECK (line_total >= 0),
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS quote_items_quote_id_idx ON public.quote_items (quote_id);
CREATE INDEX IF NOT EXISTS quote_items_quote_position_idx ON public.quote_items (quote_id, position);

ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invoice_items_select_authenticated" ON public.invoice_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "invoice_items_insert_authenticated" ON public.invoice_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "invoice_items_update_authenticated" ON public.invoice_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "invoice_items_delete_authenticated" ON public.invoice_items FOR DELETE TO authenticated USING (true);

CREATE POLICY "quote_items_select_authenticated" ON public.quote_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "quote_items_insert_authenticated" ON public.quote_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "quote_items_update_authenticated" ON public.quote_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "quote_items_delete_authenticated" ON public.quote_items FOR DELETE TO authenticated USING (true);

-- ---------------------------------------------------------------------------
-- Uitbreiden invoices / quotes
-- ---------------------------------------------------------------------------
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS invoice_number text,
  ADD COLUMN IF NOT EXISTS issued_at timestamptz,
  ADD COLUMN IF NOT EXISTS sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'EUR',
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS company_name_snapshot text,
  ADD COLUMN IF NOT EXISTS billing_email_snapshot text,
  ADD COLUMN IF NOT EXISTS billing_address_snapshot text;

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS quote_number text,
  ADD COLUMN IF NOT EXISTS issued_at timestamptz,
  ADD COLUMN IF NOT EXISTS sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejected_at timestamptz,
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'EUR',
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS company_name_snapshot text,
  ADD COLUMN IF NOT EXISTS billing_email_snapshot text,
  ADD COLUMN IF NOT EXISTS billing_address_snapshot text;

-- Legacy: overdue → verzonden (achterstallig wordt afgeleid)
UPDATE public.invoices SET status = 'sent' WHERE status = 'overdue';

ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_status_check;
ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_status_check CHECK (status IN ('draft', 'sent', 'paid'));

COMMENT ON COLUMN public.invoices.invoice_number IS 'Uniek documentnummer, bijv. INV-2026-001';
COMMENT ON COLUMN public.invoices.issued_at IS 'Factuurdatum (vastgelegd)';
COMMENT ON COLUMN public.invoices.sent_at IS 'Verstuurd naar klant';

-- Backfill nummers en snapshots
WITH inv_ordered AS (
  SELECT
    i.id,
    ROW_NUMBER() OVER (
      PARTITION BY EXTRACT(
        YEAR FROM (i.created_at AT TIME ZONE 'Europe/Amsterdam')
      )
      ORDER BY i.created_at
    ) AS rn,
    EXTRACT(YEAR FROM (i.created_at AT TIME ZONE 'Europe/Amsterdam'))::int AS y
  FROM public.invoices i
  WHERE i.invoice_number IS NULL
)
UPDATE public.invoices inv
SET
  invoice_number = 'INV-' || o.y || '-' || LPAD(o.rn::text, 3, '0')
FROM inv_ordered o
WHERE inv.id = o.id;

UPDATE public.invoices i
SET
  issued_at = COALESCE(i.issued_at, i.created_at),
  company_name_snapshot = COALESCE(
    NULLIF(TRIM(c.company_legal_name), ''),
    c.name
  ),
  billing_email_snapshot = c.billing_email,
  billing_address_snapshot = c.billing_address
FROM public.clients c
WHERE i.client_id = c.id
  AND (i.company_name_snapshot IS NULL OR i.billing_email_snapshot IS NULL OR i.billing_address_snapshot IS NULL);

UPDATE public.invoices SET issued_at = created_at WHERE issued_at IS NULL;

WITH q_ordered AS (
  SELECT
    q.id,
    ROW_NUMBER() OVER (
      PARTITION BY EXTRACT(
        YEAR FROM (q.created_at AT TIME ZONE 'Europe/Amsterdam')
      )
      ORDER BY q.created_at
    ) AS rn,
    EXTRACT(YEAR FROM (q.created_at AT TIME ZONE 'Europe/Amsterdam'))::int AS y
  FROM public.quotes q
  WHERE q.quote_number IS NULL
)
UPDATE public.quotes q
SET
  quote_number = 'OFF-' || o.y || '-' || LPAD(o.rn::text, 3, '0')
FROM q_ordered o
WHERE q.id = o.id;

UPDATE public.quotes q
SET
  issued_at = COALESCE(q.issued_at, q.created_at),
  company_name_snapshot = COALESCE(
    NULLIF(TRIM(c.company_legal_name), ''),
    c.name
  ),
  billing_email_snapshot = c.billing_email,
  billing_address_snapshot = c.billing_address
FROM public.clients c
WHERE q.client_id = c.id
  AND (q.company_name_snapshot IS NULL OR q.billing_email_snapshot IS NULL OR q.billing_address_snapshot IS NULL);

UPDATE public.quotes SET issued_at = created_at WHERE issued_at IS NULL;

-- Unieke nummers afdwingen (na backfill)
CREATE UNIQUE INDEX IF NOT EXISTS invoices_invoice_number_key ON public.invoices (invoice_number);
CREATE UNIQUE INDEX IF NOT EXISTS quotes_quote_number_key ON public.quotes (quote_number);

ALTER TABLE public.invoices ALTER COLUMN invoice_number SET NOT NULL;
ALTER TABLE public.quotes ALTER COLUMN quote_number SET NOT NULL;

COMMENT ON TABLE public.invoice_items IS 'Regels op factuur; line_total = quantity * unit_price (app houdt consistent).';
COMMENT ON TABLE public.quote_items IS 'Regels op offerte.';

COMMENT ON TABLE public.invoices IS
  'Facturen + documentflow. RLS: tijdelijk alle authenticated users; aanscherpen naar admin-only wanneer rollen beschikbaar zijn.';

-- Bestaande documenten zonder regels: één regel uit het totaalbedrag
INSERT INTO public.invoice_items (invoice_id, description, quantity, unit_price, line_total, position)
SELECT i.id, 'Diensten / producten', 1, i.amount, i.amount, 0
FROM public.invoices i
WHERE NOT EXISTS (SELECT 1 FROM public.invoice_items ii WHERE ii.invoice_id = i.id);

INSERT INTO public.quote_items (quote_id, description, quantity, unit_price, line_total, position)
SELECT q.id, 'Diensten / producten', 1, q.amount, q.amount, 0
FROM public.quotes q
WHERE NOT EXISTS (SELECT 1 FROM public.quote_items qi WHERE qi.quote_id = q.id);

-- Facturen en offertes (business OS-laag, geen boekhouding).

CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients (id) ON DELETE CASCADE,
  deal_id uuid REFERENCES public.sales_deals (id) ON DELETE SET NULL,
  amount numeric(14, 2) NOT NULL CHECK (amount >= 0),
  status text NOT NULL DEFAULT 'draft',
  due_date date NOT NULL,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT invoices_status_check CHECK (
    status IN ('draft', 'sent', 'paid', 'overdue')
  )
);

CREATE INDEX IF NOT EXISTS invoices_client_id_idx ON public.invoices (client_id);
CREATE INDEX IF NOT EXISTS invoices_status_idx ON public.invoices (status);

COMMENT ON TABLE public.invoices IS 'Facturen: inzicht en cashflow (geen BTW/boekhouding).';

CREATE TABLE IF NOT EXISTS public.quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients (id) ON DELETE CASCADE,
  deal_id uuid REFERENCES public.sales_deals (id) ON DELETE SET NULL,
  amount numeric(14, 2) NOT NULL CHECK (amount >= 0),
  status text NOT NULL DEFAULT 'draft',
  valid_until date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT quotes_status_check CHECK (
    status IN ('draft', 'sent', 'accepted', 'rejected')
  )
);

CREATE INDEX IF NOT EXISTS quotes_client_id_idx ON public.quotes (client_id);
CREATE INDEX IF NOT EXISTS quotes_status_idx ON public.quotes (status);

COMMENT ON TABLE public.quotes IS 'Offertes: tracking tot acceptatie (geen PDF-engine).';

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invoices_select_authenticated" ON public.invoices FOR SELECT TO authenticated USING (true);
CREATE POLICY "invoices_insert_authenticated" ON public.invoices FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "invoices_update_authenticated" ON public.invoices FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "invoices_delete_authenticated" ON public.invoices FOR DELETE TO authenticated USING (true);

CREATE POLICY "quotes_select_authenticated" ON public.quotes FOR SELECT TO authenticated USING (true);
CREATE POLICY "quotes_insert_authenticated" ON public.quotes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "quotes_update_authenticated" ON public.quotes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "quotes_delete_authenticated" ON public.quotes FOR DELETE TO authenticated USING (true);

-- Prospect leads uit KVK + website-enrichment (los van sales_leads / CRM-deals)

CREATE TABLE IF NOT EXISTS public.kvk_enriched_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL,
  kvk_number text NOT NULL,
  city text,
  website_url text,
  website_status text NOT NULL,
  website_detection_source text,
  website_quality_score integer,
  opportunity_score integer NOT NULL,
  call_angle text NOT NULL,
  reason_codes text[] NOT NULL DEFAULT '{}',
  enrichment_raw_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_checked_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT kvk_enriched_leads_kvk_number_key UNIQUE (kvk_number)
);

CREATE INDEX IF NOT EXISTS kvk_enriched_leads_updated_at_idx ON public.kvk_enriched_leads (updated_at DESC);

ALTER TABLE public.kvk_enriched_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kvk_enriched_leads_select_authenticated"
  ON public.kvk_enriched_leads FOR SELECT TO authenticated USING (true);

CREATE POLICY "kvk_enriched_leads_insert_authenticated"
  ON public.kvk_enriched_leads FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "kvk_enriched_leads_update_authenticated"
  ON public.kvk_enriched_leads FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "kvk_enriched_leads_delete_authenticated"
  ON public.kvk_enriched_leads FOR DELETE TO authenticated USING (true);

COMMENT ON TABLE public.kvk_enriched_leads IS 'KVK prospect + website-detectie/kwaliteit voor outbound (Sales OS).';

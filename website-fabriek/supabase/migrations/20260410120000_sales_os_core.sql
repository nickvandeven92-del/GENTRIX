-- Sales OS: leads, deals, tasks, website operational state.
-- RLS: zelfde patroon als clients (authenticated admin).

-- ---------------------------------------------------------------------------
-- sales_leads
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sales_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL,
  contact_name text,
  email text,
  phone text,
  source text NOT NULL DEFAULT 'unknown',
  status text NOT NULL DEFAULT 'new',
  owner_label text,
  budget_estimate text,
  notes text,
  next_follow_up_at timestamptz,
  last_contact_at timestamptz,
  converted_deal_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sales_leads_status_check CHECK (
    status IN ('new', 'working', 'qualified', 'lost', 'converted')
  )
);

CREATE INDEX IF NOT EXISTS sales_leads_status_idx ON public.sales_leads (status);
CREATE INDEX IF NOT EXISTS sales_leads_next_follow_up_idx ON public.sales_leads (next_follow_up_at);

CREATE TRIGGER sales_leads_set_updated_at
  BEFORE UPDATE ON public.sales_leads
  FOR EACH ROW
  EXECUTE FUNCTION public.set_clients_updated_at();

COMMENT ON TABLE public.sales_leads IS 'Sales OS: inbound/prospects vóór deal.';

-- ---------------------------------------------------------------------------
-- sales_deals
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sales_deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES public.sales_leads (id) ON DELETE SET NULL,
  client_id uuid REFERENCES public.clients (id) ON DELETE SET NULL,
  company_name text NOT NULL,
  title text NOT NULL DEFAULT '',
  stage text NOT NULL DEFAULT 'new_lead',
  value_cents bigint NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'EUR',
  owner_label text,
  probability int,
  next_step text,
  next_step_due_at timestamptz,
  at_risk boolean NOT NULL DEFAULT false,
  lost_reason text,
  won_at timestamptz,
  lost_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sales_deals_stage_check CHECK (
    stage IN (
      'new_lead',
      'qualified',
      'proposal_sent',
      'negotiation',
      'won',
      'at_risk',
      'lost'
    )
  ),
  CONSTRAINT sales_deals_probability_check CHECK (
    probability IS NULL OR (probability >= 0 AND probability <= 100)
  )
);

CREATE INDEX IF NOT EXISTS sales_deals_stage_idx ON public.sales_deals (stage);
CREATE INDEX IF NOT EXISTS sales_deals_client_id_idx ON public.sales_deals (client_id);
CREATE INDEX IF NOT EXISTS sales_deals_next_due_idx ON public.sales_deals (next_step_due_at);

CREATE TRIGGER sales_deals_set_updated_at
  BEFORE UPDATE ON public.sales_deals
  FOR EACH ROW
  EXECUTE FUNCTION public.set_clients_updated_at();

COMMENT ON TABLE public.sales_deals IS 'Sales OS: pipeline-deals; stage is canonical state.';

ALTER TABLE public.sales_leads
  ADD CONSTRAINT sales_leads_converted_deal_fk
  FOREIGN KEY (converted_deal_id) REFERENCES public.sales_deals (id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- sales_tasks
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sales_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'open',
  priority text NOT NULL DEFAULT 'normal',
  due_at timestamptz,
  owner_label text,
  linked_entity_type text NOT NULL,
  linked_entity_id uuid NOT NULL,
  source_type text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sales_tasks_status_check CHECK (status IN ('open', 'done', 'cancelled')),
  CONSTRAINT sales_tasks_priority_check CHECK (
    priority IN ('low', 'normal', 'high', 'urgent')
  ),
  CONSTRAINT sales_tasks_linked_type_check CHECK (
    linked_entity_type IN ('lead', 'deal', 'client', 'website')
  ),
  CONSTRAINT sales_tasks_source_check CHECK (
    source_type IN ('manual', 'rule', 'system')
  )
);

CREATE INDEX IF NOT EXISTS sales_tasks_status_due_idx
  ON public.sales_tasks (status, due_at);
CREATE INDEX IF NOT EXISTS sales_tasks_linked_idx
  ON public.sales_tasks (linked_entity_type, linked_entity_id);

CREATE TRIGGER sales_tasks_set_updated_at
  BEFORE UPDATE ON public.sales_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.set_clients_updated_at();

COMMENT ON TABLE public.sales_tasks IS 'Sales OS: uitvoerbare taken; website = client_id.';

-- ---------------------------------------------------------------------------
-- website_ops_state (één rij per client)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.website_ops_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients (id) ON DELETE CASCADE,
  ops_status text NOT NULL DEFAULT 'briefing',
  review_status text NOT NULL DEFAULT 'none',
  blocker_status text NOT NULL DEFAULT 'none',
  blocker_reason text,
  quality_score int,
  content_completeness int,
  media_completeness int,
  publish_ready boolean NOT NULL DEFAULT false,
  last_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT website_ops_state_unique_client UNIQUE (client_id),
  CONSTRAINT website_ops_ops_status_check CHECK (
    ops_status IN ('briefing', 'generating', 'review', 'revisions', 'ready', 'live')
  ),
  CONSTRAINT website_ops_review_check CHECK (
    review_status IN ('none', 'pending', 'approved', 'changes_requested')
  ),
  CONSTRAINT website_ops_blocker_check CHECK (
    blocker_status IN ('none', 'content', 'media', 'technical', 'billing', 'other')
  ),
  CONSTRAINT website_ops_scores_check CHECK (
    (quality_score IS NULL OR (quality_score >= 0 AND quality_score <= 100))
    AND (content_completeness IS NULL OR (content_completeness >= 0 AND content_completeness <= 100))
    AND (media_completeness IS NULL OR (media_completeness >= 0 AND media_completeness <= 100))
  )
);

CREATE INDEX IF NOT EXISTS website_ops_state_ops_status_idx ON public.website_ops_state (ops_status);

CREATE TRIGGER website_ops_state_set_updated_at
  BEFORE UPDATE ON public.website_ops_state
  FOR EACH ROW
  EXECUTE FUNCTION public.set_clients_updated_at();

COMMENT ON TABLE public.website_ops_state IS 'Sales OS: leveringsstatus site per klant (los van clients.status).';

-- Init website_ops_state voor bestaande clients
INSERT INTO public.website_ops_state (client_id, ops_status, review_status, publish_ready)
SELECT
  c.id,
  CASE
    WHEN c.status = 'active' THEN 'live'
    WHEN c.draft_snapshot_id IS NOT NULL THEN 'review'
    ELSE 'briefing'
  END,
  CASE
    WHEN c.draft_snapshot_id IS NOT NULL AND c.status <> 'active' THEN 'pending'
    ELSE 'none'
  END,
  c.status = 'active' AND c.published_snapshot_id IS NOT NULL
FROM public.clients c
WHERE NOT EXISTS (SELECT 1 FROM public.website_ops_state w WHERE w.client_id = c.id);

-- Nieuwe client → website_ops_state
CREATE OR REPLACE FUNCTION public.ensure_website_ops_state_for_client()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.website_ops_state (client_id, ops_status)
  VALUES (NEW.id, 'briefing')
  ON CONFLICT (client_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS clients_ensure_website_ops ON public.clients;
CREATE TRIGGER clients_ensure_website_ops
  AFTER INSERT ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_website_ops_state_for_client();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.sales_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.website_ops_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sales_leads_select_authenticated" ON public.sales_leads FOR SELECT TO authenticated USING (true);
CREATE POLICY "sales_leads_insert_authenticated" ON public.sales_leads FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "sales_leads_update_authenticated" ON public.sales_leads FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "sales_leads_delete_authenticated" ON public.sales_leads FOR DELETE TO authenticated USING (true);

CREATE POLICY "sales_deals_select_authenticated" ON public.sales_deals FOR SELECT TO authenticated USING (true);
CREATE POLICY "sales_deals_insert_authenticated" ON public.sales_deals FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "sales_deals_update_authenticated" ON public.sales_deals FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "sales_deals_delete_authenticated" ON public.sales_deals FOR DELETE TO authenticated USING (true);

CREATE POLICY "sales_tasks_select_authenticated" ON public.sales_tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "sales_tasks_insert_authenticated" ON public.sales_tasks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "sales_tasks_update_authenticated" ON public.sales_tasks FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "sales_tasks_delete_authenticated" ON public.sales_tasks FOR DELETE TO authenticated USING (true);

CREATE POLICY "website_ops_state_select_authenticated" ON public.website_ops_state FOR SELECT TO authenticated USING (true);
CREATE POLICY "website_ops_state_insert_authenticated" ON public.website_ops_state FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "website_ops_state_update_authenticated" ON public.website_ops_state FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "website_ops_state_delete_authenticated" ON public.website_ops_state FOR DELETE TO authenticated USING (true);

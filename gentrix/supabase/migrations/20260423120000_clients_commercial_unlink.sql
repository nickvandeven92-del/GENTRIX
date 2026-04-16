-- Los commercieel dossier van een klant van de technische site-tenant.
-- Site (subfolder_slug, site_data_json, snapshots, status, domein) blijft bestaan
-- zodat later opnieuw commerciële gegevens gekoppeld kunnen worden.

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS commercial_unlinked_at timestamptz;

COMMENT ON COLUMN public.clients.commercial_unlinked_at IS
  'Indien gezet: geen actief commercieel dossier meer; rij blijft bestaan als website-tenant.';

CREATE INDEX IF NOT EXISTS clients_commercial_unlinked_at_idx
  ON public.clients (commercial_unlinked_at)
  WHERE commercial_unlinked_at IS NOT NULL;

-- ---------------------------------------------------------------------------
-- unlink_client_commercial_keep_site
-- Verwijdert facturen/offertes/boekingen/portaal/dossier e.d.; wist commerciële
-- kolommen op clients; laat site_snapshots, site_generation_runs, website_ops_state staan.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.unlink_client_commercial_keep_site(p_subfolder_slug text)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_id uuid;
  v_slug text;
BEGIN
  v_slug := trim(p_subfolder_slug);
  IF v_slug IS NULL OR v_slug = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'empty_slug');
  END IF;

  SELECT id INTO v_id FROM public.clients WHERE subfolder_slug = v_slug;
  IF v_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF EXISTS (SELECT 1 FROM public.clients WHERE id = v_id AND commercial_unlinked_at IS NOT NULL) THEN
    RETURN jsonb_build_object('ok', true, 'subfolder_slug', v_slug, 'already_unlinked', true);
  END IF;

  DELETE FROM public.client_staff_shifts WHERE client_id = v_id;
  DELETE FROM public.client_staff WHERE client_id = v_id;
  DELETE FROM public.client_appointments WHERE client_id = v_id;
  DELETE FROM public.client_booking_services WHERE client_id = v_id;

  DELETE FROM public.invoices WHERE client_id = v_id;
  DELETE FROM public.quotes WHERE client_id = v_id;

  DELETE FROM public.client_dossier_notes WHERE client_id = v_id;
  DELETE FROM public.portal_push_subscriptions WHERE client_id = v_id;
  DELETE FROM public.flyer_scans WHERE client_id = v_id;
  DELETE FROM public.site_generation_jobs WHERE client_id = v_id;

  DELETE FROM public.sales_tasks
  WHERE linked_entity_type IN ('client', 'website')
    AND linked_entity_id = v_id;

  UPDATE public.sales_deals SET client_id = NULL WHERE client_id = v_id;

  UPDATE public.clients
  SET
    name = 'Losse website (' || v_slug || ')',
    description = NULL,
    billing_email = NULL,
    phone = NULL,
    contact_name = NULL,
    company_legal_name = NULL,
    contact_name = NULL,
    vat_number = NULL,
    billing_address = NULL,
    billing_postal_code = NULL,
    billing_city = NULL,
    plan_type = NULL,
    plan_label = NULL,
    payment_status = 'none',
    payment_provider = NULL,
    payment_reference = NULL,
    subscription_renews_at = NULL,
    delivered_at = NULL,
    contract_accepted_at = NULL,
    internal_notes = NULL,
    pipeline_stage = 'lead',
    portal_user_id = NULL,
    portal_invoices_enabled = false,
    portal_account_enabled = false,
    appointments_enabled = false,
    webshop_enabled = false,
    booking_settings = NULL,
    subscription_cancel_at_period_end = false,
    subscription_cancel_requested_at = NULL,
    client_number = 'WEB-' || REPLACE(v_id::text, '-', ''),
    commercial_unlinked_at = now(),
    updated_at = now()
  WHERE id = v_id;

  RETURN jsonb_build_object('ok', true, 'subfolder_slug', v_slug, 'client_id', v_id);
END;
$$;

COMMENT ON FUNCTION public.unlink_client_commercial_keep_site(text) IS
  'Admin: commercieel dossier wissen, website-tenant + inhoud behouden.';

GRANT EXECUTE ON FUNCTION public.unlink_client_commercial_keep_site(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unlink_client_commercial_keep_site(text) TO service_role;

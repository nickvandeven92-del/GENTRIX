-- Uitbreiding documentflow: volledige snapshots, offerte-inhoud, koppeling offerte→conceptfactuur.
-- RLS blijft authenticated=true (admin); strakker beleid kan later.

-- Bronvelden op klant (optioneel invulbaar in CRM)
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS contact_name text,
  ADD COLUMN IF NOT EXISTS billing_postal_code text,
  ADD COLUMN IF NOT EXISTS billing_city text;

COMMENT ON COLUMN public.clients.contact_name IS 'Contactpersoon voor facturatie/offertes';
COMMENT ON COLUMN public.clients.billing_postal_code IS 'Factuur postcode';
COMMENT ON COLUMN public.clients.billing_city IS 'Factuur plaats';

-- Factuur: extra snapshots + herkomst offerte (idempotent bij acceptatie)
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS contact_name_snapshot text,
  ADD COLUMN IF NOT EXISTS billing_phone_snapshot text,
  ADD COLUMN IF NOT EXISTS billing_postal_code_snapshot text,
  ADD COLUMN IF NOT EXISTS billing_city_snapshot text,
  ADD COLUMN IF NOT EXISTS origin_quote_id uuid REFERENCES public.quotes (id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS invoices_origin_quote_id_unique ON public.invoices (origin_quote_id)
  WHERE origin_quote_id IS NOT NULL;

COMMENT ON COLUMN public.invoices.origin_quote_id IS 'Indien gezet: conceptfactuur automatisch aangemaakt bij acceptatie van deze offerte';

-- Offerte: inhoudssecties + volledige snapshots
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS intro_text text,
  ADD COLUMN IF NOT EXISTS scope_text text,
  ADD COLUMN IF NOT EXISTS delivery_text text,
  ADD COLUMN IF NOT EXISTS exclusions_text text,
  ADD COLUMN IF NOT EXISTS terms_text text,
  ADD COLUMN IF NOT EXISTS contact_name_snapshot text,
  ADD COLUMN IF NOT EXISTS billing_phone_snapshot text,
  ADD COLUMN IF NOT EXISTS billing_postal_code_snapshot text,
  ADD COLUMN IF NOT EXISTS billing_city_snapshot text;

-- Backfill snapshots vanuit clients (nieuwe kolommen)
UPDATE public.invoices i
SET
  contact_name_snapshot = COALESCE(i.contact_name_snapshot, c.contact_name),
  billing_phone_snapshot = COALESCE(i.billing_phone_snapshot, c.phone),
  billing_postal_code_snapshot = COALESCE(i.billing_postal_code_snapshot, c.billing_postal_code),
  billing_city_snapshot = COALESCE(i.billing_city_snapshot, c.billing_city)
FROM public.clients c
WHERE i.client_id = c.id;

UPDATE public.quotes q
SET
  contact_name_snapshot = COALESCE(q.contact_name_snapshot, c.contact_name),
  billing_phone_snapshot = COALESCE(q.billing_phone_snapshot, c.phone),
  billing_postal_code_snapshot = COALESCE(q.billing_postal_code_snapshot, c.billing_postal_code),
  billing_city_snapshot = COALESCE(q.billing_city_snapshot, c.billing_city)
FROM public.clients c
WHERE q.client_id = c.id;

COMMENT ON TABLE public.invoices IS
  'Facturen + documentflow. RLS: voorlopig alle authenticated users; aanscherpen naar admin-only wanneer rollen beschikbaar zijn.';
COMMENT ON TABLE public.quotes IS
  'Offertes + inhoud. RLS: zelfde patroon als invoices.';

-- Categorieën van diensten (bv. "Knippen", "Styling", "Baard")
CREATE TABLE IF NOT EXISTS service_categories (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_service_categories_business ON service_categories(business_id);

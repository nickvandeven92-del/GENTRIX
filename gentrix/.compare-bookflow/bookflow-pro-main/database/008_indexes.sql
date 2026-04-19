-- Extra indexen voor veelvoorkomende queries

-- Beschikbaarheid berekenen: snel alle bevestigde afspraken voor een medewerker op een dag vinden
CREATE INDEX IF NOT EXISTS idx_appointments_available_lookup
  ON appointments(employee_id, date, status)
  WHERE status IN ('confirmed', 'pending');

-- Klant terugzoeken op email of telefoon
CREATE INDEX IF NOT EXISTS idx_appointments_customer_email ON appointments(customer_email);
CREATE INDEX IF NOT EXISTS idx_appointments_customer_phone ON appointments(customer_phone);

-- Auto-update van updated_at kolom
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY['businesses','services','employees','appointments']) LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_updated_at ON %I', t, t);
    EXECUTE format('CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()', t, t);
  END LOOP;
END $$;

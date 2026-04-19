-- VOORBEELD: Row Level Security policies.
-- Activeer dit pas wanneer je auth hebt gekoppeld (bv. Supabase Auth).
-- Verwacht een tabel `business_members(user_id uuid, business_id uuid, role text)`.

-- ALTER TABLE businesses          ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE service_categories  ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE services            ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE employees           ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE service_employees   ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE appointments        ENABLE ROW LEVEL SECURITY;

-- Helper functie: is gebruiker lid van het bedrijf?
-- CREATE OR REPLACE FUNCTION is_business_member(_business_id uuid)
-- RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
--   SELECT EXISTS (
--     SELECT 1 FROM business_members
--     WHERE business_id = _business_id AND user_id = auth.uid()
--   );
-- $$;

-- Voorbeeldpolicies (alleen leden zien/wijzigen data van hun bedrijf):
-- CREATE POLICY "members read services"  ON services    FOR SELECT USING (is_business_member(business_id));
-- CREATE POLICY "members write services" ON services    FOR ALL    USING (is_business_member(business_id)) WITH CHECK (is_business_member(business_id));

-- Publieke boekingsflow: iedereen mag actieve diensten/medewerkers zien en afspraken aanmaken
-- CREATE POLICY "public read active services"  ON services  FOR SELECT USING (active = true);
-- CREATE POLICY "public read active employees" ON employees FOR SELECT USING (active = true);
-- CREATE POLICY "public create appointments"   ON appointments FOR INSERT WITH CHECK (true);

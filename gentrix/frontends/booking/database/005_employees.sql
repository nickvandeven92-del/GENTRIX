-- Medewerkers
CREATE TABLE IF NOT EXISTS employees (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  avatar          TEXT,
  role            TEXT NOT NULL DEFAULT '',
  specialization  TEXT NOT NULL DEFAULT '',
  active          BOOLEAN NOT NULL DEFAULT true,

  -- WeekSchedule (zelfde vorm als business.settings.openingHours)
  schedule        JSONB NOT NULL DEFAULT jsonb_build_object(
    'monday',    jsonb_build_object('enabled', true,  'blocks', jsonb_build_array(jsonb_build_object('start','09:00','end','17:00'))),
    'tuesday',   jsonb_build_object('enabled', true,  'blocks', jsonb_build_array(jsonb_build_object('start','09:00','end','17:00'))),
    'wednesday', jsonb_build_object('enabled', true,  'blocks', jsonb_build_array(jsonb_build_object('start','09:00','end','17:00'))),
    'thursday',  jsonb_build_object('enabled', true,  'blocks', jsonb_build_array(jsonb_build_object('start','09:00','end','17:00'))),
    'friday',    jsonb_build_object('enabled', true,  'blocks', jsonb_build_array(jsonb_build_object('start','09:00','end','17:00'))),
    'saturday',  jsonb_build_object('enabled', false, 'blocks', jsonb_build_array()),
    'sunday',    jsonb_build_object('enabled', false, 'blocks', jsonb_build_array())
  ),

  -- EmployeeBreak[]: [{ id, label, day: "monday"|"all", start, end }]
  breaks          JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- DayOff[]: [{ id, type: "vacation"|"sick"|"personal"|"blocked", startDate, endDate, reason? }]
  days_off        JSONB NOT NULL DEFAULT '[]'::jsonb,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_employees_business ON employees(business_id);
CREATE INDEX IF NOT EXISTS idx_employees_active   ON employees(business_id, active);

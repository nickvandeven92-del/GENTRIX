-- Bedrijven
CREATE TABLE IF NOT EXISTS businesses (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  slug         TEXT NOT NULL UNIQUE,
  description  TEXT NOT NULL DEFAULT '',
  industry     TEXT NOT NULL DEFAULT '',
  phone        TEXT NOT NULL DEFAULT '',
  email        TEXT NOT NULL DEFAULT '',
  address      TEXT NOT NULL DEFAULT '',

  -- BusinessSettings als JSONB. Verwachte vorm:
  -- {
  --   "slotInterval": 15,
  --   "bufferTime": 5,
  --   "maxAdvanceBookingDays": 30,
  --   "minCancelHours": 24,
  --   "showServicesPage": true,
  --   "openingHours": {
  --     "monday":    { "enabled": true, "blocks": [{ "start": "09:00", "end": "17:00" }] },
  --     "tuesday":   { ... }, ...
  --   }
  -- }
  settings     JSONB NOT NULL DEFAULT jsonb_build_object(
    'slotInterval', 15,
    'bufferTime', 5,
    'maxAdvanceBookingDays', 30,
    'minCancelHours', 24,
    'showServicesPage', true,
    'openingHours', jsonb_build_object(
      'monday',    jsonb_build_object('enabled', true,  'blocks', jsonb_build_array(jsonb_build_object('start','09:00','end','17:00'))),
      'tuesday',   jsonb_build_object('enabled', true,  'blocks', jsonb_build_array(jsonb_build_object('start','09:00','end','17:00'))),
      'wednesday', jsonb_build_object('enabled', true,  'blocks', jsonb_build_array(jsonb_build_object('start','09:00','end','17:00'))),
      'thursday',  jsonb_build_object('enabled', true,  'blocks', jsonb_build_array(jsonb_build_object('start','09:00','end','17:00'))),
      'friday',    jsonb_build_object('enabled', true,  'blocks', jsonb_build_array(jsonb_build_object('start','09:00','end','17:00'))),
      'saturday',  jsonb_build_object('enabled', true,  'blocks', jsonb_build_array(jsonb_build_object('start','10:00','end','15:00'))),
      'sunday',    jsonb_build_object('enabled', false, 'blocks', jsonb_build_array())
    )
  ),

  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_businesses_slug ON businesses(slug);

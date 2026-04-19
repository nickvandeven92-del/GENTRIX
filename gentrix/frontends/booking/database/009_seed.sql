-- Voorbeelddata: Studio Knipt (kapsalon) + Mindset Coaching
-- Komt overeen met src/data/mockData.ts

BEGIN;

-- ========== STUDIO KNIPT ==========
WITH biz AS (
  INSERT INTO businesses (name, slug, description, industry, phone, email, address, settings)
  VALUES (
    'Studio Knipt', 'studio-knipt',
    'Moderne kapsalon in het hart van Amsterdam',
    'Kapsalon', '020-1234567', 'info@studioknipt.nl',
    'Keizersgracht 123, Amsterdam',
    jsonb_build_object(
      'slotInterval', 15, 'bufferTime', 5,
      'maxAdvanceBookingDays', 30, 'minCancelHours', 24,
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
    )
  )
  RETURNING id
),
cats AS (
  INSERT INTO service_categories (business_id, name)
  SELECT biz.id, c.name FROM biz, (VALUES ('Knippen'),('Styling'),('Baard')) AS c(name)
  RETURNING id, name
),
svcs AS (
  INSERT INTO services (business_id, category_id, name, description, duration, price, color, active)
  SELECT biz.id, (SELECT id FROM cats WHERE name = s.cat), s.name, s.descr, s.dur, s.price, s.color, true
  FROM biz, (VALUES
    ('Knippen',  'Knippen heren',     'Knipbeurt inclusief wassen en stylen',           30, 32.50, '#0d9488'),
    ('Knippen',  'Knippen dames',     'Knipbeurt inclusief wassen, knippen en föhnen', 45, 45.00, '#0891b2'),
    ('Knippen',  'Knippen kinderen',  'Knipbeurt voor kinderen t/m 12 jaar',            20, 19.50, '#6366f1'),
    ('Baard',    'Baard trimmen',     'Professioneel baard trimmen en shapen',          20, 18.00, '#d97706'),
    ('Styling',  'Contouren',         'Contouren bijwerken met tondeuse',               15, 15.00, '#059669'),
    ('Knippen',  'Knippen + baard',   'Combi: knippen en baard trimmen',                45, 45.00, '#dc2626')
  ) AS s(cat, name, descr, dur, price, color)
  RETURNING id, name
),
emps AS (
  INSERT INTO employees (business_id, name, role, specialization, schedule, breaks, days_off)
  SELECT biz.id, e.name, e.role, e.spec, e.schedule::jsonb, e.breaks::jsonb, e.days_off::jsonb FROM biz, (VALUES
    (
      'Mohammed El Amrani', 'Senior Kapper', 'Heren & Baard',
      '{"monday":{"enabled":true,"blocks":[{"start":"09:00","end":"17:00"}]},"tuesday":{"enabled":true,"blocks":[{"start":"09:00","end":"17:00"}]},"wednesday":{"enabled":false,"blocks":[]},"thursday":{"enabled":true,"blocks":[{"start":"09:00","end":"17:00"}]},"friday":{"enabled":true,"blocks":[{"start":"09:00","end":"17:00"}]},"saturday":{"enabled":true,"blocks":[{"start":"10:00","end":"15:00"}]},"sunday":{"enabled":false,"blocks":[]}}',
      '[{"id":"brk-k1","label":"Lunch","day":"all","start":"12:30","end":"13:00"}]',
      '[{"id":"off-k1","type":"vacation","startDate":"2026-04-20","endDate":"2026-04-24","reason":"Vakantie"}]'
    ),
    (
      'Sophie de Vries', 'Stylist', 'Dames & Kinderen',
      '{"monday":{"enabled":true,"blocks":[{"start":"09:00","end":"17:00"}]},"tuesday":{"enabled":true,"blocks":[{"start":"09:00","end":"17:00"}]},"wednesday":{"enabled":true,"blocks":[{"start":"09:00","end":"17:00"}]},"thursday":{"enabled":true,"blocks":[{"start":"09:00","end":"17:00"}]},"friday":{"enabled":true,"blocks":[{"start":"09:00","end":"17:00"}]},"saturday":{"enabled":true,"blocks":[{"start":"10:00","end":"15:00"}]},"sunday":{"enabled":false,"blocks":[]}}',
      '[{"id":"brk-k2","label":"Lunch","day":"all","start":"12:00","end":"12:30"},{"id":"brk-k3","label":"Pauze","day":"all","start":"15:00","end":"15:15"}]',
      '[]'
    ),
    (
      'Daan Jansen', 'Junior Kapper', 'Heren',
      '{"monday":{"enabled":true,"blocks":[{"start":"09:00","end":"17:00"}]},"tuesday":{"enabled":true,"blocks":[{"start":"09:00","end":"17:00"}]},"wednesday":{"enabled":true,"blocks":[{"start":"09:00","end":"17:00"}]},"thursday":{"enabled":true,"blocks":[{"start":"09:00","end":"17:00"}]},"friday":{"enabled":true,"blocks":[{"start":"09:00","end":"17:00"}]},"saturday":{"enabled":false,"blocks":[]},"sunday":{"enabled":false,"blocks":[]}}',
      '[{"id":"brk-k4","label":"Lunch","day":"all","start":"12:00","end":"12:45"}]',
      '[{"id":"off-k2","type":"sick","startDate":"2026-04-14","endDate":"2026-04-14","reason":"Ziek"}]'
    )
  ) AS e(name, role, spec, schedule, breaks, days_off)
  RETURNING id, name
)
-- Koppel medewerkers aan diensten
INSERT INTO service_employees (service_id, employee_id)
SELECT s.id, e.id
FROM svcs s
JOIN emps e ON (
  (s.name IN ('Knippen heren','Knippen kinderen','Contouren') AND e.name IN ('Mohammed El Amrani','Sophie de Vries','Daan Jansen')) OR
  (s.name = 'Knippen dames'   AND e.name IN ('Mohammed El Amrani','Sophie de Vries')) OR
  (s.name = 'Baard trimmen'   AND e.name IN ('Mohammed El Amrani','Daan Jansen')) OR
  (s.name = 'Knippen + baard' AND e.name IN ('Mohammed El Amrani','Daan Jansen'))
);

-- ========== MINDSET COACHING ==========
WITH biz AS (
  INSERT INTO businesses (name, slug, description, industry, phone, email, address, settings)
  VALUES (
    'Mindset Coaching', 'mindset-coaching',
    'Persoonlijke ontwikkeling & executive coaching',
    'Coaching & Consultancy', '030-7654321', 'info@mindsetcoaching.nl',
    'Maliebaan 45, Utrecht',
    jsonb_build_object(
      'slotInterval', 30, 'bufferTime', 15,
      'maxAdvanceBookingDays', 60, 'minCancelHours', 48,
      'showServicesPage', true,
      'openingHours', jsonb_build_object(
        'monday',    jsonb_build_object('enabled', true,  'blocks', jsonb_build_array(jsonb_build_object('start','08:00','end','18:00'))),
        'tuesday',   jsonb_build_object('enabled', true,  'blocks', jsonb_build_array(jsonb_build_object('start','08:00','end','18:00'))),
        'wednesday', jsonb_build_object('enabled', true,  'blocks', jsonb_build_array(jsonb_build_object('start','08:00','end','18:00'))),
        'thursday',  jsonb_build_object('enabled', true,  'blocks', jsonb_build_array(jsonb_build_object('start','08:00','end','18:00'))),
        'friday',    jsonb_build_object('enabled', true,  'blocks', jsonb_build_array(jsonb_build_object('start','08:00','end','14:00'))),
        'saturday',  jsonb_build_object('enabled', false, 'blocks', jsonb_build_array()),
        'sunday',    jsonb_build_object('enabled', false, 'blocks', jsonb_build_array())
      )
    )
  )
  RETURNING id
),
cats AS (
  INSERT INTO service_categories (business_id, name)
  SELECT biz.id, c.name FROM biz, (VALUES ('Coaching'),('Consultancy')) AS c(name)
  RETURNING id, name
),
svcs AS (
  INSERT INTO services (business_id, category_id, name, description, duration, price, color, active)
  SELECT biz.id, (SELECT id FROM cats WHERE name = s.cat), s.name, s.descr, s.dur, s.price, s.color, true
  FROM biz, (VALUES
    ('Coaching',    'Intake gesprek',      'Kennismakingsgesprek om doelen en verwachtingen te bespreken',  60,    0.00, '#0d9488'),
    ('Coaching',    'Coaching sessie',     'Vervolg coachingsgesprek',                                       90,  125.00, '#6366f1'),
    ('Coaching',    'Executive coaching',  'Coaching gericht op leiderschap en management',                 120,  250.00, '#d97706'),
    ('Consultancy', 'Team workshop',       'Groepssessie voor teams (max 8 personen)',                      180,  750.00, '#dc2626'),
    ('Consultancy', 'Loopbaanadvies',      'Eenmalig adviesgesprek over carrière',                           60,   95.00, '#059669')
  ) AS s(cat, name, descr, dur, price, color)
  RETURNING id, name
),
emps AS (
  INSERT INTO employees (business_id, name, role, specialization, schedule, breaks, days_off)
  SELECT biz.id, e.name, e.role, e.spec, e.schedule::jsonb, e.breaks::jsonb, e.days_off::jsonb FROM biz, (VALUES
    (
      'Dr. Lisa van den Berg', 'Executive Coach', 'Leiderschap & Strategie',
      '{"monday":{"enabled":true,"blocks":[{"start":"09:00","end":"17:00"}]},"tuesday":{"enabled":true,"blocks":[{"start":"09:00","end":"17:00"}]},"wednesday":{"enabled":false,"blocks":[]},"thursday":{"enabled":true,"blocks":[{"start":"09:00","end":"17:00"}]},"friday":{"enabled":true,"blocks":[{"start":"09:00","end":"13:00"}]},"saturday":{"enabled":false,"blocks":[]},"sunday":{"enabled":false,"blocks":[]}}',
      '[{"id":"brk-c1","label":"Lunch","day":"all","start":"12:30","end":"13:30"}]',
      '[]'
    ),
    (
      'Mark de Groot', 'Loopbaancoach', 'Loopbaan & Persoonlijke groei',
      '{"monday":{"enabled":true,"blocks":[{"start":"08:00","end":"16:00"}]},"tuesday":{"enabled":true,"blocks":[{"start":"08:00","end":"16:00"}]},"wednesday":{"enabled":true,"blocks":[{"start":"08:00","end":"16:00"}]},"thursday":{"enabled":true,"blocks":[{"start":"08:00","end":"16:00"}]},"friday":{"enabled":false,"blocks":[]},"saturday":{"enabled":false,"blocks":[]},"sunday":{"enabled":false,"blocks":[]}}',
      '[{"id":"brk-c2","label":"Lunch","day":"all","start":"12:00","end":"12:45"}]',
      '[{"id":"off-c1","type":"vacation","startDate":"2026-05-01","endDate":"2026-05-08","reason":"Meivakantie"}]'
    )
  ) AS e(name, role, spec, schedule, breaks, days_off)
  RETURNING id, name
)
INSERT INTO service_employees (service_id, employee_id)
SELECT s.id, e.id
FROM svcs s
JOIN emps e ON (
  (s.name IN ('Intake gesprek','Coaching sessie') AND e.name IN ('Dr. Lisa van den Berg','Mark de Groot')) OR
  (s.name IN ('Executive coaching','Team workshop') AND e.name = 'Dr. Lisa van den Berg') OR
  (s.name = 'Loopbaanadvies' AND e.name = 'Mark de Groot')
);

COMMIT;

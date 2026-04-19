-- Afspraken
CREATE TYPE appointment_status AS ENUM ('confirmed', 'pending', 'cancelled', 'completed');

CREATE TABLE IF NOT EXISTS appointments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  service_id      UUID NOT NULL REFERENCES services(id)   ON DELETE RESTRICT,
  employee_id     UUID NOT NULL REFERENCES employees(id)  ON DELETE RESTRICT,

  date            DATE NOT NULL,
  start_time      TIME NOT NULL,
  end_time        TIME NOT NULL,
  status          appointment_status NOT NULL DEFAULT 'pending',

  -- Klantgegevens (ingebed; geen aparte customers tabel)
  customer_name   TEXT NOT NULL,
  customer_email  TEXT NOT NULL,
  customer_phone  TEXT NOT NULL,
  customer_notes  TEXT,

  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS idx_appointments_business        ON appointments(business_id);
CREATE INDEX IF NOT EXISTS idx_appointments_employee_date   ON appointments(employee_id, date);
CREATE INDEX IF NOT EXISTS idx_appointments_business_date   ON appointments(business_id, date);
CREATE INDEX IF NOT EXISTS idx_appointments_status          ON appointments(status);

-- Many-to-many: welke medewerker kan welke dienst uitvoeren
CREATE TABLE IF NOT EXISTS service_employees (
  service_id   UUID NOT NULL REFERENCES services(id)  ON DELETE CASCADE,
  employee_id  UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  PRIMARY KEY (service_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_service_employees_employee ON service_employees(employee_id);

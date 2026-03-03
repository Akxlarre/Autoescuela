-- ============================================================================
-- 07 — Logística de Flota y Recursos (RF-087 a RF-091)
-- ============================================================================
-- Depende de: 01 (users, branches), 03 (instructors, class_b_sessions)
-- ============================================================================

-- ============================================================================
-- VEHICLES — Flota de vehículos (RF-087)
-- ============================================================================
CREATE TABLE IF NOT EXISTS vehicles (
  id              SERIAL PRIMARY KEY,
  license_plate   TEXT   UNIQUE NOT NULL,
  brand           TEXT   NOT NULL,
  model           TEXT   NOT NULL,
  year            SMALLINT NOT NULL,
  body_type       TEXT,                      -- 'sedan' | 'hatchback' | 'suv'
  transmission    TEXT,                      -- 'manual' | 'automatic'
  branch_id       INT    REFERENCES branches(id),
  status          TEXT,                      -- 'operational' | 'in_use' | 'maintenance' | 'out_of_service' | 'blocked'
  current_km      INTEGER DEFAULT 0,
  last_inspection DATE,
  last_maintenance DATE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE vehicles IS 'Flota de vehículos con patente, estado y kilometraje (RF-087)';

-- ============================================================================
-- VEHICLE_DOCUMENTS — Documentación de vehículos (RF-021)
-- ============================================================================
CREATE TABLE IF NOT EXISTS vehicle_documents (
  id            SERIAL PRIMARY KEY,
  vehicle_id    INT    NOT NULL REFERENCES vehicles(id),
  type          TEXT,                        -- 'soap' | 'technical_inspection' | 'circulation_permit' | 'insurance'
  issue_date    DATE,
  expiry_date   DATE   NOT NULL,
  status        TEXT,                        -- 'valid' | 'expiring_soon' | 'expired'
  file_url      TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE vehicle_documents IS 'SOAP, Rev. Técnica, Permiso Circulación, Seguro de cada vehículo (RF-021)';

-- ============================================================================
-- MAINTENANCE_RECORDS — Historial de mantenciones (RF-089)
-- ============================================================================
CREATE TABLE IF NOT EXISTS maintenance_records (
  id              SERIAL PRIMARY KEY,
  vehicle_id      INT    NOT NULL REFERENCES vehicles(id),
  type            TEXT,                      -- 'preventive' | 'corrective'
  description     TEXT   NOT NULL,
  scheduled_date  DATE,
  completed_date  DATE,
  km_at_time      INTEGER,
  workshop        TEXT,
  status          TEXT,                      -- 'scheduled' | 'in_progress' | 'completed'
  cost            INTEGER,
  registered_by   INT    REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE maintenance_records IS 'Historial y programación de mantenciones de vehículos (RF-089)';

-- ============================================================================
-- ROUTE_INCIDENTS — Incidentes en ruta (RF-111)
-- ============================================================================
CREATE TABLE IF NOT EXISTS route_incidents (
  id                  SERIAL PRIMARY KEY,
  vehicle_id          INT    NOT NULL REFERENCES vehicles(id),
  instructor_id       INT    NOT NULL REFERENCES instructors(id),
  class_b_session_id  INT    REFERENCES class_b_sessions(id),
  occurred_at         TIMESTAMPTZ,
  description         TEXT   NOT NULL,
  type                TEXT,                  -- 'accident' | 'infraction' | 'mechanical_damage' | 'other'
  evidence_url        TEXT,
  registered_by       INT    REFERENCES users(id),
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE route_incidents IS 'Incidentes asociados a vehículo e instructor durante Clase B (RF-111)';

-- ============================================================================
-- Agregar FK de vehicle_assignments y class_b_sessions a vehicles
-- (Estas tablas se crearon en 03 sin la FK porque vehicles no existía aún)
-- ============================================================================
ALTER TABLE vehicle_assignments
  ADD CONSTRAINT fk_vehicle_assignments_vehicle
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(id);

ALTER TABLE class_b_sessions
  ADD CONSTRAINT fk_class_b_sessions_vehicle
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(id);

-- ============================================================================
-- ÍNDICES — Módulo 7 (Flota)
-- ============================================================================

-- Documentos próximos a vencer (RF-021, RF-024)
CREATE INDEX IF NOT EXISTS idx_vehicle_docs_expiry
  ON vehicle_documents(expiry_date, status);

-- Solo un instructor activo por vehículo simultáneo (RF-045)
-- Ya creado en 03_academy_class_b.sql como idx_active_vehicle_assignment

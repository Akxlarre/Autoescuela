-- ============================================================================
-- Seed de desarrollo: Instructores y Vehículos para Autoescuela Chillán
-- ============================================================================
-- Este seed crea 2 instructores + 2 vehículos + 2 asignaciones activas para que
-- la vista v_class_b_schedule_availability genere slots y la Agenda Semanal
-- muestre datos reales.
--
-- ⚠️  Solo para entorno de desarrollo. No ejecutar en producción sin revisar.
-- ============================================================================

-- ── 1. Usuarios con rol instructor ──────────────────────────────────────────

INSERT INTO users (
  rut, first_names, paternal_last_name, maternal_last_name,
  email, phone, role_id, branch_id, active, first_login
)
SELECT
  data.rut,
  data.first_names,
  data.paternal_last_name,
  data.maternal_last_name,
  data.email,
  data.phone,
  (SELECT id FROM roles   WHERE name  = 'instructor')          AS role_id,
  (SELECT id FROM branches WHERE slug = 'autoescuela-chillan') AS branch_id,
  true  AS active,
  false AS first_login
FROM (VALUES
  ('11.111.111-1', 'Carlos Eduardo', 'Muñoz',   'Vega',   'carlos.munoz.inst@autoescuela.cl',   '+56 9 8123 4567'),
  ('22.222.222-2', 'Roberto Andrés', 'Soto',    'Pérez',  'roberto.soto.inst@autoescuela.cl',   '+56 9 7654 3210')
) AS data(rut, first_names, paternal_last_name, maternal_last_name, email, phone)
ON CONFLICT (rut) DO NOTHING;

-- ── 2. Fichas de instructores ────────────────────────────────────────────────

INSERT INTO instructors (user_id, type, license_number, license_class, license_status, active)
SELECT
  u.id          AS user_id,
  'both'        AS type,
  data.lic_num  AS license_number,
  'B'           AS license_class,
  'valid'       AS license_status,
  true          AS active
FROM (VALUES
  ('11.111.111-1', 'LIC-B-2021-001'),
  ('22.222.222-2', 'LIC-B-2021-002')
) AS data(rut, lic_num)
JOIN users u ON u.rut = data.rut
ON CONFLICT (user_id) DO NOTHING;

-- ── 3. Vehículos de práctica ─────────────────────────────────────────────────

INSERT INTO vehicles (license_plate, brand, model, year, transmission, body_type, branch_id, status)
SELECT
  data.plate, data.brand, data.model, data.year, 'manual', 'sedan',
  (SELECT id FROM branches WHERE slug = 'autoescuela-chillan') AS branch_id,
  'operational' AS status
FROM (VALUES
  ('BBCD12', 'Suzuki',    'Swift',  2022),
  ('XXYZ34', 'Chevrolet', 'Spark',  2021)
) AS data(plate, brand, model, year)
ON CONFLICT (license_plate) DO NOTHING;

-- ── 4. Asignaciones activas instructor ↔ vehículo (end_date IS NULL) ─────────

INSERT INTO vehicle_assignments (instructor_id, vehicle_id, start_date)
SELECT
  i.id AS instructor_id,
  v.id AS vehicle_id,
  CURRENT_DATE AS start_date
FROM (VALUES
  ('11.111.111-1', 'BBCD12'),
  ('22.222.222-2', 'XXYZ34')
) AS data(rut, plate)
JOIN users         u ON u.rut              = data.rut
JOIN instructors   i ON i.user_id          = u.id
JOIN vehicles      v ON v.license_plate    = data.plate
-- Idempotente: no insertar si ya existe una asignación activa para este instructor
WHERE NOT EXISTS (
  SELECT 1
  FROM vehicle_assignments va
  WHERE va.instructor_id = i.id
    AND va.end_date IS NULL
);

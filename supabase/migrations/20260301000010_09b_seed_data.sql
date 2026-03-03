-- ============================================================================
-- 09b — Datos semilla obligatorios
-- ============================================================================
-- Ejecutar DESPUÉS de 09_enable_rls.sql y ANTES de 10_rls_policies.sql.
-- Estos registros son requeridos para que el sistema funcione correctamente.
-- ============================================================================

-- ============================================================================
-- ROLES (RF-005) — Los 4 roles del sistema
-- ============================================================================
INSERT INTO roles (name, description) VALUES
  ('admin',      'Administrador del sistema'),
  ('secretary',  'Secretaria de sede'),
  ('instructor', 'Instructor de Clase B'),
  ('student',    'Alumno matriculado')
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- BRANCHES (RF-012) — Las 2 sedes oficiales
-- ============================================================================
INSERT INTO branches (name, slug, address, phone, email) VALUES
  ('Autoescuela Chillán',   'autoescuela-chillan',   'Dirección Autoescuela Chillán',   '+56 42 000 0001', 'contacto@autoescuela-chillan.cl'),
  ('Conductores Chillán',   'conductores-chillan',   'Dirección Conductores Chillán',   '+56 42 000 0002', 'contacto@conductores-chillan.cl')
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- COURSES (RF-012) — Catálogo base de cursos por sede
-- ============================================================================
INSERT INTO courses (code, name, type, duration_weeks, practical_hours, theory_hours, base_price, license_class, branch_id) VALUES
  -- Clase B (Autoescuela Chillán)
  ('class_b',       'Clase B',              'class_b',      8,  18.0, 12.0, 350000, 'B',  (SELECT id FROM branches WHERE slug = 'autoescuela-chillan')),
  ('class_b_sence', 'Clase B SENCE',        'class_b',      8,  18.0, 12.0, 350000, 'B',  (SELECT id FROM branches WHERE slug = 'autoescuela-chillan')),
  -- Profesional (Conductores Chillán)
  ('professional_a2', 'Profesional A2',     'professional', 5,  60.0, 40.0, 800000, 'A2', (SELECT id FROM branches WHERE slug = 'conductores-chillan')),
  ('professional_a3', 'Profesional A3',     'professional', 5,  60.0, 40.0, 800000, 'A3', (SELECT id FROM branches WHERE slug = 'conductores-chillan')),
  ('professional_a4', 'Profesional A4',     'professional', 5,  60.0, 40.0, 800000, 'A4', (SELECT id FROM branches WHERE slug = 'conductores-chillan')),
  ('professional_a5', 'Profesional A5',     'professional', 5,  60.0, 40.0, 800000, 'A5', (SELECT id FROM branches WHERE slug = 'conductores-chillan'))
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- 01 — Módulo Base: Sedes, Roles, Usuarios, Alumnos, Cursos y Códigos SENCE
-- ============================================================================
-- Ejecutar PRIMERO. Todas las demás tablas dependen de estas entidades.
-- Compatible con Supabase (PostgreSQL 15+).
-- ============================================================================

-- Extensión para UUID (Supabase ya la tiene, pero por si acaso)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- BRANCHES — Sedes físicas (RF-012)
-- ============================================================================
CREATE TABLE IF NOT EXISTS branches (
  id            SERIAL PRIMARY KEY,
  name          TEXT    NOT NULL,           -- "Autoescuela Chillán" | "Conductores Chillán"
  slug          TEXT    UNIQUE,             -- "autoescuela-chillan" | "conductores-chillan"
  address       TEXT,
  phone         TEXT,
  email         TEXT,
  active        BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE branches IS 'Sedes físicas de la escuela de conductores (RF-012)';

-- ============================================================================
-- ROLES — Catálogo de roles con permisos (RF-005)
-- ============================================================================
CREATE TABLE IF NOT EXISTS roles (
  id            SERIAL PRIMARY KEY,
  name          TEXT    UNIQUE NOT NULL,    -- 'admin' | 'secretary' | 'instructor' | 'student'
  description   TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE roles IS 'Catálogo de roles del sistema con permisos granulares (RF-005)';

-- ============================================================================
-- USERS — Todos los actores del sistema (RF-001)
-- ============================================================================
-- Incluye cuentas temporales de pre-inscripción pública (role_id = NULL, active = false).
-- Al convertir a matrícula: role_id → student, active = true, first_login = true.
CREATE TABLE IF NOT EXISTS users (
  id                      SERIAL PRIMARY KEY,
  supabase_uid            UUID   UNIQUE,                  -- UID en auth.users (Supabase)
  rut                     TEXT   UNIQUE NOT NULL,          -- RUT chileno validado (RF-002)
  first_names             TEXT   NOT NULL,
  paternal_last_name      TEXT   NOT NULL,
  maternal_last_name      TEXT   NOT NULL,
  email                   TEXT   UNIQUE NOT NULL,
  phone                   TEXT,
  role_id                 INT    REFERENCES roles(id),     -- NULL = cuenta temporal pre-inscripción
  branch_id               INT    REFERENCES branches(id),  -- NULL mientras es cuenta temporal
  can_access_both_branches BOOLEAN DEFAULT false,           -- RF-013
  active                  BOOLEAN DEFAULT true,             -- false = cuenta temporal o desactivado
  first_login             BOOLEAN DEFAULT true,             -- RF-015: forzar cambio contraseña
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE users IS 'Todos los actores del sistema, incluyendo cuentas temporales de pre-inscripción (RF-001)';

-- ============================================================================
-- LOGIN_ATTEMPTS — Registro anti-brute-force (RF-014)
-- ============================================================================
CREATE TABLE IF NOT EXISTS login_attempts (
  id            SERIAL PRIMARY KEY,
  email         TEXT    NOT NULL,
  ip            TEXT,
  successful    BOOLEAN,
  user_id       INT     REFERENCES users(id),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE login_attempts IS 'Historial de intentos de login para detección de fuerza bruta (RF-014)';

-- ============================================================================
-- STUDENTS — Extensión de users con datos académicos (RF-006, RF-082)
-- ============================================================================
CREATE TABLE IF NOT EXISTS students (
  id                      SERIAL PRIMARY KEY,
  user_id                 INT    NOT NULL UNIQUE REFERENCES users(id),
  birth_date              DATE   NOT NULL,
  gender                  CHAR(1),                  -- 'M' | 'F'
  address                 TEXT,
  region                  TEXT,
  district                TEXT,
  is_minor                BOOLEAN,                  -- edad == 17, requiere notarial (RF-082.1)
  has_notarial_auth       BOOLEAN DEFAULT false,
  -- RF-062, RF-063: datos de licencia previa para validación de cadena (Clase Profesional)
  current_license_class   TEXT,                      -- 'B' | 'A2' | 'A3' | 'A4'
  license_obtained_date   DATE,                      -- fecha de obtención (antigüedad ≥ 2 años)
  status                  TEXT,                      -- 'active' | 'pending' | 'inactive' | 'graduated'
  created_at              TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE students IS 'Datos académicos y de licencia del alumno (RF-006, RF-082)';

-- Constraint: edad mínima 17 años (RF-082)
ALTER TABLE students ADD CONSTRAINT chk_minimum_age
  CHECK (birth_date <= CURRENT_DATE - INTERVAL '17 years');

-- ============================================================================
-- COURSES — Catálogo de cursos por sede (RF-012)
-- ============================================================================
CREATE TABLE IF NOT EXISTS courses (
  id              SERIAL PRIMARY KEY,
  code            TEXT    UNIQUE,              -- 'class_b' | 'class_b_sence' | 'professional_a2' | etc.
  name            TEXT    NOT NULL,
  type            TEXT,                        -- 'class_b' | 'professional'
  duration_weeks  INT,                         -- 8 para B, 4-5 para profesional (~30 días)
  practical_hours NUMERIC(5,1),
  theory_hours    NUMERIC(5,1),
  base_price      INTEGER,                     -- en CLP
  license_class   TEXT,                        -- 'B' | 'A2' | 'A3' | 'A4' | 'A5'
  branch_id       INT    REFERENCES branches(id),
  active          BOOLEAN DEFAULT true
);

COMMENT ON TABLE courses IS 'Catálogo de cursos ofrecidos por sede: Clase B y Profesional (RF-012)';

-- ============================================================================
-- SENCE_CODES — Códigos SENCE asociados a cursos con franquicia tributaria
-- ============================================================================
CREATE TABLE IF NOT EXISTS sence_codes (
  id            SERIAL PRIMARY KEY,
  code          TEXT    UNIQUE NOT NULL,
  description   TEXT,
  course_id     INT    REFERENCES courses(id),
  valid         BOOLEAN DEFAULT true,
  start_date    DATE,
  end_date      DATE
);

COMMENT ON TABLE sence_codes IS 'Códigos SENCE para cursos con franquicia tributaria';

-- ============================================================================
-- AUDIT_LOG — Historial inmutable de acciones (RF-009, RF-010)
-- ============================================================================
CREATE TABLE IF NOT EXISTS audit_log (
  id            SERIAL PRIMARY KEY,
  user_id       INT    REFERENCES users(id),
  action        TEXT   NOT NULL,
  entity        TEXT,
  entity_id     INT,
  detail        TEXT,
  ip            TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE audit_log IS 'Historial inmutable de acciones del sistema (RF-009, RF-010). Sin updated_at.';

-- ============================================================================
-- SCHOOL_SCHEDULES — Horarios de operación por sede (RF-095)
-- ============================================================================
CREATE TABLE IF NOT EXISTS school_schedules (
  id              SERIAL PRIMARY KEY,
  branch_id       INT      REFERENCES branches(id),
  day_of_week     SMALLINT,            -- 1=Lun, 2=Mar, 3=Mié, 4=Jue, 5=Vie, 6=Sáb, 7=Dom
  opening_time    TIME,                -- 08:00
  closing_time    TIME,                -- 20:00 (L-V) | 13:00 (Sáb) | NULL (Dom)
  active          BOOLEAN DEFAULT true,  -- Domingo (7): active = false (CERRADO)

  CONSTRAINT chk_day_of_week CHECK (day_of_week BETWEEN 1 AND 7)
);

COMMENT ON TABLE school_schedules IS 'Horarios de operación por sede y día de semana (RF-095)';

-- ============================================================================
-- SECRETARY_OBSERVATIONS — Bitácora interna secretaria → admin
-- ============================================================================
CREATE TABLE IF NOT EXISTS secretary_observations (
  id            SERIAL PRIMARY KEY,
  type          TEXT   NOT NULL,               -- 'observation' | 'reminder' | 'urgent'
  message       TEXT   NOT NULL,
  due_date      DATE,                          -- fecha límite para recordatorios
  created_by    INT    NOT NULL REFERENCES users(id),  -- siempre rol = secretaria
  status        TEXT   DEFAULT 'pending',       -- 'pending' | 'seen' | 'resolved'
  admin_reply   TEXT,                           -- respuesta del admin
  seen_by       INT    REFERENCES users(id),
  seen_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE secretary_observations IS 'Bitácora interna: observaciones de secretaria dirigidas al admin';

-- ============================================================================
-- ÍNDICES — Módulo 1
-- ============================================================================

-- Búsqueda frecuente por RUT (RF-081) — ya cubierto por UNIQUE en users.rut
CREATE INDEX IF NOT EXISTS idx_audit_log_time ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id, created_at DESC);

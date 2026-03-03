-- ============================================================================
-- 03 — Gestión Académica Clase B (RF-041 a RF-057)
-- ============================================================================
-- Exclusivo de Autoescuela Chillán.
-- Depende de: 01 (users, students, branches), 02 (enrollments), 07 (vehicles)
-- NOTA: vehicles se crea en 07. Si ejecutas en orden estricto, ejecuta 07 ANTES
--       de este archivo, o usa las sentencias ALTER TABLE al final para las FK a vehicles.
-- ============================================================================

-- ============================================================================
-- INSTRUCTORS — Ficha de instructores Clase B (RF-041, RF-042)
-- ============================================================================
CREATE TABLE IF NOT EXISTS instructors (
  id                    SERIAL PRIMARY KEY,
  user_id               INT    NOT NULL UNIQUE REFERENCES users(id),
  type                  TEXT,                    -- 'theory' | 'practice' | 'both'
  -- RF-041: Licencia
  license_number        TEXT,
  license_class         TEXT,                    -- 'B'
  license_expiry        DATE,
  license_status        TEXT,                    -- 'valid' | 'expiring_soon' | 'expired'
  -- Disponibilidad
  available_days        INT[],                   -- [1,2,3,4,5]
  available_from        TIME,
  available_until       TIME,
  -- Control
  active_classes_count  INT    DEFAULT 0,        -- RF-043
  active                BOOLEAN DEFAULT true,
  registration_date     DATE
);

COMMENT ON TABLE instructors IS 'Instructores de Clase B con licencia, disponibilidad y control de clases (RF-041)';

-- ============================================================================
-- VEHICLE_ASSIGNMENTS — Historial instructor ↔ vehículo (RF-042, RF-045)
-- ============================================================================
-- Nota: vehicles.id se referencia aquí. La tabla vehicles se crea en 07_vehicles_and_fleet.sql.
-- Si ejecutas archivos en orden numérico, asegúrate de ejecutar 07 antes o después agregar FK.
CREATE TABLE IF NOT EXISTS vehicle_assignments (
  id              SERIAL PRIMARY KEY,
  instructor_id   INT    NOT NULL REFERENCES instructors(id),
  vehicle_id      INT    NOT NULL, -- FK a vehicles(id) se agrega en 07 o al final
  start_date      DATE   NOT NULL,
  end_date        DATE,            -- NULL = asignación activa
  assigned_by     INT    REFERENCES users(id),
  reason          TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE vehicle_assignments IS 'Historial de asignación instructor ↔ vehículo (RF-042, RF-045)';

-- ============================================================================
-- INSTRUCTOR_REPLACEMENTS — Sustitución de instructores (RF-044)
-- ============================================================================
CREATE TABLE IF NOT EXISTS instructor_replacements (
  id                          SERIAL PRIMARY KEY,
  absent_instructor_id        INT    NOT NULL REFERENCES instructors(id),
  replacement_instructor_id   INT    NOT NULL REFERENCES instructors(id),
  date                        DATE   NOT NULL,
  reason                      TEXT   NOT NULL,
  affected_classes            INT[], -- array de class_b_sessions.id (RF-044)
  registered_by               INT    REFERENCES users(id),
  created_at                  TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE instructor_replacements IS 'Registro de sustituciones de instructores con motivo y clases afectadas (RF-044)';

-- ============================================================================
-- INSTRUCTOR_MONTHLY_HOURS — Horas mensuales por instructor (RF-047)
-- ============================================================================
CREATE TABLE IF NOT EXISTS instructor_monthly_hours (
  id                  SERIAL PRIMARY KEY,
  instructor_id       INT    NOT NULL REFERENCES instructors(id),
  period              TEXT   NOT NULL,       -- "2026-02"
  theory_hours        NUMERIC(6,1) DEFAULT 0,
  practical_sessions  INTEGER DEFAULT 0,
  total_equivalent    NUMERIC(6,1),          -- theory + (practical × 1.5)
  UNIQUE(instructor_id, period)
);

COMMENT ON TABLE instructor_monthly_hours IS 'Cálculo de horas teóricas + prácticas (×1.5) por mes por instructor (RF-047)';

-- ============================================================================
-- CLASS_B_SESSIONS — Sesiones prácticas individuales (RF-046, RF-048, RF-049)
-- ============================================================================
-- Cada fila = 1 alumno + 1 instructor + 1 vehículo + 1 slot horario.
-- Datos técnicos post-clase (KM, GPS, notas de desempeño) viven aquí.
CREATE TABLE IF NOT EXISTS class_b_sessions (
  id                      SERIAL PRIMARY KEY,
  enrollment_id           INT      NOT NULL REFERENCES enrollments(id),
  instructor_id           INT      NOT NULL REFERENCES instructors(id),
  vehicle_id              INT      NOT NULL, -- FK a vehicles(id) se agrega en 07
  class_number            SMALLINT,          -- 1..12 (secuencia obligatoria)
  scheduled_at            TIMESTAMPTZ,
  start_time              TIME,
  end_time                TIME,
  duration_min            SMALLINT DEFAULT 90,
  status                  TEXT,              -- 'scheduled' | 'completed' | 'cancelled' | 'no_show' | 'in_progress'
  -- RF-015: Política 24h
  counts_as_taken         BOOLEAN DEFAULT false,  -- True si canceló <24h o no_show
  cancelled_at            TIMESTAMPTZ,
  completed_at            TIMESTAMPTZ,
  -- Post-clase (RF-049)
  evaluation_grade        NUMERIC(3,1),
  performance_notes       TEXT,
  km_start                INTEGER,           -- odómetro al inicio (RF-090)
  km_end                  INTEGER,           -- odómetro al fin
  gps_start               POINT,             -- RF-127: coordenadas inicio
  gps_end                 POINT,             -- RF-127: coordenadas fin
  notes                   TEXT,
  -- Firmas (RF-050, RF-107)
  student_signature       BOOLEAN DEFAULT false,
  instructor_signature    BOOLEAN DEFAULT false,
  signature_timestamp     TIMESTAMPTZ,
  -- Instructor real vs original (RF-044)
  original_instructor_id  INT    REFERENCES instructors(id),
  registered_by           INT    REFERENCES users(id),
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE class_b_sessions IS 'Sesiones prácticas individuales Clase B: 1 alumno + 1 instructor + 1 vehículo, secuencia 1-12 (RF-046)';

-- ============================================================================
-- CLASS_B_THEORY_SESSIONS — Sesiones teóricas grupales Zoom Clase B (RF-016, RF-051)
-- ============================================================================
CREATE TABLE IF NOT EXISTS class_b_theory_sessions (
  id              SERIAL PRIMARY KEY,
  branch_id       INT    REFERENCES branches(id),
  instructor_id   INT    REFERENCES instructors(id),  -- NULL si relator externo
  scheduled_at    TIMESTAMPTZ NOT NULL,
  start_time      TIME,
  end_time        TIME,
  duration_min    SMALLINT DEFAULT 90,
  topic           TEXT,                  -- unidad o tema
  zoom_link       TEXT,                  -- RF-016: enviado automáticamente
  status          TEXT,                  -- 'scheduled' | 'completed' | 'cancelled'
  notes           TEXT,
  registered_by   INT    REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE class_b_theory_sessions IS 'Sesiones teóricas grupales Zoom de Clase B (RF-016, RF-051)';

-- ============================================================================
-- CLASS_B_THEORY_ATTENDANCE — Asistencia a clases teóricas Clase B (RF-051, RF-052)
-- ============================================================================
CREATE TABLE IF NOT EXISTS class_b_theory_attendance (
  id                    SERIAL PRIMARY KEY,
  theory_session_b_id   INT    NOT NULL REFERENCES class_b_theory_sessions(id),
  student_id            INT    NOT NULL REFERENCES students(id),
  status                TEXT,              -- 'present' | 'absent' | 'excused'
  justification         TEXT,
  recorded_by           INT    REFERENCES users(id),
  recorded_at           TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(theory_session_b_id, student_id)
);

COMMENT ON TABLE class_b_theory_attendance IS 'Asistencia a clases teóricas grupales Clase B Zoom (RF-051, RF-052)';

-- ============================================================================
-- CLASS_B_PRACTICE_ATTENDANCE — Asistencia a clases prácticas Clase B (RF-051, RF-052)
-- ============================================================================
CREATE TABLE IF NOT EXISTS class_b_practice_attendance (
  id                      SERIAL PRIMARY KEY,
  class_b_session_id      INT    NOT NULL REFERENCES class_b_sessions(id),
  student_id              INT    NOT NULL REFERENCES students(id),
  status                  TEXT,            -- 'present' | 'absent' | 'excused' | 'no_show'
  justification           TEXT,
  evidence_url            TEXT,
  consecutive_absences    INT    DEFAULT 0, -- RF-053: 2 = deserción
  recorded_by             INT    REFERENCES users(id),
  recorded_at             TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(class_b_session_id, student_id)
);

COMMENT ON TABLE class_b_practice_attendance IS 'Asistencia a clases prácticas individuales Clase B. RF-053: 2 inasistencias = deserción';

-- ============================================================================
-- CLASS_B_EXAM_SCORES — Puntajes ensayos manuales (RF-057)
-- ============================================================================
CREATE TABLE IF NOT EXISTS class_b_exam_scores (
  id              SERIAL PRIMARY KEY,
  student_id      INT    NOT NULL REFERENCES students(id),
  enrollment_id   INT    NOT NULL REFERENCES enrollments(id),
  date            DATE,
  score           SMALLINT,              -- sobre 100
  passed          BOOLEAN,
  registered_by   INT    REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE class_b_exam_scores IS 'Puntajes de ensayos físicos de preparación examen municipal, ingreso manual (RF-057)';

-- ============================================================================
-- CLASS_B_EXAM_CATALOG — Catálogo de ensayos online (RF-057)
-- ============================================================================
CREATE TABLE IF NOT EXISTS class_b_exam_catalog (
  id              SERIAL PRIMARY KEY,
  title           TEXT     NOT NULL,       -- "Ensayo Teórico N°1 — Reglamento del Tránsito"
  description     TEXT,
  time_limit_min  SMALLINT NOT NULL,       -- minutos (ej. 45)
  total_questions SMALLINT NOT NULL,       -- nº de preguntas a sortear del banco
  pass_score      SMALLINT NOT NULL,       -- puntaje mínimo sobre 100 para aprobar
  active          BOOLEAN  DEFAULT true,
  created_by      INT      REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE class_b_exam_catalog IS 'Catálogo de ensayos online autogestionados Clase B (RF-057)';

-- ============================================================================
-- CLASS_B_EXAM_QUESTIONS — Banco de preguntas (RF-057)
-- ============================================================================
CREATE TABLE IF NOT EXISTS class_b_exam_questions (
  id              SERIAL PRIMARY KEY,
  exam_id         INT    NOT NULL REFERENCES class_b_exam_catalog(id),
  question_text   TEXT   NOT NULL,
  option_a        TEXT   NOT NULL,
  option_b        TEXT   NOT NULL,
  option_c        TEXT   NOT NULL,
  option_d        TEXT,                    -- algunas preguntas pueden tener solo 3 opciones
  correct_option  CHAR(1) NOT NULL,        -- 'A' | 'B' | 'C' | 'D'
  active          BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE class_b_exam_questions IS 'Banco de preguntas reutilizables para ensayos online Clase B (RF-057)';

-- ============================================================================
-- CLASS_B_EXAM_ATTEMPTS — Intentos de ensayos online (RF-057)
-- ============================================================================
CREATE TABLE IF NOT EXISTS class_b_exam_attempts (
  id              SERIAL PRIMARY KEY,
  exam_id         INT    NOT NULL REFERENCES class_b_exam_catalog(id),
  student_id      INT    NOT NULL REFERENCES students(id),
  enrollment_id   INT    NOT NULL REFERENCES enrollments(id),
  started_at      TIMESTAMPTZ NOT NULL,
  submitted_at    TIMESTAMPTZ,              -- NULL si abandonó sin enviar
  score           SMALLINT,                 -- sobre 100; NULL hasta envío
  passed          BOOLEAN,                  -- NULL hasta calificación
  answers         JSONB,                    -- { "q_id_1": "C", "q_id_2": "A", ... }
  timed_out       BOOLEAN DEFAULT false,    -- true si tiempo expiró
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE class_b_exam_attempts IS 'Intentos de alumnos en ensayos online con calificación automática (RF-057)';

-- ============================================================================
-- ÍNDICES — Módulo 3 (Clase B)
-- ============================================================================

-- Agenda Clase B: triple match instructor + vehículo + alumno
CREATE INDEX IF NOT EXISTS idx_class_b_sessions_date_instructor
  ON class_b_sessions(instructor_id, scheduled_at)
  WHERE status NOT IN ('cancelled');

CREATE INDEX IF NOT EXISTS idx_class_b_sessions_date_vehicle
  ON class_b_sessions(vehicle_id, scheduled_at)
  WHERE status NOT IN ('cancelled');

-- Asignación activa de vehículo (una por vehículo a la vez)
CREATE UNIQUE INDEX IF NOT EXISTS idx_active_vehicle_assignment
  ON vehicle_assignments(vehicle_id) WHERE end_date IS NULL;

-- Asistencia Clase B: verificar 2 inasistencias consecutivas (RF-053)
CREATE INDEX IF NOT EXISTS idx_class_b_practice_attendance_student
  ON class_b_practice_attendance(student_id, recorded_at DESC);

-- Clases teóricas Zoom Clase B por sede y fecha
CREATE INDEX IF NOT EXISTS idx_class_b_theory_sessions_branch
  ON class_b_theory_sessions(branch_id, scheduled_at);

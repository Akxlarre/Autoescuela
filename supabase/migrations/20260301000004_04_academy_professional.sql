-- ============================================================================
-- 04 — Gestión Académica Clase Profesional (RF-058 a RF-079)
-- ============================================================================
-- Exclusivo de Conductores Chillán. Sesiones grupales dentro de promociones de 30 días.
-- Depende de: 01 (users, students, branches, courses), 02 (enrollments)
-- ============================================================================

-- ============================================================================
-- LECTURERS — Relatores de Clase Profesional (RF-058)
-- ============================================================================
-- Sin acceso al sistema: no tienen cuenta de usuario ni FK a users.
CREATE TABLE IF NOT EXISTS lecturers (
  id                    SERIAL PRIMARY KEY,
  rut                   TEXT   NOT NULL UNIQUE,    -- RUT chileno validado
  first_names           TEXT   NOT NULL,
  paternal_last_name    TEXT   NOT NULL,
  maternal_last_name    TEXT,
  email                 TEXT   UNIQUE,
  phone                 TEXT,
  specializations       TEXT[],                    -- ['A2','A4'] etc.
  active                BOOLEAN DEFAULT true,
  registration_date     DATE
);

COMMENT ON TABLE lecturers IS 'Relatores de Clase Profesional: datos y especializaciones. Sin acceso al sistema (RF-058)';

-- ============================================================================
-- LECTURER_MONTHLY_HOURS — Horas mensuales por relator (análogo RF-047)
-- ============================================================================
CREATE TABLE IF NOT EXISTS lecturer_monthly_hours (
  id              SERIAL PRIMARY KEY,
  lecturer_id     INT    NOT NULL REFERENCES lecturers(id),
  period          TEXT   NOT NULL,           -- "2026-02"
  theory_hours    NUMERIC(6,1) DEFAULT 0,
  practical_hours NUMERIC(6,1) DEFAULT 0,
  total_hours     NUMERIC(6,1),
  UNIQUE(lecturer_id, period)
);

COMMENT ON TABLE lecturer_monthly_hours IS 'Cálculo de horas teóricas y prácticas por relator profesional por mes';

-- ============================================================================
-- PROFESSIONAL_PROMOTIONS — Período de 30 días (RF-059)
-- ============================================================================
-- Entidad paraguas que agrupa hasta 4 cursos (A2, A3, A4, A5) en paralelo.
CREATE TABLE IF NOT EXISTS professional_promotions (
  id            SERIAL PRIMARY KEY,
  code          TEXT    UNIQUE,              -- "PROM-2026-01"
  name          TEXT,                        -- "Promoción Enero 2026"
  start_date    DATE    NOT NULL,            -- siempre lunes
  end_date      DATE,                        -- inicio + 30 días (siempre sábado)
  max_students  SMALLINT DEFAULT 100,        -- 4 cursos × 25 alumnos
  status        TEXT,                        -- 'planned' | 'in_progress' | 'finished' | 'cancelled'
  current_day   SMALLINT DEFAULT 0,          -- RF-079: "Día X de 30"
  branch_id     INT    REFERENCES branches(id),  -- siempre conductores-chillan
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE professional_promotions IS 'Período de 30 días que agrupa hasta 4 cursos profesionales en paralelo (RF-059)';

-- ============================================================================
-- PROFESSIONAL_SCHEDULE_TEMPLATES — Plantillas de horario fijo (RF-059)
-- ============================================================================
CREATE TABLE IF NOT EXISTS professional_schedule_templates (
  id          SERIAL PRIMARY KEY,
  name        TEXT    NOT NULL,              -- "Horario Estándar Clase Profesional"
  description TEXT,
  active      BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE professional_schedule_templates IS 'Plantillas reutilizables de horario fijo para los 30 días de un curso profesional';

-- ============================================================================
-- TEMPLATE_BLOCKS — Bloques horarios dentro de una plantilla (RF-059)
-- ============================================================================
CREATE TABLE IF NOT EXISTS template_blocks (
  id            SERIAL PRIMARY KEY,
  template_id   INT      NOT NULL REFERENCES professional_schedule_templates(id),
  type          TEXT     NOT NULL,           -- 'theory' | 'practice'
  week_number   SMALLINT NOT NULL,           -- 1..5
  day_of_week   SMALLINT NOT NULL,           -- 1=Lun..6=Sáb
  start_time    TIME     NOT NULL,
  end_time      TIME     NOT NULL,
  description   TEXT,                        -- temática / módulo (opcional)

  CONSTRAINT chk_working_day_of_week CHECK (day_of_week BETWEEN 1 AND 6),
  CONSTRAINT chk_week_number         CHECK (week_number BETWEEN 1 AND 5)
);

COMMENT ON TABLE template_blocks IS 'Bloques horarios individuales dentro de una plantilla de horario profesional';

-- ============================================================================
-- PROMOTION_COURSES — Cursos dentro de una promoción (RF-059)
-- ============================================================================
-- Cada promoción tiene hasta 4 cursos (A2, A3, A4, A5) con su propio relator y cupo.
CREATE TABLE IF NOT EXISTS promotion_courses (
  id                  SERIAL PRIMARY KEY,
  promotion_id        INT      NOT NULL REFERENCES professional_promotions(id),
  course_id           INT      NOT NULL REFERENCES courses(id),
  lecturer_id         INT      NOT NULL REFERENCES lecturers(id),
  template_id         INT      REFERENCES professional_schedule_templates(id),
  max_students        SMALLINT DEFAULT 25,
  enrolled_students   SMALLINT DEFAULT 0,
  status              TEXT,                  -- 'planned' | 'in_progress' | 'finished' | 'cancelled'
  created_at          TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(promotion_id, course_id)
);

COMMENT ON TABLE promotion_courses IS 'Curso específico (A2/A3/A4/A5) dentro de una promoción, con relator y cupo de 25 (RF-059)';

-- ============================================================================
-- Ahora que promotion_courses existe, agregar FK en enrollments
-- ============================================================================
ALTER TABLE enrollments
  ADD COLUMN IF NOT EXISTS promotion_course_id INT REFERENCES promotion_courses(id);

COMMENT ON COLUMN enrollments.promotion_course_id IS 'Solo Profesional: curso dentro de promoción. NULL = pendiente asignación. Clase B siempre NULL.';

-- ============================================================================
-- PROFESSIONAL_THEORY_SESSIONS — Sesiones teóricas Zoom profesional (RF-016, RF-078)
-- ============================================================================
CREATE TABLE IF NOT EXISTS professional_theory_sessions (
  id                    SERIAL PRIMARY KEY,
  promotion_course_id   INT    NOT NULL REFERENCES promotion_courses(id),
  date                  DATE   NOT NULL,
  start_time            TIME,
  end_time              TIME,
  status                TEXT,              -- 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
  zoom_link             TEXT,              -- RF-016
  notes                 TEXT,
  registered_by         INT    REFERENCES users(id),
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE professional_theory_sessions IS 'Sesiones teóricas Zoom por curso dentro de una promoción profesional (RF-016, RF-078)';

-- ============================================================================
-- PROFESSIONAL_PRACTICE_SESSIONS — Sesiones prácticas de campo (RF-068)
-- ============================================================================
CREATE TABLE IF NOT EXISTS professional_practice_sessions (
  id                    SERIAL PRIMARY KEY,
  promotion_course_id   INT    NOT NULL REFERENCES promotion_courses(id),
  date                  DATE   NOT NULL,
  start_time            TIME,
  end_time              TIME,
  status                TEXT,              -- 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
  notes                 TEXT,
  registered_by         INT    REFERENCES users(id),
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE professional_practice_sessions IS 'Sesiones prácticas de campo por curso dentro de una promoción profesional (RF-068)';

-- ============================================================================
-- ABSENCE_EVIDENCE — Justificantes de faltas (RF-071)
-- ============================================================================
CREATE TABLE IF NOT EXISTS absence_evidence (
  id              SERIAL PRIMARY KEY,
  enrollment_id   INT    NOT NULL REFERENCES enrollments(id),
  document_type   TEXT,                    -- 'medical_leave' | 'medical_certificate' | 'other'
  description     TEXT,
  file_url        TEXT   NOT NULL,
  document_date   DATE,
  status          TEXT,                    -- 'pending' | 'approved' | 'rejected'
  reviewed_by     INT    REFERENCES users(id),
  reviewed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE absence_evidence IS 'Adjuntos de licencias médicas para justificar faltas profesionales (RF-071)';

-- ============================================================================
-- PROFESSIONAL_THEORY_ATTENDANCE — Asistencia teórica profesional (RF-078)
-- ============================================================================
CREATE TABLE IF NOT EXISTS professional_theory_attendance (
  id                        SERIAL PRIMARY KEY,
  theory_session_prof_id    INT    NOT NULL REFERENCES professional_theory_sessions(id),
  enrollment_id             INT    NOT NULL REFERENCES enrollments(id),
  student_id                INT    NOT NULL REFERENCES students(id),
  status                    TEXT,          -- 'present' | 'absent' | 'excused'
  justification             TEXT,
  evidence_id               INT    REFERENCES absence_evidence(id),
  recorded_by               INT    REFERENCES users(id),
  recorded_at               TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(theory_session_prof_id, student_id)
);

COMMENT ON TABLE professional_theory_attendance IS 'Asistencia a clases teóricas Zoom profesionales, marcado manual (RF-078)';

-- ============================================================================
-- PROFESSIONAL_PRACTICE_ATTENDANCE — Asistencia práctica profesional (RF-068)
-- ============================================================================
CREATE TABLE IF NOT EXISTS professional_practice_attendance (
  id                  SERIAL PRIMARY KEY,
  session_id          INT    NOT NULL REFERENCES professional_practice_sessions(id),
  enrollment_id       INT    NOT NULL REFERENCES enrollments(id),
  student_id          INT    NOT NULL REFERENCES students(id),
  status              TEXT,                -- 'present' | 'absent' | 'excused'
  block_percentage    NUMERIC(5,2) DEFAULT 100.0,  -- % del bloque completado
  justification       TEXT,
  evidence_id         INT    REFERENCES absence_evidence(id),
  recorded_by         INT    REFERENCES users(id),
  recorded_at         TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, student_id)
);

COMMENT ON TABLE professional_practice_attendance IS 'Asistencia a bloques prácticos profesionales con porcentaje (RF-068)';

-- ============================================================================
-- PROFESSIONAL_MODULE_GRADES — Notas por módulo técnico (RF-072)
-- ============================================================================
CREATE TABLE IF NOT EXISTS professional_module_grades (
  id              SERIAL PRIMARY KEY,
  enrollment_id   INT    NOT NULL REFERENCES enrollments(id),
  module          TEXT   NOT NULL,           -- "Módulo 1: Seguridad Vial"
  grade           NUMERIC(3,1),
  passed          BOOLEAN,
  template_id     INT,
  recorded_by     INT    REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE professional_module_grades IS 'Notas por módulo técnico profesional, escala 1.0-7.0 (RF-072)';

-- Constraint: nota en escala chilena
ALTER TABLE professional_module_grades ADD CONSTRAINT chk_grade_range
  CHECK (grade BETWEEN 1.0 AND 7.0);

-- ============================================================================
-- SESSION_MACHINERY — Maquinaria por sesión práctica (RF-073)
-- ============================================================================
CREATE TABLE IF NOT EXISTS session_machinery (
  id          SERIAL PRIMARY KEY,
  session_id  INT    NOT NULL REFERENCES professional_practice_sessions(id),
  type        TEXT,                          -- 'owned' | 'rented'
  description TEXT,
  rental_cost INTEGER,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE session_machinery IS 'Maquinaria propia/arrendada registrada por sesión práctica profesional (RF-073)';

-- ============================================================================
-- LICENSE_VALIDATIONS — Convalidación A2+A4 simultáneo (RF-064, RF-065, RF-066)
-- ============================================================================
CREATE TABLE IF NOT EXISTS license_validations (
  id              SERIAL PRIMARY KEY,
  student_id      INT    NOT NULL REFERENCES students(id),
  enrollment_a2_id INT   REFERENCES enrollments(id),
  enrollment_a4_id INT   REFERENCES enrollments(id),
  reduced_hours   INTEGER DEFAULT 60,        -- RF-064
  book2_open_date DATE,                      -- RF-065: 2 semanas después
  history_ref_id  INT    REFERENCES enrollments(id),  -- RF-066
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE license_validations IS 'Convalidación A2+A4 simultáneo: reducción horas y apertura segundo libro (RF-064, RF-065, RF-066)';

-- ============================================================================
-- PROFESSIONAL_FINAL_RECORDS — Resultado final del alumno (RF-074)
-- ============================================================================
CREATE TABLE IF NOT EXISTS professional_final_records (
  id                          SERIAL PRIMARY KEY,
  enrollment_id               INT    NOT NULL UNIQUE REFERENCES enrollments(id),
  result                      TEXT   NOT NULL,       -- 'approved' | 'failed'
  final_grade                 NUMERIC(3,1),          -- promedio ponderado módulos
  practical_exam_passed       BOOLEAN,
  theory_attendance_pct       NUMERIC(5,2),
  practical_attendance_pct    NUMERIC(5,2),
  notes                       TEXT,
  record_date                 DATE   NOT NULL,
  registered_by               INT    REFERENCES users(id),
  created_at                  TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE professional_final_records IS 'Resultado final Aprobado/Reprobado del alumno en promoción profesional (RF-074)';

-- Constraint: nota final en escala chilena
ALTER TABLE professional_final_records ADD CONSTRAINT chk_final_grade_range
  CHECK (final_grade IS NULL OR final_grade BETWEEN 1.0 AND 7.0);

-- ============================================================================
-- CLASS_BOOK — Libro oficial por curso dentro de una promoción (RF-103)
-- ============================================================================
CREATE TABLE IF NOT EXISTS class_book (
  id                    SERIAL PRIMARY KEY,
  branch_id             INT    REFERENCES branches(id),
  promotion_course_id   INT    NOT NULL REFERENCES promotion_courses(id),
  period                TEXT   NOT NULL,         -- "PROM-2026-01"
  pdf_url               TEXT,
  generated_by          INT    REFERENCES users(id),
  generated_at          TIMESTAMPTZ,
  status                TEXT,                    -- 'draft' | 'active' | 'in_review' | 'closed'
  closes_at             TIMESTAMPTZ,             -- end_date + 7 días
  closed_at             TIMESTAMPTZ,
  closed_by             INT    REFERENCES users(id),
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE class_book IS 'Libro oficial por curso profesional, para auditorías MTT. Exclusivo Clase Profesional (RF-103)';

-- ============================================================================
-- ÍNDICES — Módulo 4 (Profesional)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_promotion_courses_promotion
  ON promotion_courses(promotion_id);

CREATE INDEX IF NOT EXISTS idx_template_blocks
  ON template_blocks(template_id, week_number, day_of_week);

CREATE INDEX IF NOT EXISTS idx_professional_sessions_course
  ON professional_practice_sessions(promotion_course_id, date);

CREATE INDEX IF NOT EXISTS idx_professional_theory_sessions_course
  ON professional_theory_sessions(promotion_course_id, date);

CREATE INDEX IF NOT EXISTS idx_professional_theory_attendance_enrollment
  ON professional_theory_attendance(enrollment_id, theory_session_prof_id);

CREATE INDEX IF NOT EXISTS idx_professional_practice_attendance_enrollment
  ON professional_practice_attendance(enrollment_id, session_id);

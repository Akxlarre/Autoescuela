-- ============================================================================
-- 02 — Matrículas, Pre-inscripciones y Descuentos
-- ============================================================================
-- Depende de: 01_users_and_branches.sql (branches, users, students, courses, sence_codes)
-- Nota: enrollments referencia promotion_courses (creada en 04), pero esa FK
--       se agrega como ALTER TABLE al final de este archivo con comentario.
-- ============================================================================

-- ============================================================================
-- DISCOUNTS — Descuentos comerciales aplicables a matrículas
-- ============================================================================
CREATE TABLE IF NOT EXISTS discounts (
  id              SERIAL PRIMARY KEY,
  name            TEXT    NOT NULL,
  discount_type   TEXT,                  -- 'percentage' | 'fixed_amount'
  value           INTEGER NOT NULL,
  valid_from      DATE    NOT NULL,
  valid_until     DATE,                  -- NULL = permanente
  applicable_to   TEXT,                  -- 'all' | 'class_b' | 'professional'
  status          TEXT,                  -- 'active' | 'inactive' | 'expired'
  referral_code   TEXT,
  created_by      INT    REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE discounts IS 'Descuentos comerciales aplicables a matrículas (porcentaje o monto fijo)';

-- ============================================================================
-- ENROLLMENTS — Matrícula central (RF-080)
-- ============================================================================
-- Aplica a Clase B y Profesional. El tipo se deriva de enrollments.course_id → courses.type.
-- promotion_course_id: FK a promotion_courses, se agrega después de crear esa tabla (archivo 04).
CREATE TABLE IF NOT EXISTS enrollments (
  id                    SERIAL PRIMARY KEY,
  number                TEXT   UNIQUE,               -- "2026-0201" (NULL en estado 'draft')
  student_id            INT    NOT NULL REFERENCES students(id),
  course_id             INT    NOT NULL REFERENCES courses(id),
  branch_id             INT    NOT NULL REFERENCES branches(id),
  sence_code_id         INT    REFERENCES sence_codes(id),
  -- promotion_course_id se agrega via ALTER TABLE después de crear promotion_courses (archivo 04)
  -- Pagos
  base_price            INTEGER,
  discount              INTEGER DEFAULT 0,
  total_paid            INTEGER DEFAULT 0,
  pending_balance       INTEGER,
  payment_status        TEXT,                        -- 'paid_full' | 'pending' | 'partial'
  -- Estado académico
  status                TEXT,                        -- 'draft' | 'pending_docs' | 'active' | 'completed' | 'cancelled'
  -- Expiración de draft (solo Clase B en estado 'draft')
  expires_at            TIMESTAMPTZ,                 -- típicamente NOW() + 24 hours
  -- Expediente
  docs_complete         BOOLEAN DEFAULT false,       -- RF-085
  contract_accepted     BOOLEAN DEFAULT false,       -- RF-083
  -- Habilitación certificado (gatillo RF-082.4)
  certificate_enabled   BOOLEAN DEFAULT false,
  -- Canal de matrícula
  registration_channel  TEXT    DEFAULT 'in_person', -- 'online' | 'in_person'
  -- Control
  registered_by         INT    REFERENCES users(id),
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW(),

  -- expires_at solo existe cuando hay draft
  CONSTRAINT chk_expires_at_draft_only
    CHECK (expires_at IS NULL OR status = 'draft'),
  -- número de matrícula obligatorio salvo en draft
  CONSTRAINT chk_enrollment_number
    CHECK (status = 'draft' OR number IS NOT NULL)
);

COMMENT ON TABLE enrollments IS 'Matrícula central: Clase B y Profesional (RF-080). El tipo se deriva de course_id → courses.type';

-- ============================================================================
-- PROFESSIONAL_PRE_REGISTRATIONS — Pre-inscripción Clase Profesional
-- ============================================================================
-- Dos orígenes: autoservicio público (/matricula-online) o ingreso manual por secretaria.
-- Datos personales viven en users; esta tabla solo almacena lo propio de la pre-inscripción.
CREATE TABLE IF NOT EXISTS professional_pre_registrations (
  id                          SERIAL PRIMARY KEY,
  temp_user_id                INT    NOT NULL UNIQUE REFERENCES users(id),
  desired_course_class        TEXT   NOT NULL,            -- 'A2' | 'A3' | 'A4' | 'A5'
  psych_test_status           TEXT   DEFAULT 'not_started', -- 'not_started' | 'in_progress' | 'completed'
  psych_test_result           TEXT,                        -- 'fit' | 'unfit'
  registered_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at                  TIMESTAMPTZ NOT NULL,        -- purga automática
  status                      TEXT   DEFAULT 'pending_review',
    -- 'pending_review' | 'approved' | 'enrolled' | 'expired' | 'rejected'
  converted_enrollment_id     INT    REFERENCES enrollments(id)
);

COMMENT ON TABLE professional_pre_registrations IS 'Pre-inscripción Clase Profesional con test psicológico y expiración automática';

-- ============================================================================
-- DISCOUNT_APPLICATIONS — Descuento aplicado a una matrícula
-- ============================================================================
CREATE TABLE IF NOT EXISTS discount_applications (
  id              SERIAL PRIMARY KEY,
  discount_id     INT    NOT NULL REFERENCES discounts(id),
  enrollment_id   INT    NOT NULL REFERENCES enrollments(id),
  discount_amount INTEGER NOT NULL,
  applied_by      INT    REFERENCES users(id),
  applied_at      TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE discount_applications IS 'Registro de descuento aplicado a una matrícula específica';

-- ============================================================================
-- PRICING_SEASONS — Cambio masivo de precios por fechas especiales (RF-110)
-- ============================================================================
CREATE TABLE IF NOT EXISTS pricing_seasons (
  id              SERIAL PRIMARY KEY,
  name            TEXT,                  -- "Verano 2026"
  price_class_b   INTEGER,
  price_a2        INTEGER,
  start_date      DATE,
  end_date        DATE,
  active          BOOLEAN DEFAULT false,
  created_by      INT    REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE pricing_seasons IS 'Temporadas de precios especiales (RF-110)';

-- ============================================================================
-- ÍNDICES — Módulo 2 (Matrículas)
-- ============================================================================

-- Matrículas activas por sede y mes
CREATE INDEX IF NOT EXISTS idx_enrollments_branch_date
  ON enrollments(branch_id, course_id, created_at)
  WHERE status = 'active';

-- Borradores expirados (para CRON job de cleanup)
CREATE INDEX IF NOT EXISTS idx_enrollments_expired_drafts
  ON enrollments(expires_at)
  WHERE status = 'draft';

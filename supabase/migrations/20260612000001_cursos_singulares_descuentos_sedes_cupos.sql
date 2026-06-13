-- ============================================================================
-- 20260612000001 — Cursos Singulares: descuentos, fecha de pago, sedes y cupos
-- fix-016 — idempotente
-- ============================================================================

-- 1. Descuentos persistidos en la inscripción (AC1)
ALTER TABLE standalone_course_enrollments
  ADD COLUMN IF NOT EXISTS discount_amount INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_reason TEXT;

COMMENT ON COLUMN standalone_course_enrollments.discount_amount IS
  'Descuento acordado al inscribir (CLP). El monto a cobrar es base_price − discount_amount.';
COMMENT ON COLUMN standalone_course_enrollments.discount_reason IS
  'Motivo del descuento — trazabilidad contable obligatoria cuando discount_amount > 0.';

-- 2. Fecha real de cobro, para integrar con la cuadratura diaria (AC3)
ALTER TABLE standalone_course_enrollments
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

COMMENT ON COLUMN standalone_course_enrollments.paid_at IS
  'Momento en que se registró el cobro. NULL mientras payment_status=pending. Fuente de la cuadratura diaria.';

-- Backfill best-effort: inscripciones ya pagadas sin fecha de cobro
UPDATE standalone_course_enrollments
SET paid_at = enrolled_at
WHERE payment_status = 'paid' AND paid_at IS NULL;

-- 3. Sedes obligatorias en cursos singulares (AC4)
-- Backfill: cursos históricos sin sede se asignan a la sede 1 (principal).
UPDATE standalone_courses SET branch_id = 1 WHERE branch_id IS NULL;
ALTER TABLE standalone_courses ALTER COLUMN branch_id SET NOT NULL;

-- 4. Guard de cupos a nivel de BD — backstop contra inscripciones concurrentes (AC5)
CREATE OR REPLACE FUNCTION check_standalone_course_capacity()
RETURNS TRIGGER AS $$
DECLARE
  v_max SMALLINT;
  v_count INT;
BEGIN
  SELECT max_students INTO v_max
  FROM standalone_courses
  WHERE id = NEW.standalone_course_id
  FOR UPDATE; -- serializa inscripciones concurrentes al mismo curso

  SELECT COUNT(*) INTO v_count
  FROM standalone_course_enrollments
  WHERE standalone_course_id = NEW.standalone_course_id;

  IF v_count >= v_max THEN
    -- Mensaje-token estable: la UI lo traduce a texto amigable (db-error.utils)
    RAISE EXCEPTION 'CUPOS_AGOTADOS';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_standalone_capacity ON standalone_course_enrollments;
CREATE TRIGGER trg_standalone_capacity
  BEFORE INSERT ON standalone_course_enrollments
  FOR EACH ROW EXECUTE FUNCTION check_standalone_course_capacity();

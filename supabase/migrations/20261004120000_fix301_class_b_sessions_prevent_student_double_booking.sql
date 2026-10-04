-- Fix 301-m: doble-agendado del mismo ALUMNO sin constraint atómica en BD.
-- trg_prevent_double_booking (fix-152-m) impide que un instructor quede con dos clases
-- solapadas, pero nada impide que un alumno quede con dos clases a la misma hora con
-- instructores distintos. La grilla de la ficha ya no ofrece esos horarios (fix-299-m), pero
-- eso filtra AL LEER: el wizard de matrícula y dos personas agendando casi simultáneo pasan igual.
--
-- Mismo patrón que prevent_double_booking_class_b_sessions(), por alumno en vez de instructor.
-- El alumno se resuelve desde la matrícula: el solape se busca en TODAS sus matrículas
-- (Clase B + refuerzo).
--
-- Estados que no ocupan al alumno: 'cancelled' y 'no_show' (son justamente las clases que se
-- reagendan; reagendar recicla la fila, ver DG-075).
--
-- Un UPDATE que no mueve la clase ni la reactiva no se valida: si ya existieran solapes
-- históricos, esas filas deben poder completarse o cancelarse sin quedar bloqueadas.

CREATE OR REPLACE FUNCTION prevent_student_double_booking_class_b_sessions()
RETURNS TRIGGER AS $$
DECLARE
  v_student_id enrollments.student_id%TYPE;
BEGIN
  IF NEW.status IN ('cancelled', 'no_show') OR NEW.scheduled_at IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.enrollment_id = OLD.enrollment_id
     AND NEW.scheduled_at IS NOT DISTINCT FROM OLD.scheduled_at
     AND NEW.duration_min IS NOT DISTINCT FROM OLD.duration_min
     AND OLD.status NOT IN ('cancelled', 'no_show') THEN
    RETURN NEW;
  END IF;

  SELECT e.student_id INTO v_student_id
  FROM enrollments e
  WHERE e.id = NEW.enrollment_id;

  IF v_student_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM class_b_sessions cb
    JOIN enrollments e ON e.id = cb.enrollment_id
    WHERE e.student_id = v_student_id
      AND cb.id IS DISTINCT FROM NEW.id
      AND cb.status NOT IN ('cancelled', 'no_show')
      AND cb.scheduled_at IS NOT NULL
      AND NEW.scheduled_at < (cb.scheduled_at + (COALESCE(cb.duration_min, 45) * INTERVAL '1 minute'))
      AND cb.scheduled_at < (NEW.scheduled_at + (COALESCE(NEW.duration_min, 45) * INTERVAL '1 minute'))
  ) THEN
    RAISE EXCEPTION 'El alumno ya tiene otra clase agendada que se solapa con este horario.'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_prevent_student_double_booking ON class_b_sessions;

CREATE TRIGGER trg_prevent_student_double_booking
  BEFORE INSERT OR UPDATE OF enrollment_id, scheduled_at, duration_min, status
  ON class_b_sessions
  FOR EACH ROW
  EXECUTE FUNCTION prevent_student_double_booking_class_b_sessions();

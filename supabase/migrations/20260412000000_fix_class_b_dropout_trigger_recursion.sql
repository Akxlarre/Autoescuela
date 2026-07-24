-- ============================================================================
-- Fix: verify_class_b_dropout_rule() se auto-invoca infinitamente
-- ============================================================================
-- La función, disparada por trg_class_b_dropout (AFTER INSERT OR UPDATE ON
-- class_b_practice_attendance FOR EACH ROW), ejecuta un UPDATE sobre la misma
-- fila que la disparó (WHERE id = NEW.id) para setear consecutive_absences.
-- Ese UPDATE vuelve a disparar el mismo trigger AFTER UPDATE, que ejecuta la
-- misma función, que vuelve a hacer UPDATE ... WHERE id = NEW.id — recursión
-- infinita hasta ERROR: stack depth limit exceeded (SQLSTATE 54001).
--
-- Fix: guarda estándar con pg_trigger_depth(). La invocación de nivel
-- superior (depth = 1, el INSERT/UPDATE original del caller) ejecuta la
-- lógica completa sin cambios. La invocación anidada que dispara el UPDATE
-- interno (depth = 2) retorna de inmediato sin reprocesar, cortando la
-- recursión sin alterar el comportamiento observable de la función.
-- ============================================================================

CREATE OR REPLACE FUNCTION verify_class_b_dropout_rule()
RETURNS TRIGGER AS $$
DECLARE
  v_consecutive INT;
BEGIN
  -- Corta la recursión: esta invocación fue disparada por el propio UPDATE
  -- que esta función ejecuta más abajo, no por el caller original.
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  IF NEW.status IN ('absent', 'no_show') THEN
    -- Contar inasistencias consecutivas más recientes
    SELECT COUNT(*) INTO v_consecutive
    FROM (
      SELECT status FROM public.class_b_practice_attendance
      WHERE student_id = NEW.student_id
      ORDER BY recorded_at DESC
      LIMIT 2
    ) recent
    WHERE status IN ('absent', 'no_show');

    -- Actualizar el contador
    UPDATE public.class_b_practice_attendance
    SET consecutive_absences = v_consecutive
    WHERE id = NEW.id;

    -- Si 2 consecutivas, marcar como deserción (cancelar matrícula)
    IF v_consecutive >= 2 THEN
      UPDATE public.enrollments
      SET status = 'cancelled', updated_at = NOW()
      WHERE id = (
        SELECT enrollment_id FROM public.class_b_sessions WHERE id = NEW.class_b_session_id
      );
    END IF;
  ELSE
    -- Si asistió, resetear el contador
    UPDATE public.class_b_practice_attendance
    SET consecutive_absences = 0
    WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';

-- ============================================================================
-- fix-266-m: fecha de egreso real (enrollments.completed_at)
-- ============================================================================
-- Contexto: ningún flujo guardaba CUÁNDO una matrícula pasa a 'completed'. Ex-Alumnos usaba
-- updated_at como fecha de egreso, pero ese campo no se actualiza al marcar al ex-alumno
-- (enrollments no tiene trigger de updated_at) y sí lo mueve recalculate_enrollment_balance()
-- con cada pago. Resultado: un alumno marcado hoy aparecía con el año de su último pago y podía
-- quedar fuera del período por defecto "Últimos 12 meses".
--
-- completed_at la fija un trigger, no el cliente, para cubrir TODAS las vías por las que una
-- matrícula termina: "Marcar como Ex-Alumno" en la ficha (fix-012-i), el cierre de una
-- promoción profesional (cascade_promotion_status_to_courses, fix-196-m) y cualquier edición
-- manual.
--
-- RLS sin cambios: es una columna más de enrollments, cubierta por sus policies.
-- Idempotente: ADD COLUMN IF NOT EXISTS, CREATE OR REPLACE, DROP TRIGGER IF EXISTS, y el
-- relleno solo toca filas con completed_at IS NULL.
-- ============================================================================

ALTER TABLE public.enrollments
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

COMMENT ON COLUMN public.enrollments.completed_at IS
  'Fecha de egreso: cuándo la matrícula pasó a status = completed. La mantiene el trigger trg_enrollments_completed_at; NULL mientras no esté completed. (fix-266-m)';

-- Relleno de las matrículas que ya estaban completadas. No hay registro de la fecha real, así
-- que se copia updated_at: es la fecha que Ex-Alumnos mostraba hasta ahora, y con eso ningún
-- egresado cambia de año ni de lugar en la lista.
UPDATE public.enrollments
SET    completed_at = COALESCE(updated_at, created_at, NOW())
WHERE  status = 'completed'
  AND  completed_at IS NULL;

CREATE OR REPLACE FUNCTION public.set_enrollment_completed_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.status = 'completed' THEN
    -- Se respeta un valor explícito (import histórico, seed con fechas pasadas).
    IF NEW.completed_at IS NULL THEN
      NEW.completed_at := NOW();
    END IF;
  ELSE
    -- Dejó de estar completada (o nunca lo estuvo): no tiene fecha de egreso.
    NEW.completed_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enrollments_completed_at ON public.enrollments;

-- UPDATE OF status: solo corre cuando la sentencia toca la columna status. Un pago (que
-- actualiza saldos) o una edición de otro campo no la disparan, así que no mueven la fecha.
CREATE TRIGGER trg_enrollments_completed_at
  BEFORE INSERT OR UPDATE OF status ON public.enrollments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_enrollment_completed_at();

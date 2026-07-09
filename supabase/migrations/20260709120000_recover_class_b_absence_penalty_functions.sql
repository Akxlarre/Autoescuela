-- ============================================================================
-- RF-053 — Recuperación en git de mark_end_of_day_class_b_absences() y
-- apply_class_b_absence_penalty(), aplicadas hasta ahora solo vía SQL Editor
-- de Supabase (nunca comiteadas — ver nota de gobernanza en indices/DATABASE.md
-- línea ~119). Reconstruidas a partir del código real vigente en producción,
-- confirmado por el dueño el 2026-07-09.
--
-- Fixes aplicados sobre la versión de producción (fix-028):
--   1. mark_end_of_day_class_b_absences(): el UPDATE que marca 'no_show' ahora
--      exige `AND status = 'scheduled'`. El cursor del loop es un snapshot
--      tomado al inicio de la función; si una fila posterior del mismo batch
--      ya fue cancelada por apply_class_b_absence_penalty() invocada en una
--      iteración anterior (mismo run), el loop ya NO la sobreescribe de vuelta
--      a 'no_show' cuando le toca su turno.
--   2. apply_class_b_absence_penalty(): el UPDATE de cancelación ahora acota
--      `AND cs.class_number BETWEEN 1 AND 12`, para no cancelar (ni depender
--      de) filas fuera del rango válido de una matrícula Clase B.
-- ============================================================================

-- 1. apply_class_b_absence_penalty(p_enrollment_id INT)
CREATE OR REPLACE FUNCTION public.apply_class_b_absence_penalty(p_enrollment_id INT)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_cancelled_count INT;
BEGIN
  -- Todo en UNA sola sentencia: detecta el par consecutivo (N, N+1) con
  -- inasistencia no justificada y cancela en el mismo paso — sin ventana
  -- entre "chequear" y "actuar". 'scheduled' (sin filtro de fecha) es la
  -- única condición: cualquier sesión aún no resuelta es cancelable.
  -- fix-028: se acota a class_number 1-12 — una matrícula Clase B nunca
  -- debe tener (ni penalizar) sesiones fuera de ese rango.
  WITH cancelled AS (
    UPDATE public.class_b_sessions cs
    SET    status       = 'cancelled',
           cancelled_at = NOW()
    WHERE  cs.enrollment_id = p_enrollment_id
      AND  cs.status        = 'scheduled'
      AND  cs.class_number BETWEEN 1 AND 12
      AND EXISTS (
        SELECT 1
        FROM public.class_b_sessions cs1
        JOIN public.class_b_practice_attendance cba1
          ON cba1.class_b_session_id = cs1.id
        JOIN public.class_b_sessions cs2
          ON cs2.enrollment_id = cs1.enrollment_id
         AND cs2.class_number   = cs1.class_number + 1
        JOIN public.class_b_practice_attendance cba2
          ON cba2.class_b_session_id = cs2.id
        WHERE cs1.enrollment_id = p_enrollment_id
          AND cba1.status IN ('absent', 'no_show')
          AND cba2.status IN ('absent', 'no_show')
      )
    RETURNING cs.id
  )
  SELECT COUNT(*) INTO v_cancelled_count FROM cancelled;

  RETURN v_cancelled_count;
END;
$$;

COMMENT ON FUNCTION public.apply_class_b_absence_penalty(INT) IS
  'RF-053: 2 inasistencias no justificadas consecutivas (class_number adyacente N, N+1) = pérdida de agenda. '
  'Cancela atómicamente (detección + UPDATE en una sola sentencia) toda sesión ''scheduled'' de la matrícula '
  'con class_number entre 1 y 12 (fix-028: nunca toca filas fuera de rango). '
  'Llamada por mark_end_of_day_class_b_absences() y por AsistenciaClaseBFacade.markAttendance() vía supabase.rpc(). '
  'Retorna la cantidad de sesiones canceladas (0 si no aplica). SECURITY DEFINER.';

-- 2. mark_end_of_day_class_b_absences()
CREATE OR REPLACE FUNCTION public.mark_end_of_day_class_b_absences()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row RECORD;
  v_updated_id INT;
BEGIN
  FOR v_row IN
    SELECT cs.id AS session_id, cs.enrollment_id, e.student_id
    FROM public.class_b_sessions cs
    JOIN public.enrollments e ON e.id = cs.enrollment_id
    WHERE cs.status = 'scheduled'
      AND cs.scheduled_at IS NOT NULL
      -- <= (no <): el cron corre a las 21:00 CLT, dentro del mismo día hábil
      -- que se está cerrando, no la mañana siguiente. Compara por fecha
      -- calendario en America/Santiago, no en la zona horaria del servidor.
      AND (cs.scheduled_at AT TIME ZONE 'America/Santiago')::date
          <= (NOW() AT TIME ZONE 'America/Santiago')::date
    -- Orden determinista por matrícula y clase — no afecta la corrección
    -- (la detección de consecutividad ya no depende del orden), pero hace
    -- el comportamiento predecible y más fácil de auditar en logs.
    ORDER BY cs.enrollment_id, cs.class_number ASC
  LOOP
    BEGIN
      -- fix-028: guard `AND status = 'scheduled'`. El cursor de este loop es
      -- un snapshot tomado al inicio de la función; si esta fila ya fue
      -- cancelada por apply_class_b_absence_penalty() en una iteración
      -- anterior de este mismo run (porque comparte matrícula con una fila
      -- procesada antes en el batch), sin este guard el UPDATE la
      -- sobreescribía de 'cancelled' de vuelta a 'no_show'.
      UPDATE public.class_b_sessions
      SET    status = 'no_show'
      WHERE  id = v_row.session_id
        AND  status = 'scheduled'
      RETURNING id INTO v_updated_id;

      IF v_updated_id IS NOT NULL THEN
        INSERT INTO public.class_b_practice_attendance (class_b_session_id, student_id, status)
        VALUES (v_row.session_id, v_row.student_id, 'absent')
        ON CONFLICT (class_b_session_id, student_id) DO NOTHING;

        PERFORM public.apply_class_b_absence_penalty(v_row.enrollment_id);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- Aísla la falla: un dato inesperado en UNA sesión/matrícula ya NO
      -- aborta el resto del batch nocturno (antes, cualquier excepción acá
      -- revertía TODA la transacción del cron, dejando sin procesar a
      -- alumnos completamente sanos que ya se habían marcado en la misma
      -- corrida).
      RAISE WARNING 'mark_end_of_day_class_b_absences: fallo procesando session_id=% (enrollment_id=%): %',
        v_row.session_id, v_row.enrollment_id, SQLERRM;
    END;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.mark_end_of_day_class_b_absences() IS
  'RF-053. Invocada por pg_cron a las 01:00 UTC (≈21:00 CLT invierno, fin de jornada). Recorre class_b_sessions '
  'en status=''scheduled'' cuya fecha (America/Santiago) sea hoy o anterior y las marca ''no_show'', insertando '
  'class_b_practice_attendance(status=''absent'') por alumno (idempotente). Por cada matrícula afectada invoca '
  'apply_class_b_absence_penalty(). fix-028: guarda ''AND status=scheduled'' antes de marcar no_show para no '
  'revertir cancelaciones aplicadas en la misma corrida por una iteración anterior. Cada fila corre en su propio '
  'bloque BEGIN/EXCEPTION — una excepción en una fila no aborta el resto del batch. SECURITY DEFINER.';

-- 3. Registrar/actualizar el job en pg_cron (idempotente: unschedule + re-create)
SELECT cron.unschedule('mark-end-of-day-class-b-absences')
  WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'mark-end-of-day-class-b-absences'
  );

SELECT cron.schedule(
  'mark-end-of-day-class-b-absences',
  '0 1 * * *',   -- diariamente a las 01:00 UTC (≈ 21:00 CLT invierno)
  $$ SELECT public.mark_end_of_day_class_b_absences(); $$
);

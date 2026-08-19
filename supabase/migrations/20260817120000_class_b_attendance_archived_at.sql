-- ============================================================================
-- fix-191-m — Vigencia de la asistencia práctica Clase B (`archived_at`)
--
-- Problema:
-- El reagendamiento masivo (RF-053, `AdminAlumnoDetalleFacade.reagendarClasesPenalizadas`)
-- RECICLA la misma fila de `class_b_sessions` (nuevo `scheduled_at`, status vuelve a
-- 'scheduled') y conserva a propósito la fila de `class_b_practice_attendance` con la
-- inasistencia de la ocurrencia anterior, para no perder la auditoría.
--
-- Pero esa fila no tenía forma de declararse histórica, así que todo consumidor que
-- deriva estado desde la asistencia (Asistencia B, vistas del alumno) seguía viendo
-- 'absent' sobre una clase agendada, y — peor — `apply_class_b_absence_penalty()` volvía
-- a detectar el par de faltas consecutivas y cancelaba de nuevo las clases recién
-- reagendadas.
--
-- Solución: marca de vigencia. `archived_at IS NULL` = la asistencia describe el estado
-- actual de la sesión. `archived_at IS NOT NULL` = registro histórico de una ocurrencia
-- anterior de esa misma fila de sesión (se conserva para auditoría, no cuenta para nada).
-- ============================================================================

-- 1. Columna de vigencia
ALTER TABLE public.class_b_practice_attendance
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

COMMENT ON COLUMN public.class_b_practice_attendance.archived_at IS
  'fix-191-m. NULL = asistencia vigente (describe el estado actual de class_b_session_id). '
  'NOT NULL = registro histórico de una ocurrencia anterior de esa sesión, archivado al '
  'reagendarla (RF-053). Se conserva para auditoría; NO cuenta para estado, KPIs, alertas '
  'de faltas consecutivas ni apply_class_b_absence_penalty().';

-- Índice parcial: todas las lecturas de estado filtran por vigencia.
CREATE INDEX IF NOT EXISTS idx_class_b_practice_attendance_vigente
  ON public.class_b_practice_attendance (class_b_session_id)
  WHERE archived_at IS NULL;

-- 2. Backfill — repara las filas ya huérfanas
-- Una sesión en 'scheduled' cuya fecha es POSTERIOR al registro de una inasistencia solo
-- puede haber llegado ahí por reciclaje (reagendamiento): la falta se registró sobre una
-- ocurrencia que esa fila ya no representa.
UPDATE public.class_b_practice_attendance cba
SET    archived_at = COALESCE(cba.recorded_at, NOW())
FROM   public.class_b_sessions cs
WHERE  cs.id = cba.class_b_session_id
  AND  cba.archived_at IS NULL
  AND  cba.status IN ('absent', 'no_show', 'excused')
  AND  cs.status = 'scheduled'
  AND  cs.scheduled_at IS NOT NULL
  AND  cba.recorded_at IS NOT NULL
  AND  cs.scheduled_at > cba.recorded_at;

-- 3. apply_class_b_absence_penalty() — solo cuenta faltas vigentes
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
  -- fix-028: se acota a class_number 1-12.
  -- fix-191-m: `archived_at IS NULL` en ambas patas del par. Sin esto, una falta
  -- ya reagendada seguía siendo detectable para siempre y volvía a cancelar las
  -- clases nuevas apenas se ejecutaba la penalización otra vez.
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
         AND cba1.archived_at IS NULL
        JOIN public.class_b_sessions cs2
          ON cs2.enrollment_id = cs1.enrollment_id
         AND cs2.class_number   = cs1.class_number + 1
        JOIN public.class_b_practice_attendance cba2
          ON cba2.class_b_session_id = cs2.id
         AND cba2.archived_at IS NULL
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
  'fix-191-m: solo considera asistencia vigente (archived_at IS NULL) — una falta ya reagendada no vuelve a penalizar. '
  'Llamada por mark_end_of_day_class_b_absences() y por AsistenciaClaseBFacade.markAttendance() vía supabase.rpc(). '
  'Retorna la cantidad de sesiones canceladas (0 si no aplica). SECURITY DEFINER.';

-- 4. mark_end_of_day_class_b_absences() — reactiva la fila archivada en vez de saltarla
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
    ORDER BY cs.enrollment_id, cs.class_number ASC
  LOOP
    BEGIN
      -- fix-028: guard `AND status = 'scheduled'` — el cursor es un snapshot y una
      -- fila ya cancelada por apply_class_b_absence_penalty() en este mismo run no
      -- debe volver a 'no_show'.
      UPDATE public.class_b_sessions
      SET    status = 'no_show'
      WHERE  id = v_row.session_id
        AND  status = 'scheduled'
      RETURNING id INTO v_updated_id;

      IF v_updated_id IS NOT NULL THEN
        -- fix-191-m: era `DO NOTHING`, que con la fila histórica de un reagendamiento
        -- previo (misma UNIQUE (session, student)) hacía que la inasistencia a la clase
        -- REAGENDADA no se registrara nunca. Ahora reactiva esa fila: la sesión volvió a
        -- ocurrir, así que su asistencia vuelve a ser vigente.
        INSERT INTO public.class_b_practice_attendance (class_b_session_id, student_id, status)
        VALUES (v_row.session_id, v_row.student_id, 'absent')
        ON CONFLICT (class_b_session_id, student_id) DO UPDATE
        SET status        = 'absent',
            justification = NULL,
            archived_at   = NULL,
            recorded_at   = NOW()
        WHERE public.class_b_practice_attendance.archived_at IS NOT NULL;

        PERFORM public.apply_class_b_absence_penalty(v_row.enrollment_id);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- Aísla la falla: un dato inesperado en UNA sesión/matrícula no aborta el batch.
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
  'apply_class_b_absence_penalty(). fix-028: guarda ''AND status=scheduled'' antes de marcar no_show. '
  'fix-191-m: el ON CONFLICT reactiva (archived_at = NULL) la fila histórica de un reagendamiento previo en vez '
  'de saltarla — sin esto, la inasistencia a una clase reagendada nunca quedaba registrada. '
  'Cada fila corre en su propio bloque BEGIN/EXCEPTION. SECURITY DEFINER.';

-- ============================================================================
-- fix-384-m — Un par de faltas ya penalizado no vuelve a contar; el cierre nocturno solo toca
-- matrículas activas
-- ============================================================================
-- J07: tras la penalización (RF-053) por las faltas N y N+1, reagendar solo las clases canceladas
-- dejaba el par vivo: cualquier llamada posterior a apply_class_b_absence_penalty() (otra falta,
-- aunque no fuera seguida, o el cron) volvía a cancelar todo lo reagendado.
-- Decisión: un par que ya causó una penalización no vuelve a contar. Se guarda cuándo se aplicó la
-- última penalización de la matrícula; un par cuenta solo si sus DOS faltas son posteriores.
--
-- I04: mark_end_of_day_class_b_absences() marcaba no_show + ausente en matrículas no activas.
--
-- Idempotente.
-- ============================================================================

ALTER TABLE public.enrollments
  ADD COLUMN IF NOT EXISTS absence_penalty_applied_at timestamptz;

COMMENT ON COLUMN public.enrollments.absence_penalty_applied_at IS
  'fix-384-m: última vez que apply_class_b_absence_penalty() canceló clases de esta matrícula. '
  'Un par de faltas cuenta para una nueva penalización solo si sus dos faltas son posteriores.';


CREATE OR REPLACE FUNCTION public.apply_class_b_absence_penalty(p_enrollment_id integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_branch_id       INT;
  v_role            TEXT;
  v_enabled         BOOLEAN;
  v_since           TIMESTAMPTZ;
  v_penalized_at    TIMESTAMPTZ;
  v_cancelled_count INT;
BEGIN
  SELECT e.branch_id, e.absence_penalty_applied_at
    INTO v_branch_id, v_penalized_at
  FROM public.enrollments e WHERE e.id = p_enrollment_id;

  -- fix-191-b: desde la app, solo admin o secretaria de la sede. Desde el cron
  -- (mark_end_of_day_class_b_absences, sin sesión) no hay usuario que validar.
  IF auth.uid() IS NOT NULL THEN
    v_role := public.auth_user_role();
    IF NOT (v_role = 'admin' OR (v_role = 'secretary' AND public.branch_visible(v_branch_id))) THEN
      RAISE EXCEPTION 'No tienes permiso para aplicar la penalización de esta matrícula.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Spec 0048-b: sin sede, sin fila de configuración o desactivada → -1, sin tocar nada.
  SELECT c.auto_cancel_enabled, c.enabled_since
    INTO v_enabled, v_since
  FROM public.branch_absence_penalty_config c
  WHERE c.branch_id = v_branch_id;

  IF NOT COALESCE(v_enabled, false) OR v_since IS NULL THEN
    RETURN -1;
  END IF;

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
          AND cba1.recorded_at >= v_since
          AND cba2.recorded_at >= v_since
          -- fix-384-m: un par que ya causó una penalización no vuelve a contar.
          AND (v_penalized_at IS NULL OR cba1.recorded_at > v_penalized_at)
          AND (v_penalized_at IS NULL OR cba2.recorded_at > v_penalized_at)
      )
    RETURNING cs.id
  )
  SELECT COUNT(*) INTO v_cancelled_count FROM cancelled;

  IF v_cancelled_count > 0 THEN
    UPDATE public.enrollments
    SET absence_penalty_applied_at = NOW()
    WHERE id = p_enrollment_id;
  END IF;

  RETURN v_cancelled_count;
END;
$function$;


CREATE OR REPLACE FUNCTION public.mark_end_of_day_class_b_absences()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
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
      -- fix-384-m: solo matrículas activas (antes marcaba también retiradas/egresadas).
      AND e.status = 'active'
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
$function$;

-- Spec 0056-b: una clase en un feriado no es una inasistencia.
--
-- 1. mark_end_of_day_class_b_absences() (copia de fix-384-m): si la clase agendada cae en un día de
--    public.holidays y nadie la inició, la cancela. No crea asistencia "Ausente" ni llama a la
--    penalización. Las clases iniciadas o completadas no se tocan (el cron solo mira 'scheduled').
-- 2. v_class_b_sessions_on_holiday: la lee la alerta "clases en día feriado" del dashboard.
--    Lista (a) las agendadas en un feriado de hoy en adelante y (b) las canceladas en un feriado a
--    partir del inicio de ese día (lo que cancela el cron, aunque corra un día tarde). Una
--    cancelación hecha antes del feriado, o una matrícula penalizada desde ese día (2 faltas
--    seguidas, "Borrar horarios"), no entra: esa clase se perdió por la penalización. Al reagendar,
--    la clase cambia de fecha y sale de la vista.
--
-- Idempotente.

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
    SELECT cs.id AS session_id, cs.enrollment_id, e.student_id,
           -- spec 0056-b: el día de la clase es feriado.
           EXISTS (
             SELECT 1 FROM public.holidays h
             WHERE h.date = public.chile_date(cs.scheduled_at)
           ) AS is_holiday
    FROM public.class_b_sessions cs
    JOIN public.enrollments e ON e.id = cs.enrollment_id
    WHERE cs.status = 'scheduled'
      AND cs.scheduled_at IS NOT NULL
      -- fix-384-m: solo matrículas activas (antes marcaba también retiradas/egresadas).
      AND e.status = 'active'
      -- <= (no <): el cron corre a las 21:00 CLT, dentro del mismo día hábil
      -- que se está cerrando, no la mañana siguiente. Compara por fecha
      -- calendario en America/Santiago, no en la zona horaria del servidor.
      AND public.chile_date(cs.scheduled_at) <= public.chile_today()
    ORDER BY cs.enrollment_id, cs.class_number ASC
  LOOP
    BEGIN
      IF v_row.is_holiday THEN
        -- spec 0056-b: la escuela no abre los feriados. Sin falta ni penalización; la alerta
        -- "clases en día feriado" la deja a la vista para reagendarla.
        UPDATE public.class_b_sessions
        SET    status = 'cancelled',
               cancelled_at = NOW()
        WHERE  id = v_row.session_id
          AND  status = 'scheduled';
        CONTINUE;
      END IF;

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

CREATE OR REPLACE VIEW public.v_class_b_sessions_on_holiday
WITH (security_invoker = true) AS
SELECT
  cs.id            AS session_id,
  cs.enrollment_id,
  e.branch_id,
  cs.class_number,
  cs.scheduled_at,
  cs.status,
  h.date           AS holiday_date,
  h.name           AS holiday_name
FROM public.class_b_sessions cs
JOIN public.enrollments e ON e.id = cs.enrollment_id
JOIN public.holidays h
  ON h.date = public.chile_date(cs.scheduled_at)
WHERE e.status = 'active'
  AND (
    (cs.status = 'scheduled' AND h.date >= public.chile_today())
    OR (
      cs.status = 'cancelled'
      AND cs.cancelled_at >= public.chile_day_start(h.date)
      -- Penalizada desde ese día (2 faltas seguidas, "Borrar horarios"): perdió la agenda, no se
      -- reagenda por el feriado.
      AND (e.absence_penalty_applied_at IS NULL
           OR e.absence_penalty_applied_at < public.chile_day_start(h.date))
      -- Antes de esta spec el cron nunca cancelaba por feriado: una cancelación anterior es de
      -- otra causa (penalizaciones de antes de fix-384-m, sin absence_penalty_applied_at).
      AND cs.cancelled_at >= public.chile_day_start(DATE '2026-11-06')
    )
  );

COMMENT ON VIEW public.v_class_b_sessions_on_holiday IS
  'Spec 0056-b: clases B por reagendar porque caen en un feriado (agendadas de hoy en adelante, o '
  'canceladas desde el inicio del feriado: las que cancela el cron). security_invoker: cada fila la '
  'filtra la RLS de class_b_sessions/enrollments de quien la lee.';

GRANT SELECT ON public.v_class_b_sessions_on_holiday TO authenticated, service_role;

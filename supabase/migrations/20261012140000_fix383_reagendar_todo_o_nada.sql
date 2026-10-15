-- ============================================================================
-- fix-383-m — Reagendamiento masivo de Clase B en una sola transacción
-- ============================================================================
-- "Reagendar Clases" (RF-053) movía las clases una por una desde el navegador y guardaba el
-- historial al final: si un horario chocaba a mitad (trigger de doble agendamiento) o se cortaba
-- la red, quedaban unas clases movidas, otras no, y ninguna fila de historial.
--
-- reschedule_class_b_sessions() hace todo en una transacción: cualquier error revierte todo.
-- SECURITY INVOKER: la RLS de quien llama sigue aplicando (sesiones, asistencia, historial).
-- Idempotente.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.reschedule_class_b_sessions(
  p_enrollment_id INT,
  p_instructor_id INT,
  p_items         JSONB,
  p_reason        TEXT,
  p_reason_other  TEXT DEFAULT NULL
)
RETURNS INT
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_item          JSONB;
  v_session_id    INT;
  v_new_at        TIMESTAMPTZ;
  v_old_at        TIMESTAMPTZ;
  v_old_instr     INT;
  v_registered_by INT;
  v_count         INT := 0;
BEGIN
  IF public.auth_user_role() IS DISTINCT FROM 'admin'
     AND public.auth_user_role() IS DISTINCT FROM 'secretary' THEN
    RAISE EXCEPTION 'No tienes permiso para reagendar clases.' USING ERRCODE = '42501';
  END IF;

  IF p_reason IS NULL OR btrim(p_reason) = '' THEN
    RAISE EXCEPTION 'Selecciona una razón para el reagendamiento.' USING ERRCODE = 'P0001';
  END IF;
  IF p_reason = 'otro' AND (p_reason_other IS NULL OR btrim(p_reason_other) = '') THEN
    RAISE EXCEPTION 'Especifica el motivo cuando eliges "Otro".' USING ERRCODE = 'P0001';
  END IF;

  IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'No hay clases para reagendar.' USING ERRCODE = 'P0001';
  END IF;

  SELECT u.id INTO v_registered_by FROM public.users u WHERE u.supabase_uid = auth.uid();

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_session_id := (v_item ->> 'session_id')::INT;
    v_new_at     := (v_item ->> 'scheduled_at')::TIMESTAMPTZ;

    -- La clase tiene que ser de esta matrícula (y visible para quien llama, por RLS).
    SELECT cs.scheduled_at, cs.instructor_id
      INTO v_old_at, v_old_instr
    FROM public.class_b_sessions cs
    WHERE cs.id = v_session_id
      AND cs.enrollment_id = p_enrollment_id
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Una de las clases no pertenece a esta matrícula.' USING ERRCODE = 'P0001';
    END IF;

    -- Recicla la fila (la matrícula siempre tiene sus class_number 1..12). Los triggers de doble
    -- agendamiento (instructor, alumno, vehículo) validan aquí y abortan toda la transacción.
    UPDATE public.class_b_sessions
    SET instructor_id = p_instructor_id,
        vehicle_id    = (v_item ->> 'vehicle_id')::INT,
        scheduled_at  = v_new_at,
        status        = 'scheduled',
        start_time    = NULL,
        end_time      = NULL,
        cancelled_at  = NULL
    WHERE id = v_session_id;

    -- fix-191-m: la asistencia de la ocurrencia anterior pasa al historial.
    UPDATE public.class_b_practice_attendance
    SET archived_at = NOW()
    WHERE class_b_session_id = v_session_id
      AND archived_at IS NULL;

    -- fix-008-i: historial con la fecha e instructor anteriores.
    INSERT INTO public.class_b_reschedule_history (
      class_session_id, enrollment_id, old_scheduled_at, new_scheduled_at,
      old_instructor_id, new_instructor_id, reason, reason_other, registered_by
    ) VALUES (
      v_session_id, p_enrollment_id, v_old_at, v_new_at,
      v_old_instr, p_instructor_id, p_reason,
      CASE WHEN p_reason = 'otro' THEN p_reason_other END, v_registered_by
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION public.reschedule_class_b_sessions(INT, INT, JSONB, TEXT, TEXT) IS
  'fix-383-m: reagendamiento masivo de Clase B (RF-053) en una transacción. p_items = '
  '[{session_id, scheduled_at, vehicle_id}]. Recicla cada sesión, archiva su asistencia vigente e '
  'inserta su historial; cualquier error revierte todo. Solo admin/secretaria; SECURITY INVOKER.';

REVOKE EXECUTE ON FUNCTION public.reschedule_class_b_sessions(INT, INT, JSONB, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reschedule_class_b_sessions(INT, INT, JSONB, TEXT, TEXT) TO authenticated;

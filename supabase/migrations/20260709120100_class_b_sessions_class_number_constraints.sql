-- ============================================================================
-- fix-028 — class_b_sessions.class_number: de comentario a constraint real.
--
-- Hasta ahora "1..12 (secuencia obligatoria)" era solo un comentario de
-- columna; nada en la BD lo garantizaba. AdminAlumnoDetalleFacade
-- .reagendarClasesPenalizadas() insertaba una fila NUEVA con
-- class_number = MAX(existente)+1 al reagendar una sesión 'cancelled',
-- pudiendo superar 12 (caso real detectado: class_number=13).
--
-- Paso 1: repara datos existentes fuera de rango ANTES de aplicar el CHECK,
-- reciclando la sesión >12 dentro de la fila 'cancelled' con el
-- class_number más bajo (1-12) de la misma matrícula — mismo criterio que
-- adoptó el código (recycle in-place) para futuros reagendamientos.
-- Paso 2: agrega CHECK + UNIQUE de forma idempotente.
-- ============================================================================

-- 1. Repara filas fuera de rango 1-12 fusionándolas con una 'cancelled' <=12.
DO $$
DECLARE
  r RECORD;
  v_target_id INT;
BEGIN
  FOR r IN
    SELECT id, enrollment_id, instructor_id, vehicle_id, scheduled_at, status
    FROM public.class_b_sessions
    WHERE class_number IS NOT NULL
      AND class_number NOT BETWEEN 1 AND 12
  LOOP
    SELECT id INTO v_target_id
    FROM public.class_b_sessions
    WHERE enrollment_id = r.enrollment_id
      AND class_number BETWEEN 1 AND 12
      AND status = 'cancelled'
    ORDER BY class_number ASC
    LIMIT 1;

    IF v_target_id IS NOT NULL THEN
      UPDATE public.class_b_sessions
      SET    instructor_id = r.instructor_id,
             vehicle_id    = r.vehicle_id,
             scheduled_at  = r.scheduled_at,
             status        = r.status,
             start_time    = NULL,
             end_time      = NULL
      WHERE  id = v_target_id;

      DELETE FROM public.class_b_practice_attendance WHERE class_b_session_id = v_target_id;
      DELETE FROM public.class_b_sessions WHERE id = r.id;

      RAISE NOTICE 'class_b_sessions: reciclada sesión fuera de rango id=% (enrollment_id=%) dentro de la fila cancelled id=%',
        r.id, r.enrollment_id, v_target_id;
    ELSE
      RAISE WARNING 'class_b_sessions: sesión fuera de rango id=% (enrollment_id=%) SIN fila cancelled disponible para reciclar — requiere revisión manual antes de que el CHECK bloquee futuras corridas.',
        r.id, r.enrollment_id;
    END IF;
  END LOOP;
END $$;

-- 2. Constraints (idempotentes vía chequeo en pg_constraint).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_class_b_sessions_class_number_range'
  ) THEN
    ALTER TABLE public.class_b_sessions
      ADD CONSTRAINT chk_class_b_sessions_class_number_range
      CHECK (class_number BETWEEN 1 AND 12);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_class_b_sessions_enrollment_class_number'
  ) THEN
    ALTER TABLE public.class_b_sessions
      ADD CONSTRAINT uq_class_b_sessions_enrollment_class_number
      UNIQUE (enrollment_id, class_number);
  END IF;
END $$;

COMMENT ON COLUMN public.class_b_sessions.class_number IS
  '1..12, secuencia obligatoria de la matrícula Clase B — reforzado por chk_class_b_sessions_class_number_range '
  'y uq_class_b_sessions_enrollment_class_number (fix-028). Reagendar una sesión cancelled/no_show SIEMPRE recicla '
  'la misma fila/class_number; nunca se inserta una fila nueva.';

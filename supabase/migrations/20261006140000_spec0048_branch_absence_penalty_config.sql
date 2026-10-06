-- ============================================================================
-- Spec 0048-b — Cancelación automática por inasistencias configurable por sede
--
-- RF-053: con 2 faltas en clases consecutivas, apply_class_b_absence_penalty() cancela toda la
-- agenda restante del alumno. La llaman el cron nocturno (mark_end_of_day_class_b_absences) y el
-- "Ausente" manual de Asistencia B. En el piloto, con el portal Instructor bloqueado, cualquier
-- día sin registrar asistencias termina en faltas automáticas: entre el 15 y el 23-sep el cron
-- canceló 174 clases de ~69 matrículas (fix-186-b, S1).
--
-- La regla pasa a ser configurable por sede, desactivada por defecto. La decisión vive en un solo
-- punto (apply_class_b_absence_penalty), así que cubre los dos llamadores.
-- ============================================================================

-- 1. Configuración por sede (patrón branch_payroll_config)
CREATE TABLE IF NOT EXISTS public.branch_absence_penalty_config (
  branch_id           INT PRIMARY KEY REFERENCES public.branches(id),
  auto_cancel_enabled BOOLEAN NOT NULL DEFAULT false,
  enabled_since       TIMESTAMPTZ,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by          INT REFERENCES public.users(id)
);

COMMENT ON TABLE public.branch_absence_penalty_config IS
  'Spec 0048-b. Por sede: si apply_class_b_absence_penalty() cancela la agenda tras 2 faltas '
  'consecutivas. enabled_since = desde cuándo cuentan las faltas (lo fija el trigger al activar).';

ALTER TABLE public.branch_absence_penalty_config ENABLE ROW LEVEL SECURITY;

-- 2. Sello: updated_at/updated_by desde el servidor y enabled_since al activar (AC4, AC6)
CREATE OR REPLACE FUNCTION public.stamp_branch_absence_penalty_config()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''   -- DG-063
AS $$
BEGIN
  NEW.updated_at := now();
  NEW.updated_by := (SELECT u.id FROM public.users u WHERE u.supabase_uid = auth.uid());

  IF NEW.auto_cancel_enabled THEN
    -- Activar (o insertar activada) fija un instante nuevo: las faltas anteriores no cuentan.
    IF TG_OP = 'INSERT' OR NOT OLD.auto_cancel_enabled THEN
      NEW.enabled_since := now();
    END IF;
  ELSE
    NEW.enabled_since := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_branch_absence_penalty_config_stamp ON public.branch_absence_penalty_config;
CREATE TRIGGER trg_branch_absence_penalty_config_stamp
  BEFORE INSERT OR UPDATE ON public.branch_absence_penalty_config
  FOR EACH ROW
  EXECUTE FUNCTION public.stamp_branch_absence_penalty_config();

-- 3. RLS: leen admin y secretaria; escribe solo admin; sin DELETE (AC6)
DROP POLICY IF EXISTS select_branch_absence_penalty_config ON public.branch_absence_penalty_config;
CREATE POLICY select_branch_absence_penalty_config ON public.branch_absence_penalty_config
  FOR SELECT USING ((SELECT public.auth_user_role()) IN ('admin', 'secretary'));

DROP POLICY IF EXISTS insert_branch_absence_penalty_config ON public.branch_absence_penalty_config;
CREATE POLICY insert_branch_absence_penalty_config ON public.branch_absence_penalty_config
  FOR INSERT WITH CHECK ((SELECT public.auth_user_role()) = 'admin');

DROP POLICY IF EXISTS update_branch_absence_penalty_config ON public.branch_absence_penalty_config;
CREATE POLICY update_branch_absence_penalty_config ON public.branch_absence_penalty_config
  FOR UPDATE USING ((SELECT public.auth_user_role()) = 'admin')
  WITH CHECK ((SELECT public.auth_user_role()) = 'admin');

-- 4. Seed: una fila por sede, desactivada (AC1)
INSERT INTO public.branch_absence_penalty_config (branch_id, auto_cancel_enabled)
SELECT id, false FROM public.branches
ON CONFLICT (branch_id) DO NOTHING;

-- 5. La penalización consulta la configuración de la sede de la matrícula
CREATE OR REPLACE FUNCTION public.apply_class_b_absence_penalty(p_enrollment_id INT)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_enabled         BOOLEAN;
  v_since           TIMESTAMPTZ;
  v_cancelled_count INT;
BEGIN
  -- Spec 0048-b: sin sede, sin fila de configuración o desactivada → -1 ("regla desactivada"),
  -- sin tocar nada (AC2, AC-E1). El cron la llama con PERFORM e ignora el valor; el facade de
  -- Asistencia lo usa para avisar a la secretaria (AC-E2).
  SELECT c.auto_cancel_enabled, c.enabled_since
    INTO v_enabled, v_since
  FROM public.enrollments e
  JOIN public.branch_absence_penalty_config c ON c.branch_id = e.branch_id
  WHERE e.id = p_enrollment_id;

  IF NOT COALESCE(v_enabled, false) OR v_since IS NULL THEN
    RETURN -1;
  END IF;

  -- Igual que antes (fix-028: clases 1-12; fix-191-m: solo asistencia vigente), y además
  -- spec 0048-b AC4: las dos faltas del par deben haberse registrado desde la activación.
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
      )
    RETURNING cs.id
  )
  SELECT COUNT(*) INTO v_cancelled_count FROM cancelled;

  RETURN v_cancelled_count;
END;
$$;

COMMENT ON FUNCTION public.apply_class_b_absence_penalty(INT) IS
  'RF-053: 2 inasistencias no justificadas consecutivas (class_number N, N+1) = pérdida de agenda. '
  'Spec 0048-b: solo si la sede de la matrícula tiene auto_cancel_enabled en '
  'branch_absence_penalty_config, y solo con faltas registradas desde enabled_since; si no, '
  'devuelve -1 sin tocar nada. Cancela atómicamente toda sesión ''scheduled'' 1-12 de la matrícula. '
  'fix-191-m: solo asistencia vigente (archived_at IS NULL). Llamada por '
  'mark_end_of_day_class_b_absences() y AsistenciaClaseBFacade vía supabase.rpc(). '
  'Retorna la cantidad de sesiones canceladas (0 si no aplica, -1 si la regla está desactivada).';

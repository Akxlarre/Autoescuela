-- ============================================================================
-- Spec 0010-i (P0, ASG-i-062): la clase 7+ no se inicia sin el segundo pago
--
-- Requisito del cliente: las 12 clases se agendan siempre, pero una clase 7–12 no puede pasar de
-- 'scheduled' a 'in_progress'/'completed' si la matrícula tiene saldo pendiente, salvo que una
-- secretaria o un admin la haya habilitado sin pago con motivo. Va en la BD porque una clase se
-- inicia desde dos lugares (drawer de Asistencia/dashboards y app del instructor).
--
-- 1. enrollment_payment_overrides: registro solo-inserción de habilitaciones sin pago
--    (kind 'clases' en la Entrega 1; 'certificado' en la Entrega 2). Auditada con log_change().
--    El saldo de la constancia (pending_at_override) lo fija la BD, no el cliente.
-- 2. Aviso a todos los admins activos al registrar una habilitación (AC5).
-- 3. Trigger de bloqueo (AC1): lanza PAGO_PENDIENTE_CLASE_7 (token que traduce
--    toFriendlyDbMessage en la app).
-- 4. Aviso a las secretarias de la sede al iniciar una clase 7+ habilitada sin pago y con
--    deuda (AC10).
-- Los avisos nunca abortan la escritura real (EXCEPTION WHEN OTHERS → WARNING).
-- Idempotente: IF NOT EXISTS, CREATE OR REPLACE, DROP ... IF EXISTS.
-- ============================================================================

SET lock_timeout = '5s';

-- ── 1. Tabla de habilitaciones ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.enrollment_payment_overrides (
  id                  SERIAL PRIMARY KEY,
  enrollment_id       INT NOT NULL REFERENCES public.enrollments(id),
  kind                TEXT NOT NULL CHECK (kind IN ('clases', 'certificado')),
  reason              TEXT NOT NULL CHECK (length(btrim(reason)) >= 5),
  pending_at_override INT NOT NULL DEFAULT 0,
  created_by          INT NOT NULL REFERENCES public.users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_enrollment_payment_overrides_enrollment
  ON public.enrollment_payment_overrides (enrollment_id, kind);

COMMENT ON TABLE public.enrollment_payment_overrides IS
  'Spec 0010-i: habilitaciones sin pago (clases 7+ o certificado) con motivo. Solo inserción: '
  'sin policy de UPDATE/DELETE. La lee el trigger de bloqueo de class_b_sessions.';

ALTER TABLE public.enrollment_payment_overrides ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.enrollment_payment_overrides FROM anon;
GRANT SELECT, INSERT ON public.enrollment_payment_overrides TO authenticated;
GRANT USAGE ON SEQUENCE public.enrollment_payment_overrides_id_seq TO authenticated;

-- Mismo alcance de sede que select_enrollments (secretaria: su sede o ambas si corresponde).
DROP POLICY IF EXISTS select_enrollment_payment_overrides ON public.enrollment_payment_overrides;
CREATE POLICY select_enrollment_payment_overrides ON public.enrollment_payment_overrides
  FOR SELECT USING (
    public.auth_user_role() = 'admin'
    OR (
      public.auth_user_role() = 'secretary'
      AND EXISTS (
        SELECT 1 FROM public.enrollments e
        WHERE e.id = enrollment_payment_overrides.enrollment_id
          AND (e.branch_id = (SELECT public.auth_user_branch_id())
               OR (SELECT public.auth_can_access_both_branches()))
      )
    )
  );

DROP POLICY IF EXISTS insert_enrollment_payment_overrides ON public.enrollment_payment_overrides;
CREATE POLICY insert_enrollment_payment_overrides ON public.enrollment_payment_overrides
  FOR INSERT WITH CHECK (
    created_by = public.auth_user_id()
    AND (
      public.auth_user_role() = 'admin'
      OR (
        public.auth_user_role() = 'secretary'
        AND EXISTS (
          SELECT 1 FROM public.enrollments e
          WHERE e.id = enrollment_payment_overrides.enrollment_id
            AND (e.branch_id = (SELECT public.auth_user_branch_id())
                 OR (SELECT public.auth_can_access_both_branches()))
        )
      )
    )
  );

-- El saldo de la constancia sale de la BD, nunca del payload del cliente.
CREATE OR REPLACE FUNCTION public.set_payment_override_pending()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.pending_at_override := COALESCE(
    (SELECT e.pending_balance FROM public.enrollments e WHERE e.id = NEW.enrollment_id), 0);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_payment_override_pending ON public.enrollment_payment_overrides;
CREATE TRIGGER trg_set_payment_override_pending
  BEFORE INSERT ON public.enrollment_payment_overrides
  FOR EACH ROW EXECUTE FUNCTION public.set_payment_override_pending();

DROP TRIGGER IF EXISTS trg_audit_enrollment_payment_overrides ON public.enrollment_payment_overrides;
CREATE TRIGGER trg_audit_enrollment_payment_overrides
  AFTER INSERT OR UPDATE OR DELETE ON public.enrollment_payment_overrides
  FOR EACH ROW EXECUTE FUNCTION public.log_change();

-- ── 2. Aviso a los admins al habilitar sin pago (AC5) ──────────────────────
CREATE OR REPLACE FUNCTION public.notify_payment_override()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_student_name TEXT;
  v_actor_name   TEXT;
  v_admin_id     INT;
BEGIN
  SELECT TRIM(COALESCE(SPLIT_PART(u.first_names, ' ', 1), '') || ' ' || COALESCE(u.paternal_last_name, ''))
  INTO v_student_name
  FROM public.enrollments e
  JOIN public.students s ON s.id = e.student_id
  JOIN public.users u ON u.id = s.user_id
  WHERE e.id = NEW.enrollment_id;

  SELECT TRIM(COALESCE(SPLIT_PART(u.first_names, ' ', 1), '') || ' ' || COALESCE(u.paternal_last_name, ''))
  INTO v_actor_name
  FROM public.users u WHERE u.id = NEW.created_by;

  FOR v_admin_id IN
    SELECT u.id FROM public.users u
    JOIN public.roles r ON r.id = u.role_id
    WHERE r.name = 'admin' AND u.active = true
  LOOP
    INSERT INTO public.notifications
      (recipient_id, type, subject, message, reference_type, reference_id, read, sent_ok)
    VALUES
      (v_admin_id, 'system',
       CASE NEW.kind WHEN 'clases' THEN 'Clases habilitadas sin pago'
                     ELSE 'Certificado emitido con deuda' END,
       COALESCE(v_actor_name, 'Alguien') || ' habilitó a ' || COALESCE(v_student_name, 'un alumno') ||
       ' con una deuda de $' || replace(to_char(NEW.pending_at_override, 'FM999,999,999'), ',', '.') ||
       '. Motivo: ' || NEW.reason,
       'enrollment', NEW.enrollment_id, false, true);
  END LOOP;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_payment_override error (override_id=%): %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notify_payment_override ON public.enrollment_payment_overrides;
CREATE TRIGGER trg_notify_payment_override
  AFTER INSERT ON public.enrollment_payment_overrides
  FOR EACH ROW EXECUTE FUNCTION public.notify_payment_override();

-- ── 3. Bloqueo de la clase 7+ (AC1, AC2, AC-E1–E3) ─────────────────────────
-- Toda ENTRADA a iniciada/completada desde un estado que no lo era (scheduled, no_show, etc.):
-- solo mirar 'scheduled' dejaba pasar no_show → in_progress. Finalizar una clase ya iniciada
-- (in_progress → completed) y marcarla ausente (no_show) no se bloquean. El saldo solo baja con
-- pagos 'paid' (recalculate_enrollment_balance), así que un pago 'pending' no desbloquea.
CREATE OR REPLACE FUNCTION public.block_class_b_without_second_payment()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF COALESCE((SELECT e.pending_balance FROM public.enrollments e WHERE e.id = NEW.enrollment_id), 0) > 0
     AND NOT EXISTS (
       SELECT 1 FROM public.enrollment_payment_overrides o
       WHERE o.enrollment_id = NEW.enrollment_id AND o.kind = 'clases')
  THEN
    RAISE EXCEPTION 'PAGO_PENDIENTE_CLASE_7' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_block_class_b_without_second_payment ON public.class_b_sessions;
CREATE TRIGGER trg_block_class_b_without_second_payment
  BEFORE UPDATE OF status ON public.class_b_sessions
  FOR EACH ROW
  WHEN (OLD.status NOT IN ('in_progress', 'completed')
        AND NEW.status IN ('in_progress', 'completed')
        AND NEW.class_number >= 7)
  EXECUTE FUNCTION public.block_class_b_without_second_payment();

-- ── 4. Aviso a secretarias: clase habilitada sin pago que se inicia (AC10) ──
CREATE OR REPLACE FUNCTION public.notify_class_b_started_with_debt()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_branch_id    INT;
  v_pending      INT;
  v_student_name TEXT;
  v_secretary_id INT;
BEGIN
  SELECT e.branch_id, e.pending_balance,
         TRIM(COALESCE(SPLIT_PART(u.first_names, ' ', 1), '') || ' ' || COALESCE(u.paternal_last_name, ''))
  INTO v_branch_id, v_pending, v_student_name
  FROM public.enrollments e
  JOIN public.students s ON s.id = e.student_id
  JOIN public.users u ON u.id = s.user_id
  WHERE e.id = NEW.enrollment_id;

  -- Solo con deuda (si ya pagó, no hay aviso). Si llegó acá con deuda es porque estaba habilitada:
  -- el bloqueo (BEFORE) ya habría rechazado el cambio.
  IF v_branch_id IS NOT NULL AND COALESCE(v_pending, 0) > 0 THEN
    FOR v_secretary_id IN
      SELECT u.id FROM public.users u
      JOIN public.roles r ON r.id = u.role_id
      WHERE r.name = 'secretary' AND u.branch_id = v_branch_id AND u.active = true
    LOOP
      INSERT INTO public.notifications
        (recipient_id, type, subject, message, reference_type, reference_id, read, sent_ok)
      VALUES
        (v_secretary_id, 'system', 'Clase sin pago',
         v_student_name || ' está tomando la clase ' || NEW.class_number ||
         ' sin haber pagado: debe $' || replace(to_char(v_pending, 'FM999,999,999'), ',', '.') || '.',
         'class_b', NEW.enrollment_id, false, true);
    END LOOP;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_class_b_started_with_debt error (session_id=%): %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notify_class_b_started_with_debt ON public.class_b_sessions;
CREATE TRIGGER trg_notify_class_b_started_with_debt
  AFTER UPDATE OF status ON public.class_b_sessions
  FOR EACH ROW
  WHEN (OLD.status NOT IN ('in_progress', 'completed')
        AND NEW.status = 'in_progress'
        AND NEW.class_number >= 7)
  EXECUTE FUNCTION public.notify_class_b_started_with_debt();

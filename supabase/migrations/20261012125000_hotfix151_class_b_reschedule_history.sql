-- ============================================================================
-- hotfix-151-m — Versiona class_b_reschedule_history
-- ============================================================================
-- El historial de reagendamientos de Clase B (fix-008-i) existe en la BD pero ninguna migración lo
-- creaba: una BD levantada desde supabase/migrations no lo tendría. Esta migración lo describe tal
-- como está en la BD de dev (columnas, FKs, índice, RLS y políticas). Idempotente: sobre una BD que
-- ya tiene la tabla no cambia nada.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.class_b_reschedule_history (
  id                SERIAL PRIMARY KEY,
  class_session_id  INT         NOT NULL REFERENCES public.class_b_sessions(id),
  enrollment_id     INT         NOT NULL REFERENCES public.enrollments(id),
  old_scheduled_at  TIMESTAMPTZ,
  new_scheduled_at  TIMESTAMPTZ NOT NULL,
  old_instructor_id INT         REFERENCES public.instructors(id),
  new_instructor_id INT         NOT NULL REFERENCES public.instructors(id),
  reason            TEXT        NOT NULL,
  reason_other      TEXT,
  registered_by     INT         REFERENCES public.users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_class_b_reschedule_history_enrollment_id
  ON public.class_b_reschedule_history (enrollment_id);

ALTER TABLE public.class_b_reschedule_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS select_class_b_reschedule_history ON public.class_b_reschedule_history;
CREATE POLICY select_class_b_reschedule_history ON public.class_b_reschedule_history
  FOR SELECT USING (public.auth_user_role() = ANY (ARRAY['admin', 'secretary']));

DROP POLICY IF EXISTS insert_class_b_reschedule_history ON public.class_b_reschedule_history;
CREATE POLICY insert_class_b_reschedule_history ON public.class_b_reschedule_history
  FOR INSERT WITH CHECK (public.auth_user_role() = ANY (ARRAY['admin', 'secretary']));

DROP POLICY IF EXISTS update_class_b_reschedule_history ON public.class_b_reschedule_history;
CREATE POLICY update_class_b_reschedule_history ON public.class_b_reschedule_history
  FOR UPDATE USING (public.auth_user_role() = ANY (ARRAY['admin', 'secretary']));

DROP POLICY IF EXISTS delete_class_b_reschedule_history ON public.class_b_reschedule_history;
CREATE POLICY delete_class_b_reschedule_history ON public.class_b_reschedule_history
  FOR DELETE USING (public.auth_user_role() = ANY (ARRAY['admin', 'secretary']));

COMMENT ON TABLE public.class_b_reschedule_history IS
  'fix-008-i: historial de reagendamientos de clases prácticas Clase B (fecha/instructor anterior y '
  'nuevo, razón). Lo escribe reschedule_class_b_sessions() (fix-383-m) y reprogramarClase().';

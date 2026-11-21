-- ============================================================================
-- spec 0058-b: "Reactivar horario" deshace solo el último "Eliminar horario"
-- ============================================================================
-- Antes, Reactivar volvía a 'scheduled' TODAS las clases futuras canceladas de la matrícula,
-- vinieran de "Eliminar horario", de la penalización automática, de un feriado o del instructor,
-- y no devolvía el sello de penalización. Desde aquí:
--   1. class_b_schedule_removals registra cada eliminación (quién, cuándo, sello anterior).
--   2. class_b_sessions.schedule_removal_id liga cada clase a la eliminación que la canceló.
--      SOLO remove_class_b_schedule() la escribe: toda otra cancelación queda en NULL y nunca
--      se revive con Reactivar.
--   3. remove_class_b_schedule(): cancela + registra + liga + sella, en una transacción.
--   4. reactivate_class_b_schedule(): revive solo lo ligado y futuro de la ÚLTIMA eliminación
--      de la matrícula y devuelve el sello a su valor anterior.
--   5. reschedule_class_b_sessions(): al reciclar una fila suelta el vínculo.
--   6. audit_humanize_column(): etiqueta de la columna nueva (class_b_sessions se audita).
-- Datos existentes: 0 clases futuras canceladas al 2026-11-09, sin backfill.
-- Test: supabase/tests/asistencia/spec0058b-reactivar-deshace-eliminar.sql
-- Idempotente.
-- ============================================================================

-- ── 1. Registro de eliminaciones ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.class_b_schedule_removals (
  id                          INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  enrollment_id               INT NOT NULL REFERENCES public.enrollments(id) ON DELETE CASCADE,
  removed_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  removed_by                  INT REFERENCES public.users(id),
  previous_penalty_applied_at TIMESTAMPTZ,
  reactivated_at              TIMESTAMPTZ,
  reactivated_by              INT REFERENCES public.users(id),
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.class_b_schedule_removals IS
  'spec 0058-b: cada "Eliminar horario". Reactivar deshace solo la última de la matrícula.';
COMMENT ON COLUMN public.class_b_schedule_removals.previous_penalty_applied_at IS
  'enrollments.absence_penalty_applied_at antes de eliminar; Reactivar lo restaura (NULL = no había).';

CREATE INDEX IF NOT EXISTS idx_class_b_schedule_removals_enrollment
  ON public.class_b_schedule_removals (enrollment_id, id DESC);

ALTER TABLE public.class_b_schedule_removals ENABLE ROW LEVEL SECURITY;

-- Admin y secretaria; la secretaria solo en matrículas que ve por la RLS de enrollments (su sede).
DROP POLICY IF EXISTS select_class_b_schedule_removals ON public.class_b_schedule_removals;
CREATE POLICY select_class_b_schedule_removals ON public.class_b_schedule_removals
  FOR SELECT TO authenticated
  USING (public.auth_user_role() IN ('admin', 'secretary')
         AND enrollment_id IN (SELECT e.id FROM public.enrollments e));

DROP POLICY IF EXISTS insert_class_b_schedule_removals ON public.class_b_schedule_removals;
CREATE POLICY insert_class_b_schedule_removals ON public.class_b_schedule_removals
  FOR INSERT TO authenticated
  WITH CHECK (public.auth_user_role() IN ('admin', 'secretary')
              AND enrollment_id IN (SELECT e.id FROM public.enrollments e));

DROP POLICY IF EXISTS update_class_b_schedule_removals ON public.class_b_schedule_removals;
CREATE POLICY update_class_b_schedule_removals ON public.class_b_schedule_removals
  FOR UPDATE TO authenticated
  USING (public.auth_user_role() IN ('admin', 'secretary')
         AND enrollment_id IN (SELECT e.id FROM public.enrollments e))
  WITH CHECK (public.auth_user_role() IN ('admin', 'secretary')
              AND enrollment_id IN (SELECT e.id FROM public.enrollments e));
-- Sin policy de DELETE: nadie borra el rastro.

REVOKE ALL ON public.class_b_schedule_removals FROM anon;

-- ── 2. Vínculo clase → eliminación ──────────────────────────────────────────────────────────
ALTER TABLE public.class_b_sessions
  ADD COLUMN IF NOT EXISTS schedule_removal_id INT
    REFERENCES public.class_b_schedule_removals(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.class_b_sessions.schedule_removal_id IS
  'spec 0058-b: eliminación que canceló la clase. Solo la escribe remove_class_b_schedule().';

CREATE INDEX IF NOT EXISTS idx_class_b_sessions_schedule_removal
  ON public.class_b_sessions (schedule_removal_id) WHERE schedule_removal_id IS NOT NULL;

-- ── 3. Eliminar horario ─────────────────────────────────────────────────────────────────────
-- p_session_ids: "Borrar horarios" del dashboard pasa los ids que el usuario vio en el diálogo;
-- Asistencia lo deja en NULL (todas las futuras agendadas). Una matrícula que no se ve por RLS
-- o sin clases que cancelar no devuelve fila.
CREATE OR REPLACE FUNCTION public.remove_class_b_schedule(
  p_enrollment_ids INT[],
  p_session_ids    INT[] DEFAULT NULL
)
RETURNS TABLE (
  enrollment_id       INT,
  removal_id          INT,
  cancelled_count     INT,
  first_scheduled_at  TIMESTAMPTZ,
  student_user_id     INT,
  instructor_user_ids INT[]
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
#variable_conflict use_column
DECLARE
  v_enr     INT;
  v_prev    TIMESTAMPTZ;
  v_removal INT;
  v_user    INT;
  v_now     TIMESTAMPTZ := now();
BEGIN
  IF public.auth_user_role() IS DISTINCT FROM 'admin'
     AND public.auth_user_role() IS DISTINCT FROM 'secretary' THEN
    RAISE EXCEPTION 'No tienes permiso para eliminar horarios.' USING ERRCODE = '42501';
  END IF;

  SELECT u.id INTO v_user FROM public.users u WHERE u.supabase_uid = auth.uid();

  FOREACH v_enr IN ARRAY COALESCE(p_enrollment_ids, '{}'::INT[]) LOOP
    SELECT e.absence_penalty_applied_at INTO v_prev
    FROM public.enrollments e WHERE e.id = v_enr
    FOR UPDATE;
    IF NOT FOUND THEN CONTINUE; END IF;

    PERFORM 1 FROM public.class_b_sessions cs
    WHERE cs.enrollment_id = v_enr AND cs.status = 'scheduled' AND cs.scheduled_at > v_now
      AND (p_session_ids IS NULL OR cs.id = ANY (p_session_ids))
    FOR UPDATE;
    IF NOT FOUND THEN CONTINUE; END IF;

    INSERT INTO public.class_b_schedule_removals (enrollment_id, removed_by, previous_penalty_applied_at)
    VALUES (v_enr, v_user, v_prev)
    RETURNING id INTO v_removal;

    RETURN QUERY
    WITH upd AS (
      UPDATE public.class_b_sessions cs
      SET status = 'cancelled', cancelled_at = v_now, schedule_removal_id = v_removal
      WHERE cs.enrollment_id = v_enr AND cs.status = 'scheduled' AND cs.scheduled_at > v_now
        AND (p_session_ids IS NULL OR cs.id = ANY (p_session_ids))
      RETURNING cs.scheduled_at, cs.instructor_id
    )
    SELECT v_enr, v_removal, count(*)::INT, min(upd.scheduled_at),
           (SELECT s.user_id FROM public.enrollments e JOIN public.students s ON s.id = e.student_id
            WHERE e.id = v_enr),
           COALESCE(array_remove(array_agg(DISTINCT i.user_id), NULL), '{}'::INT[])
    FROM upd LEFT JOIN public.instructors i ON i.id = upd.instructor_id;

    -- fix-391-m: eliminar también es penalizar.
    UPDATE public.enrollments e SET absence_penalty_applied_at = v_now WHERE e.id = v_enr;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.remove_class_b_schedule(INT[], INT[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remove_class_b_schedule(INT[], INT[]) TO authenticated;

-- ── 4. Reactivar horario ────────────────────────────────────────────────────────────────────
-- Deshace la ÚLTIMA eliminación de la matrícula (una anterior nunca se revive: AC-E1). Las
-- clases ligadas cuya fecha ya pasó quedan canceladas. Los triggers de doble agendamiento
-- validan en el UPDATE: un choque aborta todo.
CREATE OR REPLACE FUNCTION public.reactivate_class_b_schedule(p_enrollment_id INT)
RETURNS TABLE (
  reactivated_count           INT,
  first_scheduled_at          TIMESTAMPTZ,
  student_user_id             INT,
  instructor_user_ids         INT[],
  previous_penalty_applied_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
#variable_conflict use_column
DECLARE
  v_rem   public.class_b_schedule_removals%ROWTYPE;
  v_user  INT;
  v_now   TIMESTAMPTZ := now();
  v_count INT;
  v_first TIMESTAMPTZ;
  v_instr INT[];
BEGIN
  IF public.auth_user_role() IS DISTINCT FROM 'admin'
     AND public.auth_user_role() IS DISTINCT FROM 'secretary' THEN
    RAISE EXCEPTION 'No tienes permiso para reactivar horarios.' USING ERRCODE = '42501';
  END IF;

  SELECT r.* INTO v_rem
  FROM public.class_b_schedule_removals r
  WHERE r.enrollment_id = p_enrollment_id
  ORDER BY r.id DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Estas clases no se cancelaron con "Eliminar horario". Usa "Reagendar Clases" en la ficha del alumno.'
      USING ERRCODE = 'P0001';
  END IF;
  IF v_rem.reactivated_at IS NOT NULL THEN
    RAISE EXCEPTION 'El horario ya estaba reactivado.' USING ERRCODE = 'P0001';
  END IF;

  SELECT u.id INTO v_user FROM public.users u WHERE u.supabase_uid = auth.uid();

  WITH upd AS (
    UPDATE public.class_b_sessions cs
    SET status = 'scheduled', cancelled_at = NULL, schedule_removal_id = NULL
    WHERE cs.schedule_removal_id = v_rem.id AND cs.status = 'cancelled' AND cs.scheduled_at > v_now
    RETURNING cs.scheduled_at, cs.instructor_id
  )
  SELECT count(*)::INT, min(upd.scheduled_at),
         COALESCE(array_remove(array_agg(DISTINCT i.user_id), NULL), '{}'::INT[])
    INTO v_count, v_first, v_instr
  FROM upd LEFT JOIN public.instructors i ON i.id = upd.instructor_id;

  IF v_count = 0 THEN
    RAISE EXCEPTION 'No hay clases futuras para reactivar. Para darle nuevas horas usa "Reagendar Clases" en la ficha del alumno.'
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.enrollments e
  SET absence_penalty_applied_at = v_rem.previous_penalty_applied_at
  WHERE e.id = p_enrollment_id;

  UPDATE public.class_b_schedule_removals r
  SET reactivated_at = v_now, reactivated_by = v_user
  WHERE r.id = v_rem.id;

  RETURN QUERY
  SELECT v_count, v_first,
         (SELECT s.user_id FROM public.enrollments e JOIN public.students s ON s.id = e.student_id
          WHERE e.id = p_enrollment_id),
         v_instr, v_rem.previous_penalty_applied_at;
END;
$$;

REVOKE ALL ON FUNCTION public.reactivate_class_b_schedule(INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reactivate_class_b_schedule(INT) TO authenticated;

-- ── 5. Reagendar suelta el vínculo ──────────────────────────────────────────────────────────
-- Base: fix-383-m (20261012140000). Único cambio: "schedule_removal_id = NULL" en el UPDATE.
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
        cancelled_at  = NULL,
        schedule_removal_id = NULL  -- spec 0058-b
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

REVOKE EXECUTE ON FUNCTION public.reschedule_class_b_sessions(INT, INT, JSONB, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reschedule_class_b_sessions(INT, INT, JSONB, TEXT, TEXT) TO authenticated;

-- ── 6. Etiqueta de auditoría de la columna nueva ───────────────────────────────────────────
-- Base: fix-496-m (20261107200000). Único cambio: 'schedule_removal_id'.
CREATE OR REPLACE FUNCTION public.audit_humanize_column(p_key text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
BEGIN
  RETURN CASE p_key
    -- Estados y flags genéricos
    WHEN 'status'                THEN 'Estado'
    WHEN 'payment_status'        THEN 'Estado de pago'
    WHEN 'session_status'        THEN 'Estado de sesión'
    WHEN 'license_status'        THEN 'Estado de la licencia'
    WHEN 'psych_test_status'     THEN 'Examen psicológico'
    WHEN 'psych_test_result'     THEN 'Resultado examen psicológico'
    WHEN 'active'                THEN 'Activo'
    WHEN 'closed'                THEN 'Cerrado'
    WHEN 'passed'                THEN 'Aprobado'
    WHEN 'read'                  THEN 'Leída'
    WHEN 'sent_ok'               THEN 'Envío exitoso'
    WHEN 'timed_out'             THEN 'Tiempo agotado'
    WHEN 'docs_complete'         THEN 'Documentos completos'
    WHEN 'contract_accepted'     THEN 'Contrato aceptado'
    WHEN 'certificate_enabled'   THEN 'Certificado habilitado'
    WHEN 'counts_as_taken'       THEN 'Cuenta como tomada'
    WHEN 'student_signature'     THEN 'Firma del alumno'
    WHEN 'instructor_signature'  THEN 'Firma del instructor'
    WHEN 'is_minor'              THEN 'Es menor de edad'
    WHEN 'has_notarial_auth'     THEN 'Autorización notarial'
    WHEN 'first_login'           THEN 'Primer inicio de sesión'
    WHEN 'can_access_both_branches' THEN 'Acceso a ambas sedes'
    WHEN 'both_branches'         THEN 'Ambas sedes'
    WHEN 'requires_receipt'      THEN 'Requiere boleta'
    WHEN 'practical_exam_passed' THEN 'Examen práctico aprobado'

    -- Wizard de matrícula
    WHEN 'current_step'          THEN 'Paso actual'
    WHEN 'registration_channel'  THEN 'Canal de matrícula'

    -- Relaciones (FK) — la etiqueta describe la entidad; el VALOR se resuelve aparte
    -- vía audit_resolve_display_value()
    WHEN 'promotion_course_id'   THEN 'Curso de promoción'
    WHEN 'course_id'             THEN 'Curso'
    WHEN 'branch_id'             THEN 'Sede'
    WHEN 'role_id'                THEN 'Rol'
    WHEN 'instructor_id'         THEN 'Instructor'
    WHEN 'original_instructor_id' THEN 'Instructor original'
    WHEN 'absent_instructor_id'  THEN 'Instructor ausente'
    WHEN 'replacement_instructor_id' THEN 'Instructor de reemplazo'
    WHEN 'lecturer_id'           THEN 'Relator'
    WHEN 'vehicle_id'            THEN 'Vehículo'
    WHEN 'student_id'            THEN 'Alumno'
    WHEN 'enrollment_id'         THEN 'Matrícula'
    WHEN 'converted_enrollment_id' THEN 'Matrícula generada'
    WHEN 'history_ref_id'        THEN 'Matrícula de referencia'
    WHEN 'enrollment_a2_id'      THEN 'Matrícula A2'
    WHEN 'enrollment_a4_id'      THEN 'Matrícula A4'
    WHEN 'template_id'           THEN 'Plantilla de horario'
    WHEN 'receipt_id'            THEN 'Boleta/Factura'
    WHEN 'batch_id'              THEN 'Lote de certificados'
    WHEN 'certificate_id'        THEN 'Certificado'
    WHEN 'discount_id'           THEN 'Descuento aplicado'
    WHEN 'service_id'            THEN 'Servicio'
    WHEN 'evidence_id'           THEN 'Evidencia de inasistencia'
    WHEN 'sence_code_id'         THEN 'Código SENCE'
    WHEN 'theory_cycle_id'       THEN 'Ciclo teórico'

    -- Autoría (columnas *_by)
    WHEN 'registered_by'         THEN 'Registrado por'
    WHEN 'created_by'            THEN 'Creado por'
    WHEN 'recorded_by'           THEN 'Registrado por'
    WHEN 'reviewed_by'           THEN 'Revisado por'
    WHEN 'issued_by'             THEN 'Emitido por'
    WHEN 'paid_by'               THEN 'Pagado por'
    WHEN 'seen_by'               THEN 'Visto por'
    WHEN 'uploaded_by'           THEN 'Subido por'
    WHEN 'updated_by'            THEN 'Actualizado por'
    WHEN 'generated_by'          THEN 'Generado por'
    WHEN 'received_by'           THEN 'Recibido por'
    WHEN 'closed_by'             THEN 'Cerrado por'
    WHEN 'assigned_by'           THEN 'Asignado por'
    WHEN 'applied_by'            THEN 'Aplicado por'

    -- Montos y pagos
    WHEN 'amount'                THEN 'Monto'
    WHEN 'total_amount'          THEN 'Monto total'
    WHEN 'total_paid'            THEN 'Total pagado'
    WHEN 'amount_paid'           THEN 'Monto pagado'
    WHEN 'amount_per_hour'       THEN 'Valor por hora'
    WHEN 'pending_balance'       THEN 'Saldo pendiente'
    WHEN 'balance'               THEN 'Saldo'
    WHEN 'base_price'            THEN 'Precio base'
    WHEN 'base_salary'           THEN 'Sueldo base'
    WHEN 'net_payment'           THEN 'Pago neto'
    WHEN 'advances_deducted'     THEN 'Anticipos descontados'
    WHEN 'discount'              THEN 'Descuento'
    WHEN 'price'                 THEN 'Precio'
    WHEN 'cash_amount'           THEN 'Monto efectivo'
    WHEN 'transfer_amount'       THEN 'Monto transferencia'
    WHEN 'card_amount'           THEN 'Monto tarjeta'
    WHEN 'voucher_amount'        THEN 'Monto vale vista'
    WHEN 'total_income'          THEN 'Ingresos totales'
    WHEN 'total_expenses'        THEN 'Gastos totales'
    WHEN 'difference'            THEN 'Diferencia de arqueo'
    WHEN 'arqueo_amount'         THEN 'Monto contado (arqueo)'
    WHEN 'payments_count'        THEN 'N° de pagos'
    WHEN 'cost'                  THEN 'Costo'

    -- Fechas
    WHEN 'payment_date'          THEN 'Fecha de pago'
    WHEN 'expires_at'            THEN 'Fecha de expiración'
    WHEN 'issued_at'             THEN 'Fecha de emisión'
    WHEN 'issued_date'           THEN 'Fecha de emisión'
    WHEN 'sale_date'             THEN 'Fecha de venta'
    WHEN 'start_date'            THEN 'Fecha de inicio'
    WHEN 'end_date'              THEN 'Fecha de término'
    WHEN 'document_issue_date'   THEN 'Fecha de emisión del documento'
    WHEN 'uploaded_at'           THEN 'Fecha de subida'
    WHEN 'reviewed_at'           THEN 'Fecha de revisión'
    WHEN 'accepted_at'           THEN 'Fecha de aceptación'
    WHEN 'issue_date'            THEN 'Fecha de emisión'
    WHEN 'expiry_date'           THEN 'Fecha de vencimiento'
    WHEN 'scheduled_date'        THEN 'Fecha programada'
    WHEN 'completed_date'        THEN 'Fecha de término'
    WHEN 'occurred_at'           THEN 'Fecha del incidente'
    WHEN 'received_date'         THEN 'Fecha de recepción'
    WHEN 'sent_at'               THEN 'Fecha de envío'
    WHEN 'birth_date'            THEN 'Fecha de nacimiento'
    WHEN 'license_obtained_date' THEN 'Fecha de obtención de licencia'
    WHEN 'license_expiry'        THEN 'Vencimiento de licencia'
    WHEN 'registration_date'     THEN 'Fecha de registro'
    WHEN 'scheduled_at'          THEN 'Fecha programada'
    WHEN 'cancelled_at'          THEN 'Fecha de cancelación'
    WHEN 'schedule_removal_id'   THEN 'Eliminación de horario'  -- spec 0058-b

    -- Columnas agregadas después de fix-218-b (fix-413-m)
    WHEN 'absence_penalty_applied_at' THEN 'Penalización por inasistencias aplicada'
    WHEN 'voided_at'             THEN 'Fecha de anulación'
    WHEN 'voided_by'             THEN 'Anulado por'
    WHEN 'void_reason'           THEN 'Motivo de anulación'
    WHEN 'kind'                  THEN 'Tipo'
    WHEN 'pending_at_override'   THEN 'Saldo al habilitar'
    WHEN 'completed_at'          THEN 'Fecha de finalización'
    WHEN 'signature_timestamp'   THEN 'Fecha de firma'
    WHEN 'deducted_on'           THEN 'Fecha de descuento'
    WHEN 'record_date'           THEN 'Fecha de registro'
    WHEN 'closes_at'             THEN 'Fecha de cierre'
    WHEN 'closed_at'             THEN 'Fecha de cierre efectivo'
    WHEN 'date'                  THEN 'Fecha'
    WHEN 'start_time'            THEN 'Hora de inicio'
    WHEN 'end_time'              THEN 'Hora de término'
    WHEN 'available_from'        THEN 'Disponible desde'
    WHEN 'available_until'       THEN 'Disponible hasta'
    WHEN 'duration_min'          THEN 'Duración (min)'
    WHEN 'duration_hours'        THEN 'Duración (horas)'

    -- Datos personales / académicos
    WHEN 'gender'                THEN 'Género'
    WHEN 'address'               THEN 'Dirección'
    WHEN 'region'                THEN 'Región'
    WHEN 'district'              THEN 'Comuna'
    WHEN 'current_license_class' THEN 'Clase de licencia actual'
    WHEN 'license_number'        THEN 'N° de licencia'
    WHEN 'license_class'         THEN 'Clase de licencia'
    WHEN 'desired_course_class'  THEN 'Clase de curso deseada'
    WHEN 'available_days'        THEN 'Días disponibles'
    WHEN 'active_classes_count'  THEN 'Clases activas'

    -- Clases y evaluaciones
    WHEN 'class_number'          THEN 'N° de clase'
    WHEN 'evaluation_grade'      THEN 'Nota de evaluación'
    WHEN 'evaluation_checklist'  THEN 'Checklist de evaluación'
    WHEN 'performance_notes'     THEN 'Notas de desempeño'
    WHEN 'km_start'              THEN 'Kilometraje inicial'
    WHEN 'km_end'                THEN 'Kilometraje final'
    WHEN 'km_at_time'            THEN 'Kilometraje'
    WHEN 'current_km'            THEN 'Kilometraje actual'
    WHEN 'topic'                 THEN 'Tema'
    WHEN 'zoom_link'             THEN 'Link de Zoom'
    WHEN 'justification'         THEN 'Justificación'
    WHEN 'consecutive_absences'  THEN 'Inasistencias consecutivas'
    WHEN 'score'                 THEN 'Puntaje'
    WHEN 'module'                THEN 'Módulo'
    WHEN 'grade'                 THEN 'Nota'
    WHEN 'result'                THEN 'Resultado'
    WHEN 'final_grade'           THEN 'Nota final'
    WHEN 'theory_attendance_pct' THEN 'Asistencia teórica (%)'
    WHEN 'practical_attendance_pct' THEN 'Asistencia práctica (%)'
    WHEN 'period'                THEN 'Período'
    WHEN 'pdf_url'               THEN 'URL del PDF'
    WHEN 'current_day'           THEN 'Día actual'
    WHEN 'max_students'          THEN 'Cupo máximo'
    WHEN 'enrolled_students'     THEN 'Alumnos inscritos'

    -- Vehículos y mantención
    WHEN 'license_plate'         THEN 'Patente'
    WHEN 'brand'                 THEN 'Marca'
    WHEN 'model'                 THEN 'Modelo'
    WHEN 'year'                  THEN 'Año'
    WHEN 'body_type'             THEN 'Tipo de carrocería'
    WHEN 'transmission'          THEN 'Transmisión'
    WHEN 'last_inspection'       THEN 'Última inspección'
    WHEN 'last_maintenance'      THEN 'Última mantención'
    WHEN 'workshop'              THEN 'Taller'

    -- Documentos y archivos
    WHEN 'file_name'             THEN 'Nombre de archivo'
    WHEN 'storage_url'           THEN 'URL de almacenamiento'
    WHEN 'file_url'              THEN 'URL del archivo'
    WHEN 'receipt_url'           THEN 'URL de boleta'
    WHEN 'evidence_url'          THEN 'URL de evidencia'
    WHEN 'qr_url'                THEN 'URL QR'
    WHEN 'content_hash'          THEN 'Hash del contrato'
    WHEN 'signature_ip'          THEN 'IP de firma'
    WHEN 'version'               THEN 'Versión'
    WHEN 'format'                THEN 'Formato'
    WHEN 'download_count'        THEN 'Descargas'

    -- Notificaciones
    WHEN 'sent_error'            THEN 'Error de envío'
    WHEN 'send_error'            THEN 'Error de envío'
    WHEN 'reference_type'        THEN 'Tipo de referencia'
    WHEN 'reference_id'          THEN 'Referencia'
    WHEN 'subject'               THEN 'Asunto'
    WHEN 'message'               THEN 'Mensaje'
    WHEN 'alert_type'            THEN 'Tipo de alerta'
    WHEN 'advance_days'          THEN 'Días de anticipación'

    -- Genéricos
    WHEN 'name'                  THEN 'Nombre'
    WHEN 'code'                  THEN 'Código'
    WHEN 'type'                  THEN 'Tipo'
    WHEN 'category'              THEN 'Categoría'
    WHEN 'description'           THEN 'Descripción'
    WHEN 'reason'                THEN 'Motivo'
    WHEN 'notes'                 THEN 'Notas'
    WHEN 'number'                THEN 'Número de matrícula'
    WHEN 'document_number'       THEN 'N° de documento'
    WHEN 'recipient_tax_id'      THEN 'RUT del receptor'
    WHEN 'recipient_name'        THEN 'Nombre del receptor'
    WHEN 'folio'                 THEN 'Folio'
    WHEN 'billing_type'          THEN 'Tipo de facturación'
    WHEN 'metadata'              THEN 'Metadatos'
    WHEN 'config'                THEN 'Configuración'
    WHEN 'batch_code'            THEN 'Código de lote'
    WHEN 'folio_from'            THEN 'Folio desde'
    WHEN 'folio_to'              THEN 'Folio hasta'
    WHEN 'available_folios'      THEN 'Folios disponibles'

    -- Usuarios (fix-218-b: el cambio de teléfono se mostraba como "Phone")
    WHEN 'first_names'                THEN 'Nombres'
    WHEN 'paternal_last_name'         THEN 'Apellido paterno'
    WHEN 'maternal_last_name'         THEN 'Apellido materno'
    WHEN 'rut'                        THEN 'RUT'
    WHEN 'email'                      THEN 'Correo'
    WHEN 'phone'                      THEN 'Teléfono'
    WHEN 'supabase_uid'               THEN 'Cuenta de acceso'
    WHEN 'user_id'                    THEN 'Usuario'
    WHEN 'temp_user_id'               THEN 'Usuario temporal'

    -- Matrículas y cursos singulares
    WHEN 'license_group'              THEN 'Tipo de licencia'
    WHEN 'payment_mode'               THEN 'Modalidad de pago'
    WHEN 'payment_method'             THEN 'Medio de pago'
    WHEN 'license_pdf_url'            THEN 'PDF de la licencia'
    WHEN 'license_initial_url'        THEN 'URL de la licencia (inicial)'
    WHEN 'license_full_url'           THEN 'URL de la licencia (completa)'
    WHEN 'certificate_b_pdf_url'      THEN 'PDF del certificado Clase B'
    WHEN 'certificate_professional_pdf_url' THEN 'PDF del certificado profesional'
    WHEN 'promotion_id'               THEN 'Promoción'
    WHEN 'standalone_course_id'       THEN 'Curso singular'
    WHEN 'enrolled_at'                THEN 'Fecha de inscripción'
    WHEN 'paid_at'                    THEN 'Fecha de pago'
    WHEN 'discount_amount'            THEN 'Monto de descuento'
    WHEN 'discount_reason'            THEN 'Motivo del descuento'

    -- Pre-inscripciones profesionales
    WHEN 'registered_at'              THEN 'Fecha de registro'
    WHEN 'requested_license_class'    THEN 'Clase de licencia solicitada'
    WHEN 'convalidates_simultaneously' THEN 'Convalida en simultáneo'
    WHEN 'psych_test_answers'         THEN 'Respuestas del test psicológico'
    WHEN 'psych_test_completed_at'    THEN 'Test psicológico completado el'
    WHEN 'psych_evaluated_at'         THEN 'Evaluación psicológica el'
    WHEN 'psych_evaluated_by'         THEN 'Evaluado por'
    WHEN 'psych_rejection_reason'     THEN 'Motivo de rechazo psicológico'

    -- Clases y libro de clases
    WHEN 'gps_start'                  THEN 'GPS de inicio'
    WHEN 'gps_end'                    THEN 'GPS de término'
    WHEN 'class_date'                 THEN 'Fecha de la clase'
    WHEN 'cycle_id'                   THEN 'Ciclo teórico'
    WHEN 'zoom_sent_at'               THEN 'Zoom enviado el'
    WHEN 'module_number'              THEN 'N° de módulo'
    WHEN 'horario'                    THEN 'Horario'
    WHEN 'sence_code'                 THEN 'Código SENCE'
    WHEN 'generated_at'               THEN 'Generado el'
    WHEN 'convalidation_license'      THEN 'Licencia que convalida'
    WHEN 'sence_code_updated_at'      THEN 'Código SENCE actualizado el'
    WHEN 'sence_code_updated_by'      THEN 'Código SENCE actualizado por'

    -- Ventas de servicios especiales
    WHEN 'client_name'                THEN 'Nombre del cliente'
    WHEN 'client_rut'                 THEN 'RUT del cliente'
    WHEN 'is_student'                 THEN 'Es alumno'
    WHEN 'paid'                       THEN 'Pagado'
    WHEN 'service_name'               THEN 'Servicio'

    -- fix-496-m: columnas de las tablas que empezó a auditar fix-490-m
    WHEN 'duration_weeks'        THEN 'Duración (semanas)'
    WHEN 'practical_hours'       THEN 'Horas prácticas'
    WHEN 'theory_hours'          THEN 'Horas teóricas'
    WHEN 'schedule_days'         THEN 'Días de clase'
    WHEN 'schedule_blocks'       THEN 'Bloques horarios'
    WHEN 'is_convalidation'      THEN 'Es convalidación'
    WHEN 'max_classes_per_day'   THEN 'Máximo de clases por día'
    WHEN 'is_reinforcement'      THEN 'Es refuerzo'
    WHEN 'discount_type'         THEN 'Tipo de descuento'
    WHEN 'value'                 THEN 'Valor'
    WHEN 'valid_from'            THEN 'Vigente desde'
    WHEN 'valid_until'           THEN 'Vigente hasta'
    WHEN 'applicable_to'         THEN 'Aplica a'
    WHEN 'referral_code'         THEN 'Código de referido'
    WHEN 'applied_at'            THEN 'Aplicado el'
    WHEN 'qty_bill_20000'        THEN 'Billetes de $20.000'
    WHEN 'qty_bill_10000'        THEN 'Billetes de $10.000'
    WHEN 'qty_bill_5000'         THEN 'Billetes de $5.000'
    WHEN 'qty_bill_2000'         THEN 'Billetes de $2.000'
    WHEN 'qty_bill_1000'         THEN 'Billetes de $1.000'
    WHEN 'qty_coin_500'          THEN 'Monedas de $500'
    WHEN 'qty_coin_100'          THEN 'Monedas de $100'
    WHEN 'qty_coin_50'           THEN 'Monedas de $50'
    WHEN 'qty_coin_10'           THEN 'Monedas de $10'
    WHEN 'opening_amount'        THEN 'Monto de apertura'
    WHEN 'arqueo_enabled'        THEN 'Arqueo activado'
    WHEN 'cash_expenses'         THEN 'Gastos en efectivo'
    WHEN 'cuadratura_id'         THEN 'Caja'
    WHEN 'tipo'                  THEN 'Tipo'
    WHEN 'monto'                 THEN 'Monto'
    WHEN 'motivo'                THEN 'Motivo'
    WHEN 'expense_id'            THEN 'Gasto'

    -- Fallback genérico: nunca más snake_case crudo (ej. "foo_bar_id" -> "Foo bar id").
    -- Cubre columnas futuras no listadas arriba sin necesidad de tocar este diccionario
    -- de inmediato — mejor "Foo Bar Id" que "foo_bar_id", aunque no sea la traducción ideal.
    ELSE initcap(replace(p_key, '_', ' '))
  END;
END;
$function$;

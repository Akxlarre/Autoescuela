-- ============================================================================
-- fix-069-i (B1-1 de fix-058-i): un borrador con pago no se pierde, y la auditoría lo muestra
--
-- 1. guard_anulacion_pago: además del admin, la secretaria anula un pago de un BORRADOR de su
--    sede. Fuera de un borrador sigue siendo solo admin. La secretaria no tiene UPDATE en
--    payments (fix-051-i): solo llega por la RPC del punto 2.
-- 2. descartar_borrador_con_historial(enrollment, motivo): si el borrador tiene pagos o
--    consentimientos, en una transacción anula sus pagos vivos con el motivo, libera sus clases
--    reservadas y lo deja 'cancelled'. Devuelve false si no tiene ninguno de los dos: la app lo
--    borra como siempre. Caja del día cerrada → CAJA_CERRADA y no cambia nada.
-- 3. cleanup_expired_drafts: no toca un borrador con un pago vivo; uno con pagos todos anulados
--    se cancela (como los con consentimientos, fix-060-i) en vez de borrarse.
-- 4. log_change:
--      - sin sesión ni service key (cron, SQL Editor) la fila queda sin usuario ("Sistema"). Antes
--        tomaba registered_by: lo que borraba la limpieza aparecía hecho por una secretaria;
--      - una anulación (payments, special_service_sales) queda como
--        "Pago anulado: <pago> — Motivo: … — Anulado por: …".
--    Resto del cuerpo idéntico a fix-363-m.
--
-- Errores con tokens que la app traduce: ANULAR_SOLO_ADMIN, ANULAR_SIN_MOTIVO, CAJA_CERRADA.
-- Idempotente. Al aplicarla con la app en uso: SET lock_timeout = '5s' y reintentar (DG-107).
-- ============================================================================

-- 1. Anulación: admin, o secretaria en un borrador de su sede --------------------------------
CREATE OR REPLACE FUNCTION public.guard_anulacion_pago()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_motivo     TEXT;
  v_branch     INT;
  v_enr_status TEXT;
  v_role       TEXT;
BEGIN
  -- Un pago no nace anulado ni con datos de anulación.
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'anulado'
       OR NEW.voided_at IS NOT NULL OR NEW.voided_by IS NOT NULL OR NEW.void_reason IS NOT NULL THEN
      RAISE EXCEPTION 'ANULACION_INVALIDA' USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
  END IF;

  -- La anulación es definitiva.
  IF OLD.status = 'anulado' THEN
    RAISE EXCEPTION 'PAGO_YA_ANULADO' USING ERRCODE = 'P0001';
  END IF;

  -- Cualquier otro UPDATE: los datos de anulación no se tocan.
  IF NEW.status IS DISTINCT FROM 'anulado' THEN
    IF NEW.voided_at IS NOT NULL OR NEW.voided_by IS NOT NULL OR NEW.void_reason IS NOT NULL THEN
      RAISE EXCEPTION 'ANULACION_INVALIDA' USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
  END IF;

  -- Transición a 'anulado'.
  SELECT e.branch_id, e.status INTO v_branch, v_enr_status
  FROM public.enrollments e
  WHERE e.id = OLD.enrollment_id;

  v_role := public.auth_user_role();
  IF NOT (
    v_role = 'admin'
    -- fix-069-i: la secretaria, solo en un borrador de su sede (descarte de un borrador cobrado).
    OR (v_role = 'secretary' AND v_enr_status = 'draft' AND public.branch_visible(v_branch))
  ) THEN
    RAISE EXCEPTION 'ANULAR_SOLO_ADMIN' USING ERRCODE = 'P0001';
  END IF;

  v_motivo := btrim(COALESCE(NEW.void_reason, ''));
  IF v_motivo = '' THEN
    RAISE EXCEPTION 'ANULAR_SIN_MOTIVO' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.cash_closings c
    WHERE c.date = OLD.payment_date
      AND c.branch_id IS NOT DISTINCT FROM v_branch
      AND c.status = 'closed'
  ) THEN
    RAISE EXCEPTION 'CAJA_CERRADA' USING ERRCODE = 'P0001';
  END IF;

  -- Anular no edita el pago: todo queda como estaba salvo el estado y los datos de anulación.
  NEW             := OLD;
  NEW.status      := 'anulado';
  NEW.void_reason := v_motivo;
  NEW.voided_by   := public.auth_user_id();
  NEW.voided_at   := NOW();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_anulacion_pago() FROM PUBLIC, anon, authenticated;

-- 2. Descartar un borrador conservando su historial -----------------------------------------
CREATE OR REPLACE FUNCTION public.descartar_borrador_con_historial(
  p_enrollment_id integer,
  p_motivo        text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_branch_id INTEGER;
  v_role      TEXT;
BEGIN
  -- Solo un borrador (FOR UPDATE: un segundo descarte o una confirmación simultánea van en fila).
  SELECT branch_id INTO v_branch_id
  FROM public.enrollments
  WHERE id = p_enrollment_id AND status = 'draft'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Esta matrícula ya no está en borrador: recarga la lista.'
      USING ERRCODE = 'P0001';
  END IF;

  -- Admin, o secretaria de la sede de la matrícula (mismo chequeo que record_enrollment_payment).
  v_role := public.auth_user_role();
  IF NOT (v_role = 'admin' OR (v_role = 'secretary' AND public.branch_visible(v_branch_id))) THEN
    RAISE EXCEPTION 'No tienes permiso para descartar esta matrícula.' USING ERRCODE = '42501';
  END IF;

  -- Sin pagos ni consentimientos no hay historial que conservar: la app lo borra como siempre.
  IF NOT EXISTS (SELECT 1 FROM public.payments p WHERE p.enrollment_id = p_enrollment_id)
     AND NOT EXISTS (SELECT 1 FROM public.consents c WHERE c.enrollment_id = p_enrollment_id) THEN
    RETURN false;
  END IF;

  -- Pagos vivos → anulados. guard_anulacion_pago exige el motivo, rechaza la caja cerrada y fija
  -- quién y cuándo; trg_update_balance recalcula el saldo.
  IF EXISTS (
    SELECT 1 FROM public.payments p
    WHERE p.enrollment_id = p_enrollment_id AND p.status IS DISTINCT FROM 'anulado'
  ) THEN
    IF btrim(COALESCE(p_motivo, '')) = '' THEN
      RAISE EXCEPTION 'ANULAR_SIN_MOTIVO' USING ERRCODE = 'P0001';
    END IF;

    UPDATE public.payments
    SET status = 'anulado', void_reason = btrim(p_motivo)
    WHERE enrollment_id = p_enrollment_id AND status IS DISTINCT FROM 'anulado';
  END IF;

  -- Libera la agenda: un borrador solo tiene clases reservadas.
  DELETE FROM public.class_b_sessions
  WHERE enrollment_id = p_enrollment_id AND status = 'reserved';

  -- chk_expires_at_draft_only: expires_at NULL fuera de 'draft'.
  UPDATE public.enrollments
  SET status = 'cancelled', expires_at = NULL
  WHERE id = p_enrollment_id;

  RETURN true;
END;
$function$;

REVOKE ALL ON FUNCTION public.descartar_borrador_con_historial(integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.descartar_borrador_con_historial(integer, text) TO authenticated, service_role;

-- 3. Limpieza nocturna: no pierde pagos ------------------------------------------------------
-- Cuerpo de fix-060-i; cambia la recolección (sin pagos vivos) y "con consentimientos" pasa a
-- "con consentimientos o con pagos".
CREATE OR REPLACE FUNCTION public.cleanup_expired_drafts()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  expired_ids        INTEGER[];
  kept_ids           INTEGER[];
  orphan_student_ids INTEGER[];
  orphan_user_ids    INTEGER[];
  orphan_user_id     INTEGER;
  cancelled_count    INTEGER := 0;
  deleted_count      INTEGER;
BEGIN
  -- Recolectar IDs expirados. fix-069-i: un borrador con un pago vivo (cobrado o pendiente) no se
  -- toca: esa plata se recibió y la decide una persona (descartarlo anula el pago con motivo).
  SELECT ARRAY_AGG(e.id) INTO expired_ids
  FROM public.enrollments e
  WHERE e.status = 'draft'
    AND e.expires_at < NOW()
    AND NOT EXISTS (
      SELECT 1 FROM public.payments p
      WHERE p.enrollment_id = e.id AND p.status IS DISTINCT FROM 'anulado'
    );

  IF expired_ids IS NULL OR ARRAY_LENGTH(expired_ids, 1) IS NULL THEN
    RETURN 0;
  END IF;

  -- ── Con consentimientos (fix-060-i) o con pagos anulados (fix-069-i): se cancelan ──
  -- consents es append-only y un pago anulado es historial: ninguno de los dos se borra.
  SELECT ARRAY_AGG(u.eid) INTO kept_ids
  FROM UNNEST(expired_ids) AS u(eid)
  WHERE EXISTS (SELECT 1 FROM public.consents c WHERE c.enrollment_id = u.eid)
     OR EXISTS (SELECT 1 FROM public.payments p WHERE p.enrollment_id = u.eid);

  IF kept_ids IS NOT NULL THEN
    UPDATE public.route_incidents
    SET class_b_session_id = NULL
    WHERE class_b_session_id IN (
      SELECT id FROM public.class_b_sessions WHERE enrollment_id = ANY(kept_ids)
    );

    DELETE FROM public.class_b_practice_attendance
    WHERE class_b_session_id IN (
      SELECT id FROM public.class_b_sessions WHERE enrollment_id = ANY(kept_ids)
    );

    DELETE FROM public.class_b_sessions WHERE enrollment_id = ANY(kept_ids);

    UPDATE public.enrollments
    SET status = 'cancelled', expires_at = NULL
    WHERE id = ANY(kept_ids);
    GET DIAGNOSTICS cancelled_count = ROW_COUNT;

    SELECT ARRAY_AGG(u.eid) INTO expired_ids
    FROM UNNEST(expired_ids) AS u(eid)
    WHERE u.eid <> ALL(kept_ids);

    IF expired_ids IS NULL THEN
      RETURN cancelled_count;
    END IF;
  END IF;

  -- Capturar student_id y user_id ANTES de borrar (las FKs desaparecerán con el DELETE)
  SELECT ARRAY_AGG(DISTINCT e.student_id) INTO orphan_student_ids
  FROM public.enrollments e
  WHERE e.id = ANY(expired_ids)
    AND e.student_id IS NOT NULL;

  SELECT ARRAY_AGG(DISTINCT s.user_id) INTO orphan_user_ids
  FROM public.students s
  WHERE s.id = ANY(orphan_student_ids)
    AND s.user_id IS NOT NULL;

  -- ── Cascade de datos asociados al enrollment ──────────────────────────────
  -- (biometric_records fue eliminada en 20260622000001_drop_biometric_records.sql —
  -- no reintroducir esa referencia)

  UPDATE public.route_incidents
  SET class_b_session_id = NULL
  WHERE class_b_session_id IN (
    SELECT id FROM public.class_b_sessions WHERE enrollment_id = ANY(expired_ids)
  );

  DELETE FROM public.class_b_practice_attendance
  WHERE class_b_session_id IN (
    SELECT id FROM public.class_b_sessions WHERE enrollment_id = ANY(expired_ids)
  );

  DELETE FROM public.class_b_sessions      WHERE enrollment_id = ANY(expired_ids);
  DELETE FROM public.license_validations   WHERE enrollment_id = ANY(expired_ids);
  DELETE FROM public.discount_applications WHERE enrollment_id = ANY(expired_ids);
  -- fix-069-i: a esta altura ningún borrador tiene pagos (los con pagos se conservaron arriba).
  DELETE FROM public.student_documents     WHERE enrollment_id = ANY(expired_ids);
  DELETE FROM public.digital_contracts     WHERE enrollment_id = ANY(expired_ids);

  DELETE FROM public.enrollments WHERE id = ANY(expired_ids);

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  -- ── Limpiar students huérfanos ────────────────────────────────────────────
  -- Solo si no les quedan otras matrículas en el sistema.

  IF orphan_student_ids IS NOT NULL AND ARRAY_LENGTH(orphan_student_ids, 1) > 0 THEN
    DELETE FROM public.students s
    WHERE s.id = ANY(orphan_student_ids)
      AND NOT EXISTS (
        SELECT 1 FROM public.enrollments e2
        WHERE e2.student_id = s.id
      );
  END IF;

  -- ── Limpiar users huérfanos ───────────────────────────────────────────────
  -- Solo si:
  --   · supabase_uid IS NULL  → nunca fue activado como cuenta Auth (protege admins/secretarias)
  --   · No es instructor      → protege instructores sin cuenta Auth aún
  --   · No le queda student   → protege al alumno que conserva otra matrícula (fix-393-m)

  IF orphan_user_ids IS NOT NULL AND ARRAY_LENGTH(orphan_user_ids, 1) > 0 THEN
    FOREACH orphan_user_id IN ARRAY orphan_user_ids LOOP
      CONTINUE WHEN NOT EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = orphan_user_id
          AND u.supabase_uid IS NULL
          AND NOT EXISTS (SELECT 1 FROM public.instructors i WHERE i.user_id = u.id)
          AND NOT EXISTS (SELECT 1 FROM public.students s WHERE s.user_id = u.id)
      );

      -- Un bloque por user: si algo todavía lo referencia, se deshace solo este bloque
      -- (el user conserva sus notificaciones) y la limpieza sigue con el resto.
      BEGIN
        -- notifications.recipient_id REFERENCES users(id) sin ON DELETE → se borran antes.
        DELETE FROM public.notifications WHERE recipient_id = orphan_user_id;
        DELETE FROM public.users WHERE id = orphan_user_id;
      EXCEPTION WHEN foreign_key_violation THEN
        RAISE WARNING 'cleanup_expired_drafts: se conserva el user % porque aún tiene referencias (%)',
          orphan_user_id, SQLERRM;
      END;
    END LOOP;
  END IF;

  RETURN deleted_count + cancelled_count;
END;
$$;

-- 4. log_change(): "Sistema" sin sesión, y anulaciones legibles -------------------------------
-- Cuerpo de fix-363-m; cambian el bloque "Obtener el usuario actual" y la rama UPDATE.
CREATE OR REPLACE FUNCTION public.log_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_user_id INT;
  v_auth_uid UUID;
  v_is_service BOOLEAN := false;
  v_headers_raw TEXT;
  v_header_id TEXT;
  v_branch_id INT := NULL;
  v_entity_label TEXT := NULL;
  v_action TEXT := TG_OP;
  v_entity TEXT := TG_TABLE_NAME;
  v_entity_id INT;
  v_detail TEXT;
  v_old_json jsonb;
  v_new_json jsonb;
  v_key TEXT;
  v_old_val TEXT;
  v_new_val TEXT;
  v_old_display TEXT;
  v_new_display TEXT;
  v_diff_parts TEXT[] := '{}';
  v_col_label TEXT;
  v_skip_fields TEXT[] := ARRAY[
    'created_at', 'updated_at', 'password_hash',
    -- fix-145-m: columnas técnicas/de storage sin valor para el usuario en el feed —
    -- siguen auditándose a nivel de fila (INSERT/UPDATE/DELETE completo), solo se
    -- excluyen del diff línea-por-línea de UPDATE.
    'supabase_uid', 'license_initial_url', 'license_full_url', 'license_pdf_url',
    'certificate_b_pdf_url', 'certificate_professional_pdf_url',
    -- fix-206-b: el autor ya queda en audit_log.user_id.
    'updated_by'
  ];
  v_src jsonb;
  v_temp_text TEXT;
  v_temp_text2 TEXT;
  v_payment_method TEXT;
  v_is_online BOOLEAN := false;
BEGIN
  -- Determinar el origen (NEW para INSERT/UPDATE, OLD para DELETE)
  -- v_src es jsonb (no record): el operador ->> no existe para record en
  -- Postgres, solo para json/jsonb.
  IF TG_OP = 'DELETE' THEN
    v_src := to_jsonb(OLD);
  ELSE
    v_src := to_jsonb(NEW);
  END IF;

  v_entity_id := (v_src->>'id')::INT;

  -- ── Obtener el usuario actual ─────────────────────────────────────────────
  -- fix-363-m: manda la sesión. Antes iban primero el header 'x-audit-user-id' y la columna
  -- registered_by, y a los dos los controla el navegador: cualquier usuario con sesión podía
  -- dejar sus cambios a nombre de otro.
  BEGIN
    v_auth_uid := auth.uid();
  EXCEPTION WHEN OTHERS THEN
    v_auth_uid := NULL;
  END;

  IF v_auth_uid IS NOT NULL THEN
    -- 1. Sesión de usuario (mismo mecanismo que auth_user_id() en las políticas RLS; ver
    -- DG-045/DG-047). Con sesión no se mira nada más.
    BEGIN
      SELECT id INTO v_user_id
      FROM public.users
      WHERE supabase_uid = v_auth_uid;
    EXCEPTION WHEN OTHERS THEN
      v_user_id := NULL;
    END;
  ELSE
    BEGIN
      v_is_service := (auth.role() = 'service_role');
    EXCEPTION WHEN OTHERS THEN
      v_is_service := false;
    END;

    -- fix-069-i: header y registered_by solo valen con la service key (edge functions). Sin
    -- sesión ni service key (pg_cron, SQL Editor) la fila queda sin usuario = "Sistema": antes
    -- tomaba registered_by y lo que borraba la limpieza de borradores aparecía hecho por la
    -- secretaria que había registrado el pago.
    IF v_is_service THEN
      -- 2. Header HTTP 'x-audit-user-id'. PostgREST expone los headers de la request en
      -- current_setting('request.headers').
      BEGIN
        v_headers_raw := current_setting('request.headers', true);
        IF v_headers_raw IS NOT NULL AND v_headers_raw <> '' THEN
          v_header_id := (v_headers_raw::json)->>'x-audit-user-id';
          IF v_header_id IS NOT NULL AND v_header_id <> '' THEN
            v_user_id := v_header_id::INT;
          END IF;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        -- JSON malformado o header no numérico: seguir con el siguiente respaldo
        v_user_id := NULL;
      END;

      -- 3. Sin header: columna registered_by de la fila.
      IF v_user_id IS NULL AND (v_src->>'registered_by') IS NOT NULL THEN
        v_user_id := (v_src->>'registered_by')::INT;
      END IF;
    END IF;
  END IF;

  -- ── Ingeniería Inversa de Sede (Branch ID) y Enriquecimiento de Datos ───
  IF TG_TABLE_NAME = 'enrollments' THEN
    v_branch_id := (v_src->>'branch_id')::INT;

    IF (v_src->>'registration_channel') = 'online' THEN
      v_is_online := true;
    END IF;

    -- Buscar nombre del alumno y nombre del curso
    SELECT u.first_names || ' ' || u.paternal_last_name, c.name
    INTO v_temp_text, v_temp_text2
    FROM students s
    JOIN users u ON u.id = s.user_id
    JOIN courses c ON c.id = (v_src->>'course_id')::INT
    WHERE s.id = (v_src->>'student_id')::INT;

    v_entity_label := COALESCE(v_temp_text, '') || ' - ' || COALESCE(v_temp_text2, '') ||
                      ' ($' || COALESCE(v_src->>'base_price', '0') || ')';

  ELSIF TG_TABLE_NAME = 'payments' THEN
    -- El branch viene de la matrícula asociada
    SELECT e.branch_id, u.first_names || ' ' || u.paternal_last_name,
           COALESCE(e.number, 'Matrícula #' || e.id)
    INTO v_branch_id, v_temp_text, v_temp_text2
    FROM enrollments e
    JOIN students s ON s.id = e.student_id
    JOIN users u ON u.id = s.user_id
    WHERE e.id = (v_src->>'enrollment_id')::INT;

    -- fix-145-m: payments NUNCA tuvo columnas 'amount' ni 'method' — tiene
    -- total_amount + cash_amount/transfer_amount/card_amount/voucher_amount
    -- (sin columna de método unificada). Mismo criterio de derivación que
    -- admin-alumno-detalle.facade.ts::derivePaymentMethod() en el frontend.
    -- 'Matrícula ?': confirm_enrollment_with_payment() inserta el pago ANTES
    -- de asignar enrollments.number (por diseño, ver fix-057-m/H-024) — e.number
    -- viene NULL en ese momento; el COALESCE de arriba evita el '?' desnudo.
    v_payment_method := CASE
      WHEN COALESCE((v_src->>'cash_amount')::INT, 0) > 0 THEN 'Efectivo'
      WHEN COALESCE((v_src->>'transfer_amount')::INT, 0) > 0 THEN 'Transferencia'
      WHEN COALESCE((v_src->>'card_amount')::INT, 0) > 0 THEN 'Tarjeta'
      WHEN COALESCE((v_src->>'voucher_amount')::INT, 0) > 0 THEN 'Vale Vista'
      ELSE 'Desconocido'
    END;

    v_entity_label := '$' || COALESCE(v_src->>'total_amount', '0') || ' (' || v_payment_method || ') de ' || COALESCE(v_temp_text, '') || ' (' || COALESCE(v_temp_text2, 'Matrícula ?') || ')';

  ELSIF TG_TABLE_NAME = 'standalone_course_enrollments' THEN
    -- El branch viene del curso
    SELECT c.branch_id, u.first_names || ' ' || u.paternal_last_name, c.name
    INTO v_branch_id, v_temp_text, v_temp_text2
    FROM standalone_courses c, students s
    JOIN users u ON u.id = s.user_id
    WHERE c.id = (v_src->>'standalone_course_id')::INT AND s.id = (v_src->>'student_id')::INT;

    v_entity_label := COALESCE(v_temp_text2, '') || ' - ' || COALESCE(v_temp_text, '') || ' ($' || COALESCE(v_src->>'amount_paid', '0') || ')';

  ELSIF TG_TABLE_NAME = 'special_service_sales' THEN
    v_branch_id := (v_src->>'branch_id')::INT;
    v_entity_label := COALESCE(v_src->>'service_type', 'Servicio Especial') || ' ($' || COALESCE(v_src->>'price', '0') || ')';

  ELSIF TG_TABLE_NAME = 'class_b_sessions' THEN
    SELECT e.branch_id, u.first_names || ' ' || u.paternal_last_name
    INTO v_branch_id, v_temp_text
    FROM enrollments e
    JOIN students s ON s.id = e.student_id
    JOIN users u ON u.id = s.user_id
    WHERE e.id = (v_src->>'enrollment_id')::INT;

    -- fix-112-m: formatear scheduled_at en vez de mostrar el ISO timestamp crudo
    -- ("Nueva clase práctica: 2026-08-12T14:10:00+00:00 - Bruno Diaz").
    v_entity_label := COALESCE(public.audit_format_timestamp_value(v_src->>'scheduled_at'), v_src->>'scheduled_at', '') || ' - ' || COALESCE(v_temp_text, '');

  ELSIF TG_TABLE_NAME = 'users' THEN
    v_branch_id := (v_src->>'branch_id')::INT;
    v_entity_label := COALESCE(v_src->>'first_names', '') || ' ' || COALESCE(v_src->>'paternal_last_name', '');

  ELSIF TG_TABLE_NAME = 'students' THEN
    SELECT branch_id, first_names || ' ' || paternal_last_name
    INTO v_branch_id, v_temp_text
    FROM users WHERE id = (v_src->>'user_id')::INT;
    v_entity_label := COALESCE(v_temp_text, '');

  ELSIF TG_TABLE_NAME = 'professional_pre_registrations' THEN
    v_is_online := true;
    SELECT branch_id, first_names || ' ' || paternal_last_name
    INTO v_branch_id, v_temp_text
    FROM users WHERE id = (v_src->>'temp_user_id')::INT;
    v_entity_label := 'Clase ' || COALESCE(v_src->>'desired_course_class', '') || ' - ' || COALESCE(v_temp_text, '');

  ELSIF TG_TABLE_NAME = 'student_documents' THEN
    -- El branch viene de la matrícula asociada
    SELECT e.branch_id, u.first_names || ' ' || u.paternal_last_name
    INTO v_branch_id, v_temp_text
    FROM enrollments e
    JOIN students s ON s.id = e.student_id
    JOIN users u ON u.id = s.user_id
    WHERE e.id = (v_src->>'enrollment_id')::INT;

    -- fix-106-m: traducir el tipo de documento en vez de mostrarlo crudo
    v_entity_label := COALESCE(public.audit_humanize_enum_value(v_src->>'type'), v_src->>'type', 'Documento') || ' de ' || COALESCE(v_temp_text, '?');

  ELSIF TG_TABLE_NAME = 'certificates' THEN
    SELECT u.branch_id, u.first_names || ' ' || u.paternal_last_name
    INTO v_branch_id, v_temp_text
    FROM students s
    JOIN users u ON u.id = s.user_id
    WHERE s.id = (v_src->>'student_id')::INT;

    v_entity_label := 'Folio ' || COALESCE(v_src->>'folio', '?') || ' - ' || COALESCE(v_temp_text, '?');

  ELSIF TG_TABLE_NAME = 'vehicles' THEN
    v_branch_id := (v_src->>'branch_id')::INT;
    v_entity_label := COALESCE(v_src->>'license_plate', '') || ' (' || COALESCE(v_src->>'brand', '') || ' ' || COALESCE(v_src->>'model', '') || ')';

  ELSIF TG_TABLE_NAME = 'vehicle_documents' THEN
    SELECT branch_id, license_plate
    INTO v_branch_id, v_temp_text
    FROM vehicles WHERE id = (v_src->>'vehicle_id')::INT;

    -- fix-106-m: traducir el tipo de documento en vez de mostrarlo crudo
    v_entity_label := COALESCE(public.audit_humanize_enum_value(v_src->>'type'), v_src->>'type', 'Documento') || ' - ' || COALESCE(v_temp_text, '?');

  ELSIF TG_TABLE_NAME = 'maintenance_records' THEN
    SELECT branch_id, license_plate
    INTO v_branch_id, v_temp_text
    FROM vehicles WHERE id = (v_src->>'vehicle_id')::INT;

    -- fix-106-m: traducir el tipo de mantención en vez de mostrarlo crudo
    v_entity_label := COALESCE(public.audit_humanize_enum_value(v_src->>'type'), v_src->>'type', 'Mantención') || ' - ' || COALESCE(v_temp_text, '?');

  ELSIF TG_TABLE_NAME = 'class_b_theory_sessions' THEN
    v_branch_id := (v_src->>'branch_id')::INT;

    -- fix-145-m: ensure_theory_cycle() (Spec 0001) auto-genera las 6 clases de un
    -- ciclo nuevo seteando solo cycle_id/class_number/class_date — topic/scheduled_at
    -- (modelo pre-Spec 0001 de sesión Zoom individual) quedan NULL. Sin este fallback
    -- el entity_label siempre daba "Sesión teórica -" vacío para esas clases.
    IF (v_src->>'topic') IS NOT NULL OR (v_src->>'scheduled_at') IS NOT NULL THEN
      v_entity_label := COALESCE(v_src->>'topic', 'Sesión teórica') || ' - ' ||
        COALESCE(public.audit_format_timestamp_value(v_src->>'scheduled_at'), v_src->>'scheduled_at', '');
    ELSE
      v_entity_label := 'Clase teórica N°' || COALESCE(v_src->>'class_number', '?') || ' - ' ||
        COALESCE(public.audit_format_timestamp_value(v_src->>'class_date'), v_src->>'class_date', 'Sin fecha');
    END IF;

  ELSIF TG_TABLE_NAME = 'promotion_courses' THEN
    SELECT c.name
    INTO v_temp_text
    FROM courses c
    WHERE c.id = (v_src->>'course_id')::INT;

    v_entity_label := COALESCE(v_temp_text, '') || ' (' || COALESCE(v_src->>'code', '?') || ')';

  ELSIF TG_TABLE_NAME = 'class_book' THEN
    SELECT c.code
    INTO v_temp_text
    FROM promotion_courses c
    WHERE c.id = (v_src->>'promotion_course_id')::INT;

    v_entity_label := 'Curso ' || COALESCE(v_temp_text, '?') || ' - período ' || COALESCE(v_src->>'period', '?');

  ELSIF TG_TABLE_NAME = 'professional_theory_sessions' THEN
    SELECT c.code
    INTO v_temp_text
    FROM promotion_courses c
    WHERE c.id = (v_src->>'promotion_course_id')::INT;

    v_entity_label := 'Curso ' || COALESCE(v_temp_text, '?') || ' - ' || COALESCE(v_src->>'date', '');

  ELSIF TG_TABLE_NAME = 'professional_practice_sessions' THEN
    SELECT c.code
    INTO v_temp_text
    FROM promotion_courses c
    WHERE c.id = (v_src->>'promotion_course_id')::INT;

    v_entity_label := 'Curso ' || COALESCE(v_temp_text, '?') || ' - ' || COALESCE(v_src->>'date', '');

  ELSIF TG_TABLE_NAME = 'professional_module_grades' THEN
    SELECT e.number
    INTO v_temp_text
    FROM enrollments e
    WHERE e.id = (v_src->>'enrollment_id')::INT;

    v_entity_label := 'Matrícula ' || COALESCE(v_temp_text, '?') || ' - ' || COALESCE(v_src->>'module', '?');

  ELSIF TG_TABLE_NAME = 'website_config' THEN
    SELECT name
    INTO v_temp_text
    FROM branches WHERE id = (v_src->>'branch_id')::INT;

    v_branch_id := (v_src->>'branch_id')::INT;
    v_entity_label := 'Configuración web - ' || COALESCE(v_temp_text, '?');

  -- fix-206-b: instructores — la sede y el nombre viven en users.
  ELSIF TG_TABLE_NAME = 'instructors' THEN
    SELECT branch_id, first_names || ' ' || paternal_last_name
    INTO v_branch_id, v_temp_text
    FROM users WHERE id = (v_src->>'user_id')::INT;

    v_entity_label := 'Instructor ' || COALESCE(v_temp_text, '?');

  -- fix-206-b: asignación de vehículo — sede del instructor, patente del vehículo.
  ELSIF TG_TABLE_NAME = 'vehicle_assignments' THEN
    SELECT u.branch_id, u.first_names || ' ' || u.paternal_last_name
    INTO v_branch_id, v_temp_text
    FROM instructors i
    JOIN users u ON u.id = i.user_id
    WHERE i.id = (v_src->>'instructor_id')::INT;

    SELECT license_plate
    INTO v_temp_text2
    FROM vehicles WHERE id = (v_src->>'vehicle_id')::INT;

    v_entity_label := 'Vehículo ' || COALESCE(v_temp_text2, '?') || ' - ' || COALESCE(v_temp_text, '?');

  -- fix-206-b: valor hora de la sede (mueve las liquidaciones). La PK es branch_id (no hay id).
  ELSIF TG_TABLE_NAME = 'branch_payroll_config' THEN
    v_branch_id := (v_src->>'branch_id')::INT;
    v_entity_id := v_branch_id;

    SELECT name
    INTO v_temp_text
    FROM branches WHERE id = v_branch_id;

    v_entity_label := 'Valor hora instructores - ' || COALESCE(v_temp_text, '?');

  ELSE
    -- Fallback para otras tablas
    v_entity_label := 'id=' || COALESCE(v_src->>'id', '?');
  END IF;

  -- ── Construir detalle ────────────────────────────────────────────────────────
  CASE TG_OP

    WHEN 'UPDATE' THEN
      v_old_json := to_jsonb(OLD);
      v_new_json := to_jsonb(NEW);

      -- fix-069-i: una anulación se lee como tal, no como el diff de cuatro columnas
      -- ("Estado: Pagado -> anulado; Fecha de anulación: …").
      IF TG_TABLE_NAME IN ('payments', 'special_service_sales')
         AND (v_old_json->>'status') IS DISTINCT FROM 'anulado'
         AND (v_new_json->>'status') = 'anulado' THEN
        v_detail := CASE WHEN TG_TABLE_NAME = 'payments' THEN 'Pago anulado: ' ELSE 'Venta anulada: ' END
          || v_entity_label
          || ' — Motivo: ' || COALESCE(NULLIF(btrim(v_new_json->>'void_reason'), ''), 'Sin motivo')
          || ' — Anulado por: '
          || COALESCE(public.audit_resolve_display_value('voided_by', v_new_json->>'voided_by'), 'Sistema');
      ELSE
        FOR v_key IN
          SELECT key FROM jsonb_each(v_new_json)
          ORDER BY key
        LOOP
          -- Saltar campos internos
          CONTINUE WHEN v_key = ANY(v_skip_fields);

          v_old_val := v_old_json ->> v_key;
          v_new_val := v_new_json ->> v_key;

          IF v_old_val IS DISTINCT FROM v_new_val THEN
            v_col_label := public.audit_humanize_column(v_key);

            v_old_display := COALESCE(public.audit_resolve_display_value(v_key, v_old_val), v_old_val, 'Sin asignar');
            v_new_display := COALESCE(public.audit_resolve_display_value(v_key, v_new_val), v_new_val, 'Sin asignar');

            v_diff_parts := array_append(v_diff_parts, v_col_label || ': ' || v_old_display || ' -> ' || v_new_display);
          END IF;
        END LOOP;

        IF array_length(v_diff_parts, 1) > 0 THEN
          v_detail := '[' || v_entity_label || '] ' || array_to_string(v_diff_parts, '; ');
        ELSE
          RETURN NEW; -- No hay cambios auditables
        END IF;
      END IF;

    WHEN 'INSERT' THEN
      IF v_is_online THEN
        v_detail := 'Inscripción Web: ' || v_entity_label;
      ELSE
        v_detail := 'Registrado: ' || v_entity_label;
      END IF;

    WHEN 'DELETE' THEN
      v_detail := 'Eliminado: ' || v_entity_label;

  END CASE;

  -- ── Insertar en audit_log ──────────────────────────────────────────────────
  INSERT INTO public.audit_log (user_id, action, entity, entity_id, detail, branch_id)
  VALUES (v_user_id, v_action, v_entity, v_entity_id, v_detail, v_branch_id);

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;

EXCEPTION WHEN OTHERS THEN
  -- Prevención de fallos: la auditoría nunca debe abortar la transacción principal
  RAISE WARNING 'audit_log error: %', SQLERRM;
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$function$;

COMMENT ON FUNCTION public.log_change() IS
  'Trigger de auditoría con diff de campos en español. user_id: (1) sesión auth.uid(); sin sesión y con service key, (2) header x-audit-user-id, (3) registered_by de la fila; sin sesión ni service key (cron) queda NULL = Sistema (fix-069-i). Una anulación de pago/venta se registra como "Pago anulado: … — Motivo: … — Anulado por: …".';

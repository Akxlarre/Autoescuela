-- ============================================================================
-- Fix 363-m (P0, ASG-i-047): registro de auditoría falsificable y funciones abiertas de más
--
-- Lo que quedaba abierto después de fix-191-b y fix-322-m, confirmado contra la BD:
--   1. audit_log: cualquier usuario con sesión podía insertar filas (policy insert_audit_log), y
--      anon/authenticated conservaban INSERT/UPDATE/DELETE/TRUNCATE sobre la tabla.
--   2. log_change() tomaba el autor del header 'x-audit-user-id' y de registered_by antes que de
--      la sesión: los dos los controla el navegador.
--   3. get_student_payment_status(uid) devolvía los pagos de cualquier alumno a cualquier
--      usuario con sesión. No la llama nadie.
--   4. get_next_enrollment_number no revisaba el rol.
--   5. soft_delete_task y user_complete_first_login se podían ejecutar sin sesión, y 11
--      funciones SECURITY DEFINER no fijaban su search_path.
--   6. Causa de fondo: toda función nueva nacía con EXECUTE para PUBLIC, anon y authenticated.
--
-- Quien inserta en audit_log es solo log_change(): SECURITY DEFINER del dueño de la tabla, no
-- necesita policy ni GRANT. Ni la app ni las edge functions insertan directo.
-- ============================================================================

-- 1. audit_log: solo escribe el trigger ----------------------------------------------------------
DROP POLICY IF EXISTS insert_audit_log ON public.audit_log;

REVOKE ALL ON TABLE public.audit_log FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.audit_log TO authenticated;  -- la policy select_audit_log decide qué filas

COMMENT ON TABLE public.audit_log IS
  'Historial inmutable. Solo inserta el trigger log_change() (SECURITY DEFINER). anon y authenticated no tienen INSERT/UPDATE/DELETE ni policy de escritura (fix-363-m).';

-- 2. log_change(): la sesión manda; el header solo vale con la service key ------------------------
-- Cuerpo tomado de la definición vigente en la BD (fix-206-b); solo cambia el bloque
-- "Obtener el usuario actual".
CREATE OR REPLACE FUNCTION public.log_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_user_id INT;
  v_auth_uid UUID;
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
    -- 2. Sin sesión y con la service key (edge functions): header HTTP 'x-audit-user-id'.
    -- PostgREST expone los headers de la request en current_setting('request.headers').
    BEGIN
      IF auth.role() = 'service_role' THEN
        v_headers_raw := current_setting('request.headers', true);
        IF v_headers_raw IS NOT NULL AND v_headers_raw <> '' THEN
          v_header_id := (v_headers_raw::json)->>'x-audit-user-id';
          IF v_header_id IS NOT NULL AND v_header_id <> '' THEN
            v_user_id := v_header_id::INT;
          END IF;
        END IF;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- JSON malformado o header no numérico: seguir con el siguiente respaldo
      v_user_id := NULL;
    END;

    -- 3. Sin sesión ni header (cron, service key): columna registered_by de la fila.
    IF v_user_id IS NULL AND (v_src->>'registered_by') IS NOT NULL THEN
      v_user_id := (v_src->>'registered_by')::INT;
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
  'Trigger de auditoría con diff de campos en español. user_id: (1) sesión auth.uid(); sin sesión, (2) header x-audit-user-id solo con la service key, (3) registered_by de la fila.';

-- 3. get_student_payment_status: sin uso en la app; solo el servidor -------------------------------
REVOKE EXECUTE ON FUNCTION public.get_student_payment_status(text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_student_payment_status(text) TO service_role;

-- 4. get_next_enrollment_number: misma lógica (fix-252-m) + validación de rol ----------------------
CREATE OR REPLACE FUNCTION public.get_next_enrollment_number(p_course_id integer)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_license_class TEXT;
  v_branch_id     INT;
  v_is_class_b    BOOLEAN;
  v_last_number   TEXT;
  v_next_seq      INT;
BEGIN
  -- fix-363-m: desde la app solo la usan admin y secretaria. Sin sesión (service key, cron) no
  -- hay usuario que validar: anon no tiene EXECUTE (fix-191-b).
  IF auth.uid() IS NOT NULL
     AND COALESCE(public.auth_user_role(), '') NOT IN ('admin', 'secretary') THEN
    RAISE EXCEPTION 'No tienes permiso para consultar el número de matrícula.'
      USING ERRCODE = '42501';
  END IF;

  -- 1. Obtener clase de licencia y sede del curso
  SELECT license_class, branch_id
    INTO v_license_class, v_branch_id
  FROM courses
  WHERE id = p_course_id;

  IF v_license_class IS NULL THEN
    RAISE EXCEPTION 'Curso % no encontrado o sin license_class', p_course_id;
  END IF;

  v_is_class_b := (v_license_class = 'B');

  -- 2. Último número asignado para este grupo de licencia EN ESTA SEDE
  SELECT e.number INTO v_last_number
  FROM enrollments e
  JOIN courses c ON c.id = e.course_id
  WHERE e.number IS NOT NULL
    AND e.number ~ '^[0-9]+$'              -- fix-252-m: ignora numeración corrupta/no numérica
    AND (c.license_class = 'B') = v_is_class_b
    AND c.branch_id = v_branch_id          -- filtro por sede
    AND e.status != 'draft'                -- los drafts sin confirmar no consumen número
  ORDER BY e.id DESC
  LIMIT 1;

  -- 3. Calcular siguiente secuencia
  IF v_last_number IS NULL THEN
    v_next_seq := 1;
  ELSE
    v_next_seq := v_last_number::INT + 1;
  END IF;

  -- 4. Formatear: 4 dígitos hasta 9999, 5 desde 10000
  RETURN lpad(
    v_next_seq::TEXT,
    CASE WHEN v_next_seq >= 10000 THEN 5 ELSE 4 END,
    '0'
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_next_enrollment_number(integer) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_next_enrollment_number(integer) TO authenticated, service_role;

-- 5. Llamadas desde la app que no tienen sentido sin sesión ---------------------------------------
REVOKE EXECUTE ON FUNCTION public.soft_delete_task(uuid)       FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.soft_delete_task(uuid)       TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.user_complete_first_login()  FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.user_complete_first_login()  TO authenticated, service_role;

-- 6. search_path fijo en las SECURITY DEFINER que no lo tenían -------------------------------------
-- Mismo camino que la sesión por defecto ("$user", public, extensions), pero fijo: los nombres
-- sin esquema de sus cuerpos siguen resolviendo igual.
ALTER FUNCTION public.cleanup_expired_drafts() SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.cleanup_expired_public_enrollment() SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.cleanup_public_enrollment_throttle() SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.get_student_payment_status(text) SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.prevent_concurrent_in_progress_class_b_sessions() SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.prevent_courses_delete_when_in_website_config() SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.recalc_instructor_monthly_hours(integer, text) SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.reserve_next_promotion_slot(integer) SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.trg_class_b_sessions_update_monthly_hours() SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.user_complete_first_login() SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.validate_website_config_courses_fk() SET search_path = public, extensions, pg_temp;

-- 7. Causa de fondo: las funciones nuevas nacen cerradas -------------------------------------------
-- Hasta aquí toda función creada por postgres nacía con EXECUTE para PUBLIC (default de Postgres)
-- y, en public, además para anon y authenticated (20260513000002). Desde ahora nace solo para
-- postgres y service_role: la migración que la crea debe dar el GRANT a quien corresponda.
-- No cambia los permisos de las funciones que ya existen.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;
-- El REVOKE a PUBLIC es global (Postgres no permite quitarlo por esquema). En extensions se
-- repone, para que las funciones de una extensión que se instale después sigan disponibles.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA extensions GRANT EXECUTE ON FUNCTIONS TO PUBLIC;

-- ============================================================================
-- Migración: log_change() — Fallback 3 de v_user_id usaba un GUC que PostgREST
-- nunca setea en este stack (fix-108-m)
-- ============================================================================
-- Problema: fix-103-m (20260802130000) corrigió el cast roto de UUID→INT en el
-- Fallback 3, pero lo verificó con un fixture SQL que simulaba el contexto a mano
-- (`SET LOCAL request.jwt.claim.sub = '<uuid>'`). Nunca se probó contra una petición
-- HTTP real de PostgREST. Verificado empíricamente contra Supabase local (JWT firmado
-- a mano + PATCH real a /rest/v1/users): PostgREST en este stack solo expone el JSON
-- agregado `request.jwt.claims`; el GUC plano `request.jwt.claim.<claim>` (legacy,
-- `role-claim-key`) NO EXISTE — current_setting(..., true) devuelve NULL, silenciosamente,
-- sin lanzar excepción. Resultado: el Fallback 3 nunca resolvió un usuario real en
-- ninguna petición real, aunque el cast ya estuviera arreglado — "Sistema / Online"
-- persiste para cualquier tabla sin `registered_by` (ej. student_documents).
--
-- auth.uid() sí funciona correctamente en el mismo contexto (confirmado con la misma
-- prueba) — es el mecanismo que ya usa auth_user_id() para RLS
-- (20260301000011_10_rls_policies.sql:23-26). Solución: usar auth.uid() directo en vez
-- del GUC plano.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.log_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id INT;
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
  v_skip_fields TEXT[] := ARRAY['created_at', 'updated_at', 'password_hash'];
  v_src jsonb;
  v_temp_text TEXT;
  v_temp_text2 TEXT;
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
  -- Fallback 1: header HTTP 'x-audit-user-id' (Edge Functions con service role,
  -- sin sesión de usuario → auth.uid() = NULL). PostgREST expone los headers de
  -- la request como JSON en current_setting('request.headers').
  v_headers_raw := current_setting('request.headers', true);
  IF v_headers_raw IS NOT NULL AND v_headers_raw <> '' THEN
    BEGIN
      v_header_id := (v_headers_raw::json)->>'x-audit-user-id';
      IF v_header_id IS NOT NULL AND v_header_id <> '' THEN
        v_user_id := v_header_id::INT;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- JSON malformado — ignorar y continuar con el resto de fallbacks
      NULL;
    END;
  END IF;

  -- Fallback 2: Si la tabla tiene column 'registered_by' (pagos, matrículas, servicios)
  IF v_user_id IS NULL AND (v_src->>'registered_by') IS NOT NULL THEN
    v_user_id := (v_src->>'registered_by')::INT;
  END IF;

  -- Fallback 3: sesión autenticada normal — auth.uid() (fix-108-m: antes leía el GUC
  -- current_setting('request.jwt.claim.sub'), que PostgREST nunca setea en este stack;
  -- ver DG-045/DG-047). Mismo mecanismo que auth_user_id() en las políticas RLS.
  IF v_user_id IS NULL THEN
    BEGIN
      SELECT id INTO v_user_id
      FROM public.users
      WHERE supabase_uid = auth.uid();
    EXCEPTION WHEN OTHERS THEN
      v_user_id := NULL;
    END;
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
    SELECT e.branch_id, u.first_names || ' ' || u.paternal_last_name, e.number
    INTO v_branch_id, v_temp_text, v_temp_text2
    FROM enrollments e
    JOIN students s ON s.id = e.student_id
    JOIN users u ON u.id = s.user_id
    WHERE e.id = (v_src->>'enrollment_id')::INT;

    v_entity_label := '$' || COALESCE(v_src->>'amount', '0') || ' (' || COALESCE(v_src->>'method', 'Desconocido') || ') de ' || COALESCE(v_temp_text, '') || ' (Matrícula ' || COALESCE(v_temp_text2, '?') || ')';

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

    v_entity_label := COALESCE(v_src->>'scheduled_at', '') || ' - ' || COALESCE(v_temp_text, '');

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
    v_entity_label := COALESCE(v_src->>'topic', 'Sesión teórica') || ' - ' || COALESCE(v_src->>'scheduled_at', '');

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
$$;

COMMENT ON FUNCTION public.log_change() IS
  'Trigger de auditoría (fix-108-m): Fallback 3 de v_user_id usa auth.uid() directo en vez del GUC current_setting(''request.jwt.claim.sub''), que PostgREST nunca setea en este stack (solo expone el JSON agregado request.jwt.claims). Resto del cuerpo sin cambios respecto a fix-106-m (20260802150000).';

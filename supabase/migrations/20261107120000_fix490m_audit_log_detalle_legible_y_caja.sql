-- fix-490-m: auditoría legible y más tablas auditadas (testing ASG-i-036 / fix-485-m)
--
--   1. S9: editar Configuración web dejaba "Configuración: {JSON entero} -> {JSON entero}"
--      (13.214 caracteres). Ahora se listan las secciones y campos que cambiaron.
--   2. N6: los montos del detalle salían sin separador ("Clase B ($180000)").
--   3. D1: precios del catálogo, descuentos, caja y gastos no dejaban registro.
--
-- log_change() se redefine completa a partir de 20261024120000_fix069i (versión vigente); los
-- cambios están marcados con "fix-490-m". Idempotente (CREATE OR REPLACE + DROP TRIGGER IF EXISTS).

-- ── 1. Monto en pesos chilenos: '180000' → '$180.000' ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.audit_format_clp(p_value text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF p_value IS NULL OR btrim(p_value) = '' THEN
    RETURN '$0';
  END IF;
  RETURN '$' || replace(to_char(round(p_value::numeric), 'FM999,999,999,990'), ',', '.');
EXCEPTION WHEN OTHERS THEN
  RETURN '$' || p_value;
END;
$function$;

COMMENT ON FUNCTION public.audit_format_clp(text) IS
  'fix-490-m: monto para el detalle de auditoría con separador de miles chileno ($180.000).';

-- ── 2. Diff legible de website_config.config ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.audit_website_config_diff(p_old jsonb, p_new jsonb)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_key text;
  v_sub text;
  v_section text;
  v_field text;
  v_o jsonb;
  v_n jsonb;
  v_ov text;
  v_nv text;
  v_parts text[] := '{}';
BEGIN
  FOR v_key IN
    SELECT k FROM (
      SELECT jsonb_object_keys(COALESCE(p_new, '{}'::jsonb)) AS k
      UNION
      SELECT jsonb_object_keys(COALESCE(p_old, '{}'::jsonb))
    ) keys ORDER BY k
  LOOP
    v_o := p_old -> v_key;
    v_n := p_new -> v_key;
    CONTINUE WHEN v_o IS NOT DISTINCT FROM v_n;

    v_section := CASE v_key
      WHEN 'brand' THEN 'Marca'
      WHEN 'hero' THEN 'Hero'
      WHEN 'courses' THEN 'Cursos'
      WHEN 'promo' THEN 'Promoción'
      WHEN 'contact' THEN 'Contacto'
      WHEN 'hours' THEN 'Horarios'
      WHEN 'faqs' THEN 'Preguntas frecuentes'
      WHEN 'social' THEN 'Redes sociales'
      WHEN 'whyUs' THEN 'Por qué elegirnos'
      WHEN 'testimonials' THEN 'Testimonios'
      WHEN 'pricingFooter' THEN 'Términos de pago'
      ELSE v_key
    END;

    IF jsonb_typeof(v_o) = 'object' AND jsonb_typeof(v_n) = 'object' THEN
      FOR v_sub IN
        SELECT k FROM (
          SELECT jsonb_object_keys(v_n) AS k
          UNION
          SELECT jsonb_object_keys(v_o)
        ) subkeys ORDER BY k
      LOOP
        CONTINUE WHEN (v_o -> v_sub) IS NOT DISTINCT FROM (v_n -> v_sub);

        v_field := CASE v_sub
          WHEN 'name' THEN 'Nombre'
          WHEN 'shortName' THEN 'Nombre corto'
          WHEN 'slogan' THEN 'Eslogan'
          WHEN 'domain' THEN 'Dominio'
          WHEN 'theme' THEN 'Tema'
          WHEN 'logo' THEN 'Logo'
          WHEN 'ogImage' THEN 'Imagen para redes'
          WHEN 'favicon' THEN 'Favicon'
          WHEN 'headline' THEN 'Titular'
          WHEN 'subheadline' THEN 'Subtítulo'
          WHEN 'active' THEN 'Activa'
          WHEN 'title' THEN 'Título'
          WHEN 'badge' THEN 'Etiqueta'
          WHEN 'description' THEN 'Descripción'
          WHEN 'address' THEN 'Dirección'
          WHEN 'city' THEN 'Ciudad'
          WHEN 'region' THEN 'Región'
          WHEN 'phone' THEN 'Teléfono'
          WHEN 'whatsapp' THEN 'WhatsApp'
          WHEN 'email' THEN 'Correo'
          WHEN 'mapEmbedUrl' THEN 'Mapa'
          WHEN 'coordinates' THEN 'Coordenadas'
          WHEN 'paymentTerms' THEN 'Facilidades de pago'
          WHEN 'guarantee' THEN 'Garantía'
          ELSE v_sub
        END;

        IF COALESCE(jsonb_typeof(v_o -> v_sub), 'null') IN ('string', 'number', 'boolean', 'null')
           AND COALESCE(jsonb_typeof(v_n -> v_sub), 'null') IN ('string', 'number', 'boolean', 'null')
           AND length(COALESCE(v_o ->> v_sub, '')) <= 80
           AND length(COALESCE(v_n ->> v_sub, '')) <= 80 THEN
          v_ov := CASE v_o ->> v_sub WHEN 'true' THEN 'Sí' WHEN 'false' THEN 'No' ELSE NULLIF(v_o ->> v_sub, '') END;
          v_nv := CASE v_n ->> v_sub WHEN 'true' THEN 'Sí' WHEN 'false' THEN 'No' ELSE NULLIF(v_n ->> v_sub, '') END;
          v_parts := array_append(v_parts,
            v_section || ' · ' || v_field || ': ' || COALESCE(v_ov, '(vacío)') || ' -> ' || COALESCE(v_nv, '(vacío)'));
        ELSE
          v_parts := array_append(v_parts, v_section || ' · ' || v_field || ' modificado');
        END IF;
      END LOOP;
    ELSIF jsonb_typeof(v_n) = 'array' THEN
      v_parts := array_append(v_parts,
        v_section || ' modificado (' || jsonb_array_length(v_n) || ' ítems)');
    ELSE
      v_parts := array_append(v_parts, v_section || ' modificado');
    END IF;
  END LOOP;

  RETURN array_to_string(v_parts, '; ');
END;
$function$;

COMMENT ON FUNCTION public.audit_website_config_diff(jsonb, jsonb) IS
  'fix-490-m: qué cambió en website_config.config, por sección y campo, para el detalle de auditoría.';

-- ── 3. log_change() ────────────────────────────────────────────────────────────────────────
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
    'updated_by',
    -- fix-490-m: columna técnica de cash_closings (copia de branch_id para el índice único).
    'branch_id_key'
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

    -- fix-490-m: monto con separador de miles.
    v_entity_label := COALESCE(v_temp_text, '') || ' - ' || COALESCE(v_temp_text2, '') ||
                      ' (' || public.audit_format_clp(v_src->>'base_price') || ')';

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

    v_entity_label := public.audit_format_clp(v_src->>'total_amount') || ' (' || v_payment_method || ') de ' || COALESCE(v_temp_text, '') || ' (' || COALESCE(v_temp_text2, 'Matrícula ?') || ')';

  ELSIF TG_TABLE_NAME = 'standalone_course_enrollments' THEN
    -- El branch viene del curso
    SELECT c.branch_id, u.first_names || ' ' || u.paternal_last_name, c.name
    INTO v_branch_id, v_temp_text, v_temp_text2
    FROM standalone_courses c, students s
    JOIN users u ON u.id = s.user_id
    WHERE c.id = (v_src->>'standalone_course_id')::INT AND s.id = (v_src->>'student_id')::INT;

    v_entity_label := COALESCE(v_temp_text2, '') || ' - ' || COALESCE(v_temp_text, '') || ' (' || public.audit_format_clp(v_src->>'amount_paid') || ')';

  ELSIF TG_TABLE_NAME = 'special_service_sales' THEN
    v_branch_id := (v_src->>'branch_id')::INT;
    v_entity_label := COALESCE(v_src->>'service_type', 'Servicio Especial') || ' (' || public.audit_format_clp(v_src->>'price') || ')';

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

  -- fix-490-m (D1): precio del catálogo.
  ELSIF TG_TABLE_NAME = 'courses' THEN
    v_branch_id := (v_src->>'branch_id')::INT;
    v_entity_label := 'Curso ' || COALESCE(v_src->>'name', '?') || ' (' || public.audit_format_clp(v_src->>'base_price') || ')';

  -- fix-490-m (D1): descuento del catálogo.
  ELSIF TG_TABLE_NAME = 'discounts' THEN
    v_branch_id := (v_src->>'branch_id')::INT;
    v_entity_label := 'Descuento ' || COALESCE(v_src->>'name', '?') || ' (' ||
      CASE WHEN (v_src->>'discount_type') = 'percentage'
        THEN COALESCE(v_src->>'value', '0') || '%'
        ELSE public.audit_format_clp(v_src->>'value')
      END || ')';

  -- fix-490-m (D1): descuento aplicado a una matrícula — sede de la matrícula.
  ELSIF TG_TABLE_NAME = 'discount_applications' THEN
    SELECT e.branch_id, u.first_names || ' ' || u.paternal_last_name,
           COALESCE(e.number, 'Matrícula #' || e.id)
    INTO v_branch_id, v_temp_text, v_temp_text2
    FROM enrollments e
    JOIN students s ON s.id = e.student_id
    JOIN users u ON u.id = s.user_id
    WHERE e.id = (v_src->>'enrollment_id')::INT;

    v_entity_label := 'Descuento ' ||
      COALESCE((SELECT d.name FROM discounts d WHERE d.id = (v_src->>'discount_id')::INT), '?') ||
      ' de ' || public.audit_format_clp(v_src->>'discount_amount') ||
      ' a ' || COALESCE(v_temp_text, '?') || ' (' || COALESCE(v_temp_text2, 'Matrícula ?') || ')';

  -- fix-490-m (D1): cierre de caja del día.
  ELSIF TG_TABLE_NAME = 'cash_closings' THEN
    v_branch_id := (v_src->>'branch_id')::INT;
    v_entity_label := 'Caja del ' ||
      COALESCE(to_char((v_src->>'date')::date, 'DD-MM-YYYY'), '?');

  -- fix-490-m (D1): ajuste de cuadratura — sede y día del cierre de caja.
  ELSIF TG_TABLE_NAME = 'cuadratura_adjustments' THEN
    SELECT cc.branch_id, to_char(cc.date, 'DD-MM-YYYY')
    INTO v_branch_id, v_temp_text
    FROM cash_closings cc
    WHERE cc.id = (v_src->>'cuadratura_id')::INT;

    v_entity_label := 'Ajuste ' ||
      COALESCE(public.audit_humanize_enum_value(v_src->>'tipo'), replace(v_src->>'tipo', '_', ' '), '') ||
      ' ' || public.audit_format_clp(v_src->>'monto') ||
      ' - Caja del ' || COALESCE(v_temp_text, '?');

  -- fix-490-m (D1): gasto del día y gasto fijo.
  ELSIF TG_TABLE_NAME IN ('expenses', 'fixed_expenses') THEN
    v_branch_id := (v_src->>'branch_id')::INT;
    v_entity_label :=
      CASE WHEN TG_TABLE_NAME = 'fixed_expenses' THEN 'Gasto fijo ' ELSE 'Gasto ' END ||
      public.audit_format_clp(v_src->>'amount') ||
      COALESCE(' - ' || left(NULLIF(btrim(v_src->>'description'), ''), 60), '') ||
      ' (' || COALESCE(to_char((v_src->>'date')::date, 'DD-MM-YYYY'), '?') || ')';

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

          -- fix-490-m (S9): la configuración web es un JSON entero en una columna; se lista qué
          -- sección y campo cambió en vez de volcar el JSON viejo y el nuevo.
          IF TG_TABLE_NAME = 'website_config' AND v_key = 'config' THEN
            IF (v_old_json -> 'config') IS DISTINCT FROM (v_new_json -> 'config') THEN
              v_temp_text := public.audit_website_config_diff(v_old_json -> 'config', v_new_json -> 'config');
              IF COALESCE(v_temp_text, '') <> '' THEN
                v_diff_parts := array_append(v_diff_parts, v_temp_text);
              END IF;
            END IF;
            CONTINUE;
          END IF;

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
  'Trigger de auditoría con diff de campos en español. user_id: (1) sesión auth.uid(); sin sesión y con service key, (2) header x-audit-user-id, (3) registered_by de la fila; sin sesión ni service key (cron) queda NULL = Sistema (fix-069-i). Una anulación de pago/venta se registra como "Pago anulado: … — Motivo: … — Anulado por: …". website_config lista las secciones y campos cambiados; montos con separador de miles (fix-490-m).';

-- ── 4. Triggers nuevos (D1) ────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_audit_courses ON public.courses;
CREATE TRIGGER trg_audit_courses
  AFTER INSERT OR UPDATE OR DELETE ON public.courses
  FOR EACH ROW EXECUTE FUNCTION public.log_change();

DROP TRIGGER IF EXISTS trg_audit_discounts ON public.discounts;
CREATE TRIGGER trg_audit_discounts
  AFTER INSERT OR UPDATE OR DELETE ON public.discounts
  FOR EACH ROW EXECUTE FUNCTION public.log_change();

DROP TRIGGER IF EXISTS trg_audit_discount_applications ON public.discount_applications;
CREATE TRIGGER trg_audit_discount_applications
  AFTER INSERT OR UPDATE OR DELETE ON public.discount_applications
  FOR EACH ROW EXECUTE FUNCTION public.log_change();

DROP TRIGGER IF EXISTS trg_audit_cash_closings ON public.cash_closings;
CREATE TRIGGER trg_audit_cash_closings
  AFTER INSERT OR UPDATE OR DELETE ON public.cash_closings
  FOR EACH ROW EXECUTE FUNCTION public.log_change();

DROP TRIGGER IF EXISTS trg_audit_cuadratura_adjustments ON public.cuadratura_adjustments;
CREATE TRIGGER trg_audit_cuadratura_adjustments
  AFTER INSERT OR UPDATE OR DELETE ON public.cuadratura_adjustments
  FOR EACH ROW EXECUTE FUNCTION public.log_change();

DROP TRIGGER IF EXISTS trg_audit_expenses ON public.expenses;
CREATE TRIGGER trg_audit_expenses
  AFTER INSERT OR UPDATE OR DELETE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.log_change();

DROP TRIGGER IF EXISTS trg_audit_fixed_expenses ON public.fixed_expenses;
CREATE TRIGGER trg_audit_fixed_expenses
  AFTER INSERT OR UPDATE OR DELETE ON public.fixed_expenses
  FOR EACH ROW EXECUTE FUNCTION public.log_change();

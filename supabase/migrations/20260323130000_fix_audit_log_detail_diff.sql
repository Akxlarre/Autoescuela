-- ============================================================================
-- Fix audit_log: detalle con diff de campos cambiados (RF-009)
-- ============================================================================
-- Problema: log_change() solo escribía "Registro actualizado/creado/eliminado",
-- sin indicar qué campo cambió ni cuál era el valor anterior.
--
-- Solución:
--   UPDATE → compara OLD vs NEW en jsonb, reporta campos modificados con el
--            formato: "[Nombre Entidad] Etiqueta: valor_anterior → valor_nuevo"
--   INSERT → reporta el nombre de la entidad creada
--   DELETE → reporta el nombre de la entidad eliminada
--
-- Etiquetas de columnas en español (con fallback automático).
-- Nombre de entidad por tabla:
--   users        → first_names + paternal_last_name (desde jsonb)
--   students     → nombre del users vinculado (SELECT via user_id)
--   instructors  → nombre del users vinculado (SELECT via user_id)
--   enrollments  → número de matrícula
--   vehicles     → patente (license_plate)
--   otros        → "id=X"
--
-- Campos internos omitidos del diff (ruido sin valor de negocio):
--   id, created_at, updated_at, supabase_uid
-- ============================================================================

CREATE OR REPLACE FUNCTION log_change()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id      INT;
  v_headers_raw  TEXT;
  v_header_id    TEXT;
  v_detail       TEXT;
  v_old_json     JSONB;
  v_new_json     JSONB;
  v_src          JSONB;   -- registro fuente para resolver nombre de entidad
  v_key          TEXT;
  v_old_val      TEXT;
  v_new_val      TEXT;
  v_changes      TEXT := '';
  v_entity_label TEXT := '';
  v_col_label    TEXT;
  v_user_id_fk   INT;
  v_related_name TEXT;
  -- Campos internos que no aportan valor en el diff de auditoría
  v_skip_fields  TEXT[] := ARRAY['id','created_at','updated_at','supabase_uid'];
BEGIN
  -- ── Resolver user_id ────────────────────────────────────────────────────────
  -- 1. Header HTTP x-audit-user-id (Edge Functions con service role)
  v_headers_raw := current_setting('request.headers', true);
  IF v_headers_raw IS NOT NULL AND v_headers_raw <> '' THEN
    BEGIN
      v_header_id := (v_headers_raw::json)->>'x-audit-user-id';
      IF v_header_id IS NOT NULL AND v_header_id <> '' THEN
        v_user_id := v_header_id::INT;
      END IF;
    EXCEPTION WHEN others THEN NULL;
    END;
  END IF;

  -- 2. Fallback: auth.uid() → users.id (llamadas con JWT directo)
  IF v_user_id IS NULL THEN
    SELECT id INTO v_user_id
    FROM public.users
    WHERE supabase_uid = auth.uid();
  END IF;

  -- 3. Si el actor es admin, no registrar en audit_log
  IF v_user_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.users u
      JOIN public.roles r ON r.id = u.role_id
      WHERE u.id = v_user_id AND r.name = 'admin'
    ) THEN
      IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
    END IF;
  END IF;

  -- ── Resolver etiqueta de entidad (quién es el registro afectado) ────────────
  v_src := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;

  IF TG_TABLE_NAME = 'users' THEN
    v_entity_label := trim(
      COALESCE(v_src->>'first_names', '') || ' ' ||
      COALESCE(v_src->>'paternal_last_name', '')
    );
    IF v_entity_label IS NULL OR length(trim(v_entity_label)) = 0 THEN
      v_entity_label := 'id=' || COALESCE(v_src->>'id', '?');
    END IF;

  ELSIF TG_TABLE_NAME IN ('students', 'instructors') THEN
    v_user_id_fk := (v_src->>'user_id')::INT;
    IF v_user_id_fk IS NOT NULL THEN
      SELECT trim(first_names || ' ' || paternal_last_name)
        INTO v_related_name
        FROM public.users
       WHERE id = v_user_id_fk;
      v_entity_label := COALESCE(v_related_name, 'id=' || v_user_id_fk::TEXT);
    ELSE
      v_entity_label := 'id=' || COALESCE(v_src->>'id', '?');
    END IF;

  ELSIF TG_TABLE_NAME = 'enrollments' THEN
    IF (v_src->>'number') IS NOT NULL THEN
      v_entity_label := 'Matrícula ' || (v_src->>'number');
    ELSE
      v_entity_label := 'id=' || COALESCE(v_src->>'id', '?');
    END IF;

  ELSIF TG_TABLE_NAME = 'vehicles' THEN
    v_entity_label := COALESCE(v_src->>'license_plate', 'id=' || COALESCE(v_src->>'id', '?'));

  ELSE
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
          -- Mapeo de nombre de columna a etiqueta en español
          v_col_label := CASE v_key
            -- Tabla users / personas
            WHEN 'first_names'          THEN 'Nombres'
            WHEN 'paternal_last_name'   THEN 'Apellido paterno'
            WHEN 'maternal_last_name'   THEN 'Apellido materno'
            WHEN 'email'                THEN 'Email'
            WHEN 'phone'                THEN 'Teléfono'
            WHEN 'rut'                  THEN 'RUT'
            WHEN 'active'               THEN 'Activo'
            WHEN 'role_id'              THEN 'Rol'
            WHEN 'branch_id'            THEN 'Sede'
            WHEN 'first_login'          THEN 'Primer login'
            -- Tabla students
            WHEN 'address'              THEN 'Dirección'
            WHEN 'birth_date'           THEN 'Fecha de nacimiento'
            WHEN 'nationality'          THEN 'Nacionalidad'
            WHEN 'gender'               THEN 'Género'
            -- Tabla instructors
            WHEN 'license_class'        THEN 'Clase de licencia'
            WHEN 'license_expiry'       THEN 'Vencimiento licencia'
            WHEN 'license_status'       THEN 'Estado licencia'
            WHEN 'instructor_type'      THEN 'Tipo de instructor'
            WHEN 'vehicle_id'           THEN 'Vehículo'
            -- Tabla enrollments
            WHEN 'number'               THEN 'Número matrícula'
            WHEN 'status'               THEN 'Estado'
            WHEN 'current_step'         THEN 'Paso actual'
            WHEN 'payment_mode'         THEN 'Modalidad de pago'
            WHEN 'payment_status'       THEN 'Estado de pago'
            WHEN 'total_paid'           THEN 'Total pagado'
            WHEN 'pending_balance'      THEN 'Saldo pendiente'
            WHEN 'course_id'            THEN 'Curso'
            WHEN 'student_id'           THEN 'Alumno'
            WHEN 'contract_accepted'    THEN 'Contrato aceptado'
            WHEN 'registration_channel' THEN 'Canal de registro'
            WHEN 'license_group'        THEN 'Grupo de licencia'
            -- Tabla payments
            WHEN 'amount'               THEN 'Monto'
            WHEN 'method'               THEN 'Método de pago'
            WHEN 'enrollment_id'        THEN 'Matrícula'
            WHEN 'notes'                THEN 'Notas'
            WHEN 'receipt_id'           THEN 'Boleta'
            WHEN 'registered_by'        THEN 'Registrado por'
            -- Tabla vehicles
            WHEN 'license_plate'        THEN 'Patente'
            WHEN 'brand'                THEN 'Marca'
            WHEN 'model'                THEN 'Modelo'
            WHEN 'year'                 THEN 'Año'
            WHEN 'mileage'              THEN 'Kilometraje'
            WHEN 'color'                THEN 'Color'
            WHEN 'fuel_type'            THEN 'Tipo de combustible'
            -- Tabla vehicle_documents
            WHEN 'type'                 THEN 'Tipo'
            WHEN 'expiry_date'          THEN 'Fecha de vencimiento'
            WHEN 'file_url'             THEN 'Archivo'
            WHEN 'document_number'      THEN 'N° documento'
            -- Tabla maintenance_records
            WHEN 'maintenance_type'     THEN 'Tipo de mantención'
            WHEN 'cost'                 THEN 'Costo'
            WHEN 'workshop'             THEN 'Taller'
            WHEN 'performed_at'         THEN 'Fecha realización'
            WHEN 'next_service_date'    THEN 'Próximo servicio'
            WHEN 'km_at_service'        THEN 'KM en servicio'
            WHEN 'observations'         THEN 'Observaciones'
            -- Tabla class_b_sessions
            WHEN 'scheduled_at'         THEN 'Fecha agendada'
            WHEN 'duration_min'         THEN 'Duración (min)'
            WHEN 'instructor_id'        THEN 'Instructor'
            WHEN 'session_status'       THEN 'Estado sesión'
            WHEN 'km_start'             THEN 'KM inicial'
            WHEN 'km_end'               THEN 'KM final'
            -- Tabla student_documents
            WHEN 'review_status'        THEN 'Estado revisión'
            WHEN 'reviewed_by'          THEN 'Revisado por'
            WHEN 'reviewed_at'          THEN 'Fecha revisión'
            -- Tabla certificates
            WHEN 'folio'                THEN 'Folio'
            WHEN 'issued_at'            THEN 'Fecha emisión'
            WHEN 'issued_by'            THEN 'Emitido por'
            WHEN 'certificate_type'     THEN 'Tipo de certificado'
            -- Fallback: convierte snake_case a "Palabras Con Mayúscula"
            ELSE initcap(replace(v_key, '_', ' '))
          END;

          v_changes := v_changes
            || v_col_label || ': '
            || COALESCE(v_old_val, 'vacío')
            || ' → '
            || COALESCE(v_new_val, 'vacío')
            || '; ';
        END IF;
      END LOOP;

      v_detail := CASE
        WHEN v_changes = '' THEN '[' || v_entity_label || '] Sin cambios detectados'
        ELSE '[' || v_entity_label || '] ' || left(v_changes, 480)
      END;

    WHEN 'INSERT' THEN
      v_detail := 'Creado: ' || v_entity_label;

    WHEN 'DELETE' THEN
      v_detail := 'Eliminado: ' || v_entity_label;

  END CASE;

  INSERT INTO public.audit_log (user_id, action, entity, entity_id, detail, created_at)
  VALUES (
    v_user_id,
    TG_OP,
    TG_TABLE_NAME,
    CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END,
    v_detail,
    NOW()
  );

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

COMMENT ON FUNCTION log_change() IS
  'Trigger de auditoría con diff de campos en español. UPDATE muestra [Nombre Entidad] Etiqueta: antes → después. INSERT/DELETE muestran nombre legible de la entidad. user_id resuelto desde header x-audit-user-id o auth.uid().';

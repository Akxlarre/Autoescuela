-- ============================================================================
-- Migración: Traducir el tipo de documento/mantención embebido en entity_label
-- de log_change() (fix-106-m)
-- ============================================================================
-- Problema: audit_humanize_enum_value() (fix-104-m) solo se invoca desde
-- audit_resolve_display_value(), que corre únicamente dentro del diff de UPDATE. La
-- construcción de v_entity_label (usada por INSERT/DELETE y como prefijo del UPDATE) es
-- código aparte que concatena columnas crudas directamente vía v_src->>'columna' — nunca
-- pasa por ningún diccionario. Tres ramas embeben así un valor de enum sin traducir:
-- student_documents, vehicle_documents y maintenance_records (columna 'type').
--
-- Confirmado con captura real: "Sistema / Online eliminó: cedula_identidad de Ignacio
-- Sorko" — el valor real de student_documents.type en producción (verificado en
-- src/app/core/models/ui/enrollment-documents.model.ts y
-- src/app/features/admin/documentos/dms-upload-drawer/dms-upload-drawer.component.ts) es
-- 'cedula_identidad'/'licencia_conducir'/'hoja_vida_conductor'/'autorizacion_notarial'/
-- 'contrato'/'certificado_medico'/'certificado_antecedentes'/'id_photo' — NO coincide con
-- los valores documentados en el comentario de la migración original de la tabla
-- ('national_id', 'driver_license', etc.), que quedaron obsoletos/nunca se usaron en el
-- código real.
--
-- Solución: (1) agregar los valores reales al diccionario audit_humanize_enum_value()
-- (aditivo, conserva las entradas previas); (2) las tres ramas de entity_label que embeben
-- v_src->>'type' ahora pasan por ese diccionario antes de caer al valor crudo.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.audit_humanize_enum_value(p_value TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN CASE p_value
    -- Estados genéricos (enrollments, courses, discounts, promotions, sessions, etc.)
    WHEN 'active'                THEN 'Activo'
    WHEN 'inactive'               THEN 'Inactivo'
    WHEN 'pending'                THEN 'Pendiente'
    WHEN 'partial'                THEN 'Parcial'
    WHEN 'paid'                   THEN 'Pagado'
    WHEN 'paid_full'              THEN 'Pagado completo'
    WHEN 'draft'                  THEN 'Borrador'
    WHEN 'pending_docs'           THEN 'Documentos pendientes'
    WHEN 'pending_review'         THEN 'En revisión'
    WHEN 'in_review'              THEN 'En revisión'
    WHEN 'completed'              THEN 'Completado'
    WHEN 'cancelled'              THEN 'Cancelado'
    WHEN 'expired'                THEN 'Vencido'
    WHEN 'expiring_soon'          THEN 'Por vencer'
    WHEN 'valid'                  THEN 'Vigente'
    WHEN 'graduated'              THEN 'Egresado'
    WHEN 'planned'                THEN 'Planificado'
    WHEN 'in_progress'            THEN 'En curso'
    WHEN 'finished'               THEN 'Finalizado'
    WHEN 'scheduled'              THEN 'Programada'
    WHEN 'no_show'                THEN 'Inasistencia'
    WHEN 'present'                THEN 'Presente'
    WHEN 'absent'                 THEN 'Ausente'
    WHEN 'excused'                THEN 'Justificado'
    WHEN 'approved'               THEN 'Aprobado'
    WHEN 'rejected'               THEN 'Rechazado'
    WHEN 'enrolled'               THEN 'Matriculado'
    WHEN 'not_started'            THEN 'No iniciado'
    WHEN 'fit'                    THEN 'Apto'
    WHEN 'unfit'                  THEN 'No apto'
    WHEN 'failed'                 THEN 'Reprobado'
    WHEN 'available'              THEN 'Disponible'
    WHEN 'issued'                 THEN 'Emitido'
    WHEN 'open'                   THEN 'Abierto'
    WHEN 'closed'                 THEN 'Cerrado'
    WHEN 'deducted'               THEN 'Descontado'
    WHEN 'upcoming'               THEN 'Próximo'
    WHEN 'operational'            THEN 'Operativo'
    WHEN 'in_use'                 THEN 'En uso'
    WHEN 'maintenance'            THEN 'En mantención'
    WHEN 'out_of_service'         THEN 'Fuera de servicio'
    WHEN 'blocked'                THEN 'Bloqueado'

    -- Canal / modalidad
    WHEN 'online'                 THEN 'En línea'
    WHEN 'in_person'              THEN 'Presencial'

    -- Documentos y trámites — valores heredados del comentario original de la tabla
    -- (obsoletos, nunca usados en código real, se conservan por compatibilidad hacia atrás)
    WHEN 'medical_leave'          THEN 'Licencia médica'
    WHEN 'medical_certificate'    THEN 'Certificado médico'
    WHEN 'notarial_authorization' THEN 'Autorización notarial'
    WHEN 'national_id'            THEN 'Cédula de identidad'
    WHEN 'driver_license'         THEN 'Licencia de conducir'
    WHEN 'driver_record'          THEN 'Hoja de vida del conductor'
    WHEN 'psychological_exam'     THEN 'Examen psicológico'
    WHEN 'background_certificate' THEN 'Certificado de antecedentes'
    WHEN 'factura_folios'         THEN 'Folios de factura'
    WHEN 'resolucion_mtt'         THEN 'Resolución MTT'
    WHEN 'decreto'                THEN 'Decreto'
    WHEN 'otro'                   THEN 'Otro'
    WHEN 'other'                  THEN 'Otro'

    -- Documentos — valores REALES usados por la app (fix-106-m; ver
    -- src/app/core/models/ui/enrollment-documents.model.ts y
    -- dms-upload-drawer.component.ts, studentDocTypes)
    WHEN 'id_photo'               THEN 'Foto (Carnet)'
    WHEN 'cedula_identidad'       THEN 'Cédula de Identidad'
    WHEN 'licencia_conducir'      THEN 'Licencia de Conducir'
    WHEN 'hoja_vida_conductor'    THEN 'Hoja de Vida del Conductor'
    WHEN 'autorizacion_notarial'  THEN 'Autorización Notarial'
    WHEN 'contrato'               THEN 'Contrato'
    WHEN 'certificado_medico'     THEN 'Certificado Médico'
    WHEN 'certificado_antecedentes' THEN 'Certificado de Antecedentes'

    -- Facturación
    WHEN 'boleta'                 THEN 'Boleta'
    WHEN 'factura'                THEN 'Factura'
    WHEN 'sence'                  THEN 'SENCE'
    WHEN 'particular'             THEN 'Particular'
    WHEN 'sence_franchise'        THEN 'Franquicia SENCE'
    WHEN 'percentage'             THEN 'Porcentaje'
    WHEN 'fixed_amount'           THEN 'Monto fijo'

    -- Vehículos
    WHEN 'sedan'                  THEN 'Sedán'
    WHEN 'suv'                    THEN 'SUV'
    WHEN 'manual'                 THEN 'Manual'
    WHEN 'automatic'              THEN 'Automática'
    WHEN 'soap'                   THEN 'SOAP'
    WHEN 'technical_inspection'   THEN 'Revisión técnica'
    WHEN 'circulation_permit'     THEN 'Permiso de circulación'
    WHEN 'insurance'              THEN 'Seguro'
    WHEN 'preventive'             THEN 'Preventiva'
    WHEN 'corrective'             THEN 'Correctiva'
    WHEN 'accident'               THEN 'Accidente'
    WHEN 'infraction'             THEN 'Infracción'
    WHEN 'mechanical_damage'      THEN 'Daño mecánico'

    -- Notificaciones y bitácora
    WHEN 'downloaded'             THEN 'Descargado'
    WHEN 'email_sent'             THEN 'Correo enviado'
    WHEN 'printed'                THEN 'Impreso'
    WHEN 'email'                  THEN 'Correo'
    WHEN 'whatsapp'               THEN 'WhatsApp'
    WHEN 'system'                 THEN 'Sistema'
    WHEN 'installment_charge'     THEN 'Cobro de cuota'

    -- Biometría
    WHEN 'entry'                  THEN 'Entrada'
    WHEN 'exit'                   THEN 'Salida'
    WHEN 'fingerprint'            THEN 'Huella dactilar'
    WHEN 'facial'                 THEN 'Facial'

    -- Cursos y clasificación
    WHEN 'class_b'                THEN 'Clase B'
    WHEN 'clase_b'                THEN 'Clase B'
    WHEN 'professional'           THEN 'Profesional'
    WHEN 'clase_profesional'      THEN 'Clase Profesional'
    WHEN 'theory'                 THEN 'Teórico'
    WHEN 'practice'               THEN 'Práctico'
    WHEN 'both'                   THEN 'Ambos'
    WHEN 'general'                THEN 'General'
    WHEN 'administrativo'         THEN 'Administrativo'
    WHEN 'all'                    THEN 'Todos'
    WHEN 'pdf'                    THEN 'PDF'
    WHEN 'docx'                   THEN 'Word (DOCX)'
    WHEN 'xlsx'                   THEN 'Excel (XLSX)'

    -- Observaciones de secretaría / caja / anticipos
    WHEN 'observation'            THEN 'Observación'
    WHEN 'reminder'               THEN 'Recordatorio'
    WHEN 'urgent'                 THEN 'Urgente'
    WHEN 'seen'                   THEN 'Vista'
    WHEN 'resolved'               THEN 'Resuelta'
    WHEN 'salary'                 THEN 'Sueldo'
    WHEN 'allowance'              THEN 'Viático'
    WHEN 'materials'              THEN 'Materiales'
    WHEN 'fuel'                   THEN 'Combustible'
    WHEN 'rent'                   THEN 'Arriendo'
    WHEN 'cleaning'               THEN 'Aseo'
    WHEN 'descuadre'              THEN 'Descuadre'

    ELSE NULL
  END;
END;
$$;

COMMENT ON FUNCTION public.audit_humanize_enum_value(TEXT) IS
  'fix-106-m: agrega los valores REALES de tipo de documento usados por la app (cedula_identidad, licencia_conducir, hoja_vida_conductor, autorizacion_notarial, contrato, certificado_medico, certificado_antecedentes, id_photo) — los del comentario original de student_documents (national_id, driver_license, etc.) eran obsoletos y nunca se usaron en código real. Se conservan por compatibilidad. Traduce valores de enum del diff de UPDATE y del entity_label de INSERT/DELETE. Devuelve NULL si el valor no está en el diccionario.';

-- ── log_change(): entity_label de student_documents/vehicle_documents/maintenance_records
-- ── ahora traduce el tipo antes de mostrarlo (antes: crudo) ──────────────────────────────
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

  -- Fallback 3: sesión autenticada normal — request.jwt.claim.sub es el UUID de
  -- Supabase Auth (auth.uid()), NO el id serial de public.users. Se resuelve por
  -- supabase_uid, igual que auth_user_id() en las políticas RLS.
  IF v_user_id IS NULL THEN
    BEGIN
      SELECT id INTO v_user_id
      FROM public.users
      WHERE supabase_uid = NULLIF(current_setting('request.jwt.claim.sub', true), '')::UUID;
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
  'Trigger de auditoría (fix-106-m): entity_label de student_documents/vehicle_documents/maintenance_records ahora traduce la columna "type" vía audit_humanize_enum_value() en vez de mostrarla cruda (ej. "cedula_identidad" -> "Cédula de Identidad"). Resto del cuerpo sin cambios respecto a fix-103-m (20260802130000).';

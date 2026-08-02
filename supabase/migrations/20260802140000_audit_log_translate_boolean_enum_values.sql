-- ============================================================================
-- Migración: Traducir valores booleanos y de enum crudos en el diff de UPDATE
-- de log_change() (fix-104-m)
-- ============================================================================
-- Problema: fix-102-m tradujo el NOMBRE de columna (current_step -> "Paso actual") y
-- resolvió IDs de FK (promotion_course_id: 29 -> nombre real), pero el VALOR de columnas
-- booleanas y de enum se sigue insertando tal cual viene de Postgres: "true"/"false",
-- "draft", "active", "pending", "scheduled", etc. Resultado reportado: "Primer inicio de
-- sesión: true -> false" — la etiqueta ya está en español, el valor no. El público del
-- sistema no necesariamente maneja inglés.
--
-- Solución: audit_resolve_display_value() (de fix-102-m) ya es el único punto donde se
-- decide el texto de un valor del diff. Se agrega, cuando el CASE de columnas conocidas no
-- resolvió nada (v_result queda NULL), dos fallbacks en cascada antes de rendirse:
--   1. Booleano ('true'/'false') -> 'Sí'/'No'.
--   2. Valor de enum conocido del esquema -> audit_humanize_enum_value() (diccionario de
--      ~110 tokens: status, type, category, etc. de todas las tablas auditadas).
-- Si ninguno aplica, se conserva el comportamiento actual (NULL -> el caller usa el crudo).
--
-- Limitación conocida: el diccionario de enums es best-effort sobre los valores
-- documentados en los comentarios de las definiciones de tabla originales (archivos de
-- migración de los dominios 01 a 08). Un valor de enum futuro no listado seguirá
-- mostrándose crudo hasta que se agregue aquí (no hay fallback de "humanización genérica"
-- para enums como sí lo hay para columnas — capitalizar una palabra en inglés no la
-- traduce, así que preferimos dejarla como estaba antes a fingir una traducción).
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

    -- Documentos y trámites
    WHEN 'medical_leave'          THEN 'Licencia médica'
    WHEN 'medical_certificate'    THEN 'Certificado médico'
    WHEN 'id_photo'               THEN 'Foto carnet'
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
  'fix-104-m: traduce valores de enum conocidos del esquema (status, type, category, etc.) en el diff de UPDATE de audit_log a español. Devuelve NULL si el valor no está en el diccionario — el caller conserva el valor crudo (no hay fallback de humanización genérica: capitalizar inglés no lo traduce).';

-- ── audit_resolve_display_value(): agrega fallback de booleano + enum ─────────
CREATE OR REPLACE FUNCTION public.audit_resolve_display_value(p_column TEXT, p_value TEXT)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_result TEXT;
BEGIN
  IF p_value IS NULL THEN
    RETURN NULL;
  END IF;

  CASE
    WHEN p_column = 'current_step' THEN
      v_result := CASE p_value
        WHEN '1' THEN 'Datos personales'
        WHEN '2' THEN 'Asignación'
        WHEN '3' THEN 'Documentos'
        WHEN '4' THEN 'Contrato'
        WHEN '5' THEN 'Pago'
        WHEN '6' THEN 'Confirmación'
        ELSE NULL
      END;

    WHEN p_column = 'promotion_course_id' THEN
      SELECT pc.code || ' (' || c.name || ')'
      INTO v_result
      FROM promotion_courses pc
      JOIN courses c ON c.id = pc.course_id
      WHERE pc.id = p_value::INT;

    WHEN p_column = 'course_id' THEN
      SELECT name INTO v_result FROM courses WHERE id = p_value::INT;

    WHEN p_column = 'branch_id' THEN
      SELECT name INTO v_result FROM branches WHERE id = p_value::INT;

    WHEN p_column = 'role_id' THEN
      SELECT name INTO v_result FROM roles WHERE id = p_value::INT;

    WHEN p_column IN ('instructor_id', 'original_instructor_id', 'absent_instructor_id', 'replacement_instructor_id') THEN
      SELECT u.first_names || ' ' || u.paternal_last_name
      INTO v_result
      FROM instructors i JOIN users u ON u.id = i.user_id
      WHERE i.id = p_value::INT;

    WHEN p_column = 'lecturer_id' THEN
      SELECT first_names || ' ' || paternal_last_name
      INTO v_result
      FROM lecturers WHERE id = p_value::INT;

    WHEN p_column = 'vehicle_id' THEN
      SELECT license_plate INTO v_result FROM vehicles WHERE id = p_value::INT;

    WHEN p_column = 'student_id' THEN
      SELECT u.first_names || ' ' || u.paternal_last_name
      INTO v_result
      FROM students s JOIN users u ON u.id = s.user_id
      WHERE s.id = p_value::INT;

    WHEN p_column IN ('enrollment_id', 'converted_enrollment_id', 'history_ref_id', 'enrollment_a2_id', 'enrollment_a4_id') THEN
      SELECT number INTO v_result FROM enrollments WHERE id = p_value::INT;

    WHEN p_column = 'certificate_id' THEN
      SELECT 'Folio ' || folio INTO v_result FROM certificates WHERE id = p_value::INT;

    WHEN p_column = 'receipt_id' THEN
      SELECT type || ' N°' || folio INTO v_result FROM sii_receipts WHERE id = p_value::INT;

    WHEN p_column = 'discount_id' THEN
      SELECT name INTO v_result FROM discounts WHERE id = p_value::INT;

    WHEN p_column = 'service_id' THEN
      SELECT name INTO v_result FROM service_catalog WHERE id = p_value::INT;

    WHEN p_column = 'sence_code_id' THEN
      SELECT code INTO v_result FROM sence_codes WHERE id = p_value::INT;

    WHEN p_column = 'template_id' THEN
      SELECT name INTO v_result FROM professional_schedule_templates WHERE id = p_value::INT;

    WHEN p_column = 'batch_id' THEN
      SELECT batch_code INTO v_result FROM certificate_batches WHERE id = p_value::INT;

    -- Columnas *_by: siempre referencian a users.id (quién hizo la acción).
    WHEN right(p_column, 3) = '_by' THEN
      SELECT first_names || ' ' || paternal_last_name
      INTO v_result
      FROM users WHERE id = p_value::INT;

    ELSE
      v_result := NULL;
  END CASE;

  -- fix-104-m: si la columna no era una FK/enum conocida por NOMBRE, intentar traducir el
  -- VALOR crudo: primero como booleano, después contra el diccionario de enums del esquema.
  IF v_result IS NULL THEN
    IF p_value = 'true' THEN
      v_result := 'Sí';
    ELSIF p_value = 'false' THEN
      v_result := 'No';
    ELSE
      v_result := public.audit_humanize_enum_value(p_value);
    END IF;
  END IF;

  RETURN v_result;
EXCEPTION WHEN OTHERS THEN
  -- ID no resoluble (fila borrada, valor no numérico, etc.) — el caller usa el crudo.
  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.audit_resolve_display_value(TEXT, TEXT) IS
  'fix-104-m: además de resolver IDs de FK/enum conocidos por columna (fix-102-m), traduce valores booleanos (true/false -> Sí/No) y de enum del esquema (audit_humanize_enum_value()) cuando la columna no tenía una regla propia. Devuelve NULL si nada aplica — el caller conserva el valor crudo.';

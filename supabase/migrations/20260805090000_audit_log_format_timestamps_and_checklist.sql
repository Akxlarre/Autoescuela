-- ============================================================================
-- Migración: Formatear timestamps/horas crudos y el checklist de evaluación
-- en el feed de actividad del dashboard (fix-112-m)
-- ============================================================================
-- Problema: tras fix-102-m (nombres de columna) y fix-104-m (booleanos/enums), el diff de
-- UPDATE y el detalle de INSERT de log_change() seguían mostrando dos tipos de valor crudo:
--   1. Fechas/horas: "Fecha de finalización: Sin asignar -> 2026-08-04T10:07:02.438+00:00",
--      "Hora de inicio: Sin asignar -> 16:30:15" — audit_resolve_display_value() nunca
--      intentaba formatear timestamps/horas/fechas, solo FKs/booleanos/enums conocidos por
--      NOMBRE de columna. Lo mismo pasaba en el entity_label de class_b_sessions (INSERT),
--      construido directo desde v_src->>'scheduled_at' sin pasar por ninguna función.
--   2. evaluation_checklist (jsonb, ver 20260401000100): caía en el fallback genérico de
--      audit_humanize_column ("Evaluation Checklist") y el VALOR se insertaba como el JSON
--      crudo completo ("[]" -> "[{"id": "control_volante", "label": "Control del
--      volante", "checked": true}, ...]").
--
-- Solución:
--   1. audit_format_timestamp_value(text) → nueva función que detecta por forma (regex) si
--      un valor crudo es timestamp/hora/fecha ISO y lo formatea en es-CL, convirtiendo a
--      America/Santiago cuando trae información de timezone. Se usa como fallback en
--      audit_resolve_display_value() (antes del booleano/enum) y directo en el entity_label
--      de class_b_sessions dentro de log_change().
--   2. audit_format_evaluation_checklist(text) → nueva función que parsea el array jsonb y
--      devuelve "N de M ítems marcados" en vez del JSON crudo. Se enchufa como caso especial
--      en audit_resolve_display_value().
--   3. audit_humanize_column: se agrega 'evaluation_checklist' -> 'Checklist de evaluación'.
--   4. audit_humanize_enum_value: se agrega 'reserved' -> 'Reservada' (status de
--      class_b_sessions ausente del diccionario — quedaba crudo en el diff: "Estado:
--      reserved -> En curso").
--
-- log_change() se redefine completa (mismo cuerpo de 20260802160000/fix-108-m) porque
-- CREATE OR REPLACE reemplaza toda la función (ver DG-043) — el único cambio real es la
-- línea del entity_label de class_b_sessions.
-- ============================================================================

-- ── 1. Formateo de timestamps/horas/fechas crudos ───────────────────────────
CREATE OR REPLACE FUNCTION public.audit_format_timestamp_value(p_value TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_value IS NULL OR p_value = '' THEN
    RETURN NULL;
  END IF;

  -- Timestamp con fecha y hora (con o sin milisegundos/timezone) — ej.
  -- "2026-08-04T10:07:02.438+00:00" o "2026-08-04 10:07:02"
  IF p_value ~ '^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}' THEN
    RETURN to_char(p_value::timestamptz AT TIME ZONE 'America/Santiago', 'DD-MM-YYYY HH24:MI');
  END IF;

  -- Hora sola — ej. "16:30:15" o "16:30"
  IF p_value ~ '^\d{2}:\d{2}(:\d{2})?$' THEN
    RETURN to_char(p_value::time, 'HH24:MI');
  END IF;

  -- Fecha sola — ej. "2026-08-04"
  IF p_value ~ '^\d{4}-\d{2}-\d{2}$' THEN
    RETURN to_char(p_value::date, 'DD-MM-YYYY');
  END IF;

  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  -- Valor con forma de fecha/hora pero no parseable (edge case) — el caller usa el crudo.
  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.audit_format_timestamp_value(TEXT) IS
  'fix-112-m: detecta por forma (regex) si un valor crudo de audit_log.detail es timestamp/hora/fecha ISO y lo formatea en es-CL (DD-MM-YYYY HH24:MI), convirtiendo timestamps con timezone a America/Santiago. Devuelve NULL si no calza con ningún patrón conocido.';

-- ── 2. Resumen legible del checklist de evaluación ──────────────────────────
CREATE OR REPLACE FUNCTION public.audit_format_evaluation_checklist(p_value TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_total INT;
  v_checked INT;
BEGIN
  IF p_value IS NULL OR p_value = '' THEN
    RETURN NULL;
  END IF;

  SELECT count(*), count(*) FILTER (WHERE (item->>'checked')::BOOLEAN)
  INTO v_total, v_checked
  FROM jsonb_array_elements(p_value::jsonb) AS item;

  IF v_total = 0 THEN
    RETURN 'Sin completar';
  END IF;

  RETURN v_checked || ' de ' || v_total || ' ítems marcados';
EXCEPTION WHEN OTHERS THEN
  -- No era un array jsonb válido — el caller usa el crudo.
  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.audit_format_evaluation_checklist(TEXT) IS
  'fix-112-m: convierte el jsonb crudo de class_b_sessions.evaluation_checklist ([{"id","label","checked"}, ...]) en un resumen legible ("N de M ítems marcados") para el diff de audit_log. Devuelve NULL si no es un array jsonb válido.';

-- ── 3. Diccionario de columnas: agregar evaluation_checklist ────────────────
CREATE OR REPLACE FUNCTION public.audit_humanize_column(p_key TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
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

    -- Fallback genérico: nunca más snake_case crudo (ej. "foo_bar_id" -> "Foo bar id").
    -- Cubre columnas futuras no listadas arriba sin necesidad de tocar este diccionario
    -- de inmediato — mejor "Foo Bar Id" que "foo_bar_id", aunque no sea la traducción ideal.
    ELSE initcap(replace(p_key, '_', ' '))
  END;
END;
$$;

COMMENT ON FUNCTION public.audit_humanize_column(TEXT) IS
  'fix-102-m + fix-112-m: traduce nombres de columna de audit_log.detail a español legible. Diccionario de ~90 columnas conocidas + fallback genérico (Title Case) para columnas futuras no listadas.';

-- ── 4. Diccionario de enums: agregar 'reserved' (status de class_b_sessions) ─
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
    WHEN 'reserved'               THEN 'Reservada'
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
  'fix-104-m + fix-112-m: traduce valores de enum conocidos del esquema (status, type, category, etc.) en el diff de UPDATE de audit_log a español, incluyendo reserved -> Reservada (status de class_b_sessions). Devuelve NULL si el valor no está en el diccionario.';

-- ── 5. audit_resolve_display_value(): agrega checklist + fallback de timestamp ─
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

    WHEN p_column = 'evaluation_checklist' THEN
      v_result := public.audit_format_evaluation_checklist(p_value);

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

  -- fix-112-m: si la columna no era una FK/enum/caso especial conocido por NOMBRE, intentar
  -- formatear el VALOR crudo como fecha/hora/timestamp ISO antes de caer al booleano/enum.
  IF v_result IS NULL THEN
    v_result := public.audit_format_timestamp_value(p_value);
  END IF;

  -- fix-104-m: si tampoco era fecha/hora, intentar traducir el VALOR crudo: primero como
  -- booleano, después contra el diccionario de enums del esquema.
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
  'fix-104-m + fix-112-m: además de resolver IDs de FK/enum conocidos y booleanos/enums, formatea fechas/horas ISO crudas (audit_format_timestamp_value) y resume evaluation_checklist en "N de M ítems marcados". Devuelve NULL si nada aplica — el caller conserva el valor crudo.';

-- ── 6. log_change(): formatear scheduled_at en el entity_label de class_b_sessions ─
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
  'Trigger de auditoría (fix-108-m + fix-112-m): entity_label de class_b_sessions formatea scheduled_at con audit_format_timestamp_value() en vez de mostrar el ISO crudo. Resto del cuerpo sin cambios respecto a fix-108-m (20260802160000).';

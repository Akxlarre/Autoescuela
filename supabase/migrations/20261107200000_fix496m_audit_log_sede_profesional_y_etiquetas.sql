-- fix-496-m: auditoría de Profesional con sede y detalles sin datos crudos (testing fix-485-m)
--
--   1. Profesional: promotion_courses, class_book, professional_theory_sessions,
--      professional_practice_sessions y professional_module_grades quedaban con branch_id NULL
--      (el admin que filtra "Conductores Chillán" no veía ninguna acción de Profesional).
--   2. Pre-inscripción: "Inscripción Web: Clase  - Nombre" (leía desired_course_class, siempre NULL).
--   3. enrollment_payment_overrides: "Registrado: id=7", sin sede.
--   4. Tipos de documento del alumno en español sin traducir ("autorizacion_notarial de …").
--   5. Columnas de las tablas que agregó fix-490-m sin traducir ("Value: 5 -> 7").
--   6. Montos del detalle de un cambio sin miles; pago pendiente "(Desconocido)".
--   7. "Cursos modificado (2 ítems)" → "Cursos: lista actualizada (2 ítems)".
--   8. Texto NULL -> vacío dejaba "Notas: Sin asignar -> ".
--   9. Certificado: sede de la matrícula, no del usuario del alumno.
--
-- Cada función se redefine completa a partir de su versión vigente (fix-413-m, fix-112-m,
-- fix-490-m); los cambios están marcados con "fix-496-m". Idempotente.
-- Test: supabase/tests/audit/fix-496-m-auditoria-sede-profesional.sql

-- ── 1. Etiquetas de columnas ───────────────────────────────────────────────────────────────
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

-- ── 2. Valores de enum ─────────────────────────────────────────────────────────────────────
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
    -- fix-496-m: tipos de documento del alumno (las claves reales están en español)
    WHEN 'cedula_identidad'       THEN 'Cédula de identidad'
    WHEN 'hoja_vida_conductor'    THEN 'Hoja de vida del conductor'
    WHEN 'autorizacion_notarial'  THEN 'Autorización notarial'
    WHEN 'certificado_medico'     THEN 'Certificado médico'
    WHEN 'foto_carnet'            THEN 'Foto carnet'
    WHEN 'licencia_conducir'      THEN 'Licencia de conducir'

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
    -- fix-496-m: ajustes de cuadratura y excepciones de pago
    WHEN 'gasto_olvidado'         THEN 'Gasto olvidado'
    WHEN 'correccion_manual'      THEN 'Corrección manual'
    WHEN 'clases'                 THEN 'Clases habilitadas sin pago'
    WHEN 'certificado'            THEN 'Certificado emitido con deuda'

    ELSE NULL
  END;
END;
$$;

-- ── 3. Diff de website_config ──────────────────────────────────────────────────────────────
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
          -- fix-496-m: "valor actualizado" concuerda con cualquier campo ("Cursos modificado" no).
          v_parts := array_append(v_parts, v_section || ' · ' || v_field || ': valor actualizado');
        END IF;
      END LOOP;
    ELSIF jsonb_typeof(v_n) = 'array' THEN
      v_parts := array_append(v_parts,
        v_section || ': lista actualizada (' || jsonb_array_length(v_n) || ' ítems)');
    ELSE
      v_parts := array_append(v_parts, v_section || ': valor actualizado');
    END IF;
  END LOOP;

  RETURN array_to_string(v_parts, '; ');
END;
$function$;

-- ── 4. log_change() ────────────────────────────────────────────────────────────────────────
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
  -- fix-496-m: columnas de dinero que el detalle muestra en pesos.
  v_money_fields TEXT[] := ARRAY[
    'amount', 'total_amount', 'base_price', 'price', 'monto', 'discount', 'discount_amount',
    'amount_paid', 'total_paid', 'pending_balance', 'cash_amount', 'transfer_amount',
    'card_amount', 'voucher_amount', 'opening_amount', 'arqueo_amount', 'difference',
    'total_income', 'total_expenses', 'balance', 'cash_expenses', 'pending_at_override',
    'amount_per_hour'
  ];
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
      -- fix-496-m: sin montos por medio de pago = pago aún no pagado.
      WHEN (v_src->>'status') = 'pending' THEN 'Pendiente'
      ELSE 'Sin medio de pago'
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
    -- fix-496-m: la clase pedida vive en requested_license_class (desired_course_class quedó
    -- siempre NULL) y la sede en la fila.
    v_branch_id := COALESCE((v_src->>'branch_id')::INT, v_branch_id);
    v_entity_label := 'Clase ' ||
      COALESCE(NULLIF(v_src->>'requested_license_class', ''), NULLIF(v_src->>'desired_course_class', ''), '?') ||
      ' - ' || COALESCE(v_temp_text, '');

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

    -- fix-496-m: sede de la matrícula del certificado (D4: sede de la acción).
    v_branch_id := COALESCE(
      (SELECT e.branch_id FROM enrollments e WHERE e.id = (v_src->>'enrollment_id')::INT),
      v_branch_id);

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

    -- fix-496-m: sede de la promoción.
    SELECT p.branch_id INTO v_branch_id
    FROM professional_promotions p WHERE p.id = (v_src->>'promotion_id')::INT;

    v_entity_label := COALESCE(v_temp_text, '') || ' (' || COALESCE(v_src->>'code', '?') || ')';

  ELSIF TG_TABLE_NAME = 'class_book' THEN
    SELECT c.code
    INTO v_temp_text
    FROM promotion_courses c
    WHERE c.id = (v_src->>'promotion_course_id')::INT;

    -- fix-496-m: sede del libro (o de la promoción del curso).
    SELECT COALESCE((v_src->>'branch_id')::INT, p.branch_id) INTO v_branch_id
    FROM promotion_courses pc
    JOIN professional_promotions p ON p.id = pc.promotion_id
    WHERE pc.id = (v_src->>'promotion_course_id')::INT;

    v_entity_label := 'Curso ' || COALESCE(v_temp_text, '?') || ' - período ' || COALESCE(v_src->>'period', '?');

  ELSIF TG_TABLE_NAME = 'professional_theory_sessions' THEN
    SELECT c.code
    INTO v_temp_text
    FROM promotion_courses c
    WHERE c.id = (v_src->>'promotion_course_id')::INT;

    -- fix-496-m: sede de la promoción del curso.
    SELECT p.branch_id INTO v_branch_id
    FROM promotion_courses pc
    JOIN professional_promotions p ON p.id = pc.promotion_id
    WHERE pc.id = (v_src->>'promotion_course_id')::INT;

    v_entity_label := 'Curso ' || COALESCE(v_temp_text, '?') || ' - ' || COALESCE(to_char((v_src->>'date')::date, 'DD-MM-YYYY'), v_src->>'date', '');

  ELSIF TG_TABLE_NAME = 'professional_practice_sessions' THEN
    SELECT c.code
    INTO v_temp_text
    FROM promotion_courses c
    WHERE c.id = (v_src->>'promotion_course_id')::INT;

    -- fix-496-m: sede de la promoción del curso.
    SELECT p.branch_id INTO v_branch_id
    FROM promotion_courses pc
    JOIN professional_promotions p ON p.id = pc.promotion_id
    WHERE pc.id = (v_src->>'promotion_course_id')::INT;

    v_entity_label := 'Curso ' || COALESCE(v_temp_text, '?') || ' - ' || COALESCE(to_char((v_src->>'date')::date, 'DD-MM-YYYY'), v_src->>'date', '');

  ELSIF TG_TABLE_NAME = 'professional_module_grades' THEN
    -- fix-496-m: sede de la matrícula.
    SELECT e.number, e.branch_id
    INTO v_temp_text, v_branch_id
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

  -- fix-496-m: excepción de pago (clases o certificado habilitados con deuda).
  ELSIF TG_TABLE_NAME = 'enrollment_payment_overrides' THEN
    SELECT e.branch_id, u.first_names || ' ' || u.paternal_last_name,
           COALESCE(e.number, 'Matrícula #' || e.id)
    INTO v_branch_id, v_temp_text, v_temp_text2
    FROM enrollments e
    JOIN students s ON s.id = e.student_id
    JOIN users u ON u.id = s.user_id
    WHERE e.id = (v_src->>'enrollment_id')::INT;

    v_entity_label :=
      COALESCE(public.audit_humanize_enum_value(v_src->>'kind'), v_src->>'kind', 'Excepción de pago') ||
      ' - ' || COALESCE(v_temp_text, '?') || ' (' || COALESCE(v_temp_text2, 'Matrícula ?') || ')' ||
      ' con deuda de ' || public.audit_format_clp(v_src->>'pending_at_override');

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

          -- fix-496-m: un texto vacío equivale a sin asignar (no deja "Notas: Sin asignar -> ").
          v_old_val := NULLIF(v_old_json ->> v_key, '');
          v_new_val := NULLIF(v_new_json ->> v_key, '');

          IF v_old_val IS DISTINCT FROM v_new_val THEN
            v_col_label := public.audit_humanize_column(v_key);

            v_old_display := public.audit_resolve_display_value(v_key, v_old_val);
            v_new_display := public.audit_resolve_display_value(v_key, v_new_val);

            -- fix-496-m: montos con separador de miles ("Monto: $1.234 -> $4.321").
            IF v_key = ANY(v_money_fields)
               OR (TG_TABLE_NAME = 'discounts' AND v_key = 'value' AND (v_src->>'discount_type') = 'fixed_amount') THEN
              IF v_old_display IS NULL AND v_old_val ~ '^-?[0-9]+(\.[0-9]+)?$' THEN
                v_old_display := public.audit_format_clp(v_old_val);
              END IF;
              IF v_new_display IS NULL AND v_new_val ~ '^-?[0-9]+(\.[0-9]+)?$' THEN
                v_new_display := public.audit_format_clp(v_new_val);
              END IF;
            ELSIF TG_TABLE_NAME = 'discounts' AND v_key = 'value' THEN
              v_old_display := COALESCE(v_old_val || '%', v_old_display);
              v_new_display := COALESCE(v_new_val || '%', v_new_display);
            END IF;

            v_old_display := COALESCE(v_old_display, v_old_val, 'Sin asignar');
            v_new_display := COALESCE(v_new_display, v_new_val, 'Sin asignar');

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
  'Trigger de auditoría con diff de campos en español. user_id: (1) sesión auth.uid(); sin sesión y con service key, (2) header x-audit-user-id, (3) registered_by de la fila; sin sesión ni service key (cron) queda NULL = Sistema (fix-069-i). Una anulación de pago/venta se registra como "Pago anulado: … — Motivo: … — Anulado por: …". website_config lista las secciones y campos cambiados; montos con separador de miles (fix-490-m). Sede de Profesional desde la promoción, excepciones de pago con etiqueta propia (fix-496-m).';

-- ── 5. Sede de los registros de Profesional ya existentes ──────────────────────────────────
UPDATE public.audit_log a
SET branch_id = p.branch_id
FROM public.promotion_courses pc
JOIN public.professional_promotions p ON p.id = pc.promotion_id
WHERE a.branch_id IS NULL
  AND a.entity = 'promotion_courses'
  AND a.entity_id = pc.id;

UPDATE public.audit_log a
SET branch_id = p.branch_id
FROM public.professional_theory_sessions s
JOIN public.promotion_courses pc ON pc.id = s.promotion_course_id
JOIN public.professional_promotions p ON p.id = pc.promotion_id
WHERE a.branch_id IS NULL
  AND a.entity = 'professional_theory_sessions'
  AND a.entity_id = s.id;

UPDATE public.audit_log a
SET branch_id = p.branch_id
FROM public.professional_practice_sessions s
JOIN public.promotion_courses pc ON pc.id = s.promotion_course_id
JOIN public.professional_promotions p ON p.id = pc.promotion_id
WHERE a.branch_id IS NULL
  AND a.entity = 'professional_practice_sessions'
  AND a.entity_id = s.id;

UPDATE public.audit_log a
SET branch_id = COALESCE(cb.branch_id, p.branch_id)
FROM public.class_book cb
JOIN public.promotion_courses pc ON pc.id = cb.promotion_course_id
JOIN public.professional_promotions p ON p.id = pc.promotion_id
WHERE a.branch_id IS NULL
  AND a.entity = 'class_book'
  AND a.entity_id = cb.id;

UPDATE public.audit_log a
SET branch_id = e.branch_id
FROM public.professional_module_grades g
JOIN public.enrollments e ON e.id = g.enrollment_id
WHERE a.branch_id IS NULL
  AND a.entity = 'professional_module_grades'
  AND a.entity_id = g.id;

UPDATE public.audit_log a
SET branch_id = e.branch_id
FROM public.enrollment_payment_overrides o
JOIN public.enrollments e ON e.id = o.enrollment_id
WHERE a.branch_id IS NULL
  AND a.entity = 'enrollment_payment_overrides'
  AND a.entity_id = o.id;

-- Profesional solo existe en una sede: los registros cuya fila ya se borró (sesiones de
-- promociones eliminadas) toman la sede que tiene Profesional.
UPDATE public.audit_log a
SET branch_id = (SELECT b.id FROM public.branches b WHERE b.has_professional ORDER BY b.id LIMIT 1)
WHERE a.branch_id IS NULL
  AND a.entity IN ('promotion_courses', 'professional_theory_sessions',
                   'professional_practice_sessions', 'class_book', 'professional_module_grades')
  AND (SELECT count(*) FROM public.branches b WHERE b.has_professional) = 1;

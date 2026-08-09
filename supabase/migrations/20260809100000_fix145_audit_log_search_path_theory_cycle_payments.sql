-- ============================================================================
-- Fix-145-m: 4 bugs de audit_log detectados en QA de spec 0006-m
-- ============================================================================
-- Los 5 síntomas reportados en fix-145-m se redujeron, tras reproducir contra
-- Supabase local (Docker), a 4 causas raíz reales dentro de log_change() /
-- audit_resolve_display_value() / audit_humanize_column():
--
-- 1. SEARCH_PATH: log_change() y audit_resolve_display_value() no declaran
--    `SET search_path` (regresión de fix-097-m/20260801120000, que sí lo tenía
--    en la versión original de 20260323100000). recalculate_enrollment_balance()
--    (trigger AFTER en `payments`, 20260301000008) SÍ declara `SET search_path = ''`.
--    Cuando ese trigger hace `UPDATE enrollments`, dispara log_change() sobre
--    `enrollments` ANIDADO dentro de su propia ejecución — y hereda el
--    search_path='' del caller (el `SET` de una función solo protege durante SU
--    ejecución, no la de quien la llama). Cualquier tabla sin calificar dentro
--    de log_change()/audit_resolve_display_value() rompe. Reproducido:
--    `confirm_enrollment_with_payment()` → INSERT payments → trg_update_balance
--    → recalculate_enrollment_balance() → UPDATE enrollments → log_change()
--    anidado → `WARNING: audit_log error: relation "students" does not exist"`
--    (la entrada de auditoría del recálculo de saldo se pierde en silencio).
--    Fix: agregar `SET search_path = public, pg_temp` a ambas funciones — el
--    `SET` de cada función crea su propio contexto de search_path para esa
--    invocación puntual, sin importar qué search_path tenía el caller.
--
-- 2. FK sin humanizar: `theory_cycle_id` (enrollments → class_b_theory_cycles,
--    agregado en 20260630000000/Spec 0001) nunca se agregó al diccionario de
--    audit_humanize_column() ni a audit_resolve_display_value() — el diff
--    mostraba "Theory Cycle Id: Sin asignar -> 1" (nombre en inglés + ID crudo).
--    Reproducido en el UPDATE de enrollments que dispara assign_theory_cycle().
--
-- 3. Ruido de columnas técnicas: `users.supabase_uid` y las columnas de
--    storage `*_url` de `enrollments` (`license_initial_url`, `license_full_url`,
--    `license_pdf_url`, `certificate_b_pdf_url`, `certificate_professional_pdf_url`)
--    generaban entradas visibles sin valor para el usuario — faltaban en
--    v_skip_fields.
--
-- 4. Dos bugs reales y confirmados en la rama de `payments` de log_change():
--    a) Usaba `v_src->>'amount'` y `v_src->>'method'`, pero la tabla `payments`
--       NUNCA tuvo esas columnas — tiene `total_amount` + `cash_amount` /
--       `transfer_amount` / `card_amount` / `voucher_amount` (sin columna
--       'method' unificada). Por eso SIEMPRE mostraba "$0 (Desconocido)",
--       para cualquier pago, no solo en el camino de refuerzo. Mismo patrón
--       de derivación que ya usa `admin-alumno-detalle.facade.ts` en el
--       frontend (`derivePaymentMethod()`).
--    b) "Matrícula ?": en confirm_enrollment_with_payment() (20260618130000),
--       el INSERT de `payments` (paso 5) ocurre ANTES del UPDATE que asigna
--       `enrollments.number` (paso 7) — por diseño (fix-057-m/H-024: el guard
--       `check_payment_within_pending_balance()` depende de que
--       `pending_balance` siga NULL en ese momento; reordenar rompería esa
--       protección, ver 20260723010000). O sea: `e.number` SIEMPRE es NULL
--       cuando se audita el pago de confirmación de una matrícula. Fix
--       acotado a `log_change()` (sin tocar el RPC): usar
--       `COALESCE(e.number, c.name)` (nombre del curso) en vez de mostrar '?'
--       — se descartó usar `e.id` (el PK interno de Supabase) por no ser un
--       identificador legible para quien lee el feed.
--
-- 5. `class_b_theory_sessions`: las 6 clases que auto-genera
--    `ensure_theory_cycle()` (Spec 0001, 20260630000000) al crear un ciclo
--    nuevo solo setean `cycle_id`/`class_number`/`class_date` — NUNCA
--    `topic`/`scheduled_at` (columnas del modelo viejo de sesión Zoom
--    individual, pre-Spec 0001). El entity_label de log_change() para esta
--    tabla seguía escrito 100% contra el modelo viejo
--    (`COALESCE(topic,'Sesión teórica') || ' - ' || COALESCE(scheduled_at,'')`)
--    → siempre "Sesión teórica -" vacío para las clases auto-generadas, en
--    CUALQUIER ciclo (no específico de refuerzo). Fix: fallback a
--    `class_number`/`class_date` cuando topic/scheduled_at vienen NULL.
--
-- Todos los 5 síntomas reproducidos y verificados contra Supabase local
-- (Docker) antes de escribir este fix — ver fix.md → Test de Regresión.
-- ============================================================================

-- ── 1. audit_humanize_column(): agregar theory_cycle_id ─────────────────────
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
  'fix-102-m + fix-112-m + fix-145-m: traduce nombres de columna de audit_log.detail a español legible. Diccionario de ~90 columnas conocidas + fallback genérico (Title Case) para columnas futuras no listadas. fix-145-m agrega theory_cycle_id -> Ciclo teórico.';

-- ── 2. audit_resolve_display_value(): search_path + resolver theory_cycle_id ─
CREATE OR REPLACE FUNCTION public.audit_resolve_display_value(p_column TEXT, p_value TEXT)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
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

    -- fix-145-m: theory_cycle_id (enrollments -> class_b_theory_cycles, Spec 0001).
    -- La tabla no tiene nombre/código propio — se identifica por su rango de fechas.
    WHEN p_column = 'theory_cycle_id' THEN
      SELECT 'Ciclo ' || to_char(start_date, 'DD-MM-YYYY') || ' al ' || to_char(end_date, 'DD-MM-YYYY')
      INTO v_result
      FROM class_b_theory_cycles WHERE id = p_value::INT;

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
  'fix-104-m + fix-112-m + fix-145-m: además de resolver IDs de FK/enum conocidos y booleanos/enums, formatea fechas/horas ISO crudas (audit_format_timestamp_value), resume evaluation_checklist en "N de M ítems marcados" y resuelve theory_cycle_id contra class_b_theory_cycles ("Ciclo DD-MM-YYYY al DD-MM-YYYY"). fix-145-m agrega SET search_path = public, pg_temp: sin esto, cuando log_change() corre anidado dentro de recalculate_enrollment_balance() (SET search_path=''), las tablas sin calificar (courses, branches, instructors, etc.) no resuelven — devuelve NULL, el caller usa el ID crudo. Devuelve NULL si nada aplica — el caller conserva el valor crudo.';

-- ── 3. log_change(): search_path + payments (columnas reales + matrícula) +
--       class_b_theory_sessions (fallback class_number/class_date) + silenciar
--       supabase_uid y *_url de storage ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.log_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
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
  v_skip_fields TEXT[] := ARRAY[
    'created_at', 'updated_at', 'password_hash',
    -- fix-145-m: columnas técnicas/de storage sin valor para el usuario en el feed —
    -- siguen auditándose a nivel de fila (INSERT/UPDATE/DELETE completo), solo se
    -- excluyen del diff línea-por-línea de UPDATE.
    'supabase_uid', 'license_initial_url', 'license_full_url', 'license_pdf_url',
    'certificate_b_pdf_url', 'certificate_professional_pdf_url'
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
    SELECT e.branch_id, u.first_names || ' ' || u.paternal_last_name,
           COALESCE(e.number, c.name)
    INTO v_branch_id, v_temp_text, v_temp_text2
    FROM enrollments e
    JOIN students s ON s.id = e.student_id
    JOIN users u ON u.id = s.user_id
    JOIN courses c ON c.id = e.course_id
    WHERE e.id = (v_src->>'enrollment_id')::INT;

    -- fix-145-m: payments NUNCA tuvo columnas 'amount' ni 'method' — tiene
    -- total_amount + cash_amount/transfer_amount/card_amount/voucher_amount
    -- (sin columna de método unificada). Mismo criterio de derivación que
    -- admin-alumno-detalle.facade.ts::derivePaymentMethod() en el frontend.
    -- 'Matrícula ?': confirm_enrollment_with_payment() inserta el pago ANTES
    -- de asignar enrollments.number (por diseño, ver fix-057-m/H-024) — e.number
    -- viene NULL en ese momento. e.id (el PK interno de Supabase) no significa
    -- nada para quien lee el feed, así que se usa el nombre del curso como
    -- identificador legible en su lugar mientras el número no existe todavía.
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
  'Trigger de auditoría (fix-108-m + fix-112-m + fix-145-m): fix-145-m agrega SET search_path = public, pg_temp (sin esto, al correr anidado dentro de recalculate_enrollment_balance() que sí tiene SET search_path='''', cualquier tabla sin calificar -students, enrollments, etc.- rompía con "relation X does not exist" y esa entrada de auditoría se perdía en silencio); corrige la rama de payments para usar las columnas reales (total_amount + cash/transfer/card/voucher_amount, no amount/method que nunca existieron) y evitar "Matrícula ?" cuando enrollments.number aún no se asigna (confirm_enrollment_with_payment inserta el pago antes de activar la matrícula, por diseño); agrega fallback class_number/class_date en class_b_theory_sessions para las clases que ensure_theory_cycle() auto-genera sin topic/scheduled_at; silencia supabase_uid y las columnas *_url de storage de enrollments en el diff de UPDATE. Resto del cuerpo sin cambios respecto a fix-112-m (20260805090000).';

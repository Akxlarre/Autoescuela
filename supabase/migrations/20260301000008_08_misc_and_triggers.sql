-- ============================================================================
-- 08 — Certificados, Notificaciones, Biometría, Disciplina, Triggers y Vistas
-- ============================================================================
-- Depende de: TODOS los archivos anteriores (01-07)
-- Este archivo cierra el esquema con las tablas restantes y toda la lógica
-- de triggers, funciones y vistas.
-- ============================================================================


-- ############################################################################
-- PARTE A: TABLAS RESTANTES
-- ############################################################################

-- ============================================================================
-- CERTIFICATE_BATCHES — Lotes de folios Casa de Moneda (RF-112)
-- ============================================================================
CREATE TABLE IF NOT EXISTS certificate_batches (
  id              SERIAL PRIMARY KEY,
  batch_code      TEXT    UNIQUE NOT NULL,   -- "2026-01"
  folio_from      INTEGER NOT NULL,
  folio_to        INTEGER NOT NULL,
  available_folios INTEGER,
  branch_id       INT    REFERENCES branches(id),
  received_date   DATE,
  received_by     INT    REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE certificate_batches IS 'Lotes de folios Casa de Moneda: rango y disponibilidad (RF-112)';

-- ============================================================================
-- CERTIFICATES — Certificados emitidos (RF-075, RF-076)
-- ============================================================================
CREATE TABLE IF NOT EXISTS certificates (
  id            SERIAL PRIMARY KEY,
  folio         INTEGER UNIQUE NOT NULL,
  batch_id      INT    REFERENCES certificate_batches(id),
  enrollment_id INT    REFERENCES enrollments(id),
  student_id    INT    REFERENCES students(id),
  type          TEXT,                        -- 'class_b' | 'professional'
  status        TEXT,                        -- 'available' | 'issued' | 'cancelled'
  qr_url        TEXT,                        -- RF-075: QR de verificación
  issued_date   DATE,
  issued_by     INT    REFERENCES users(id),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE certificates IS 'Certificados emitidos con folio único, QR y link a lote Casa de Moneda (RF-075, RF-076)';

-- Agregar FK de standalone_course_enrollments a certificates
ALTER TABLE standalone_course_enrollments
  ADD CONSTRAINT fk_standalone_enrollment_certificate
  FOREIGN KEY (certificate_id) REFERENCES certificates(id);

-- ============================================================================
-- CERTIFICATE_ISSUANCE_LOG — Historial de descargas/envíos (RF-096)
-- ============================================================================
CREATE TABLE IF NOT EXISTS certificate_issuance_log (
  id              SERIAL PRIMARY KEY,
  certificate_id  INT    NOT NULL REFERENCES certificates(id),
  action          TEXT,                      -- 'downloaded' | 'email_sent' | 'printed'
  user_id         INT    REFERENCES users(id),
  ip              TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE certificate_issuance_log IS 'Historial de descargas, envíos e impresiones de certificados (RF-096)';

-- ============================================================================
-- NOTIFICATIONS — Mensajes individuales y masivos (RF-019, RF-020)
-- ============================================================================
CREATE TABLE IF NOT EXISTS notifications (
  id              SERIAL PRIMARY KEY,
  recipient_id    INT    REFERENCES users(id),
  type            TEXT,                      -- 'email' | 'whatsapp' | 'system'
  subject         TEXT,
  message         TEXT   NOT NULL,
  read            BOOLEAN DEFAULT false,
  sent_at         TIMESTAMPTZ,
  sent_ok         BOOLEAN DEFAULT false,
  send_error      TEXT,
  reference_type  TEXT,                      -- 'class_b' | 'professional_session' | 'document_expiry' | 'payment' | etc.
  reference_id    INT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE notifications IS 'Notificaciones individuales y masivas: email, WhatsApp, sistema (RF-019, RF-020)';

-- ============================================================================
-- NOTIFICATION_TEMPLATES — Plantillas de notificación (RF-016, RF-017)
-- ============================================================================
CREATE TABLE IF NOT EXISTS notification_templates (
  id          SERIAL PRIMARY KEY,
  name        TEXT   NOT NULL,
  type        TEXT,                          -- 'email' | 'whatsapp' | 'system'
  subject     TEXT,
  body        TEXT   NOT NULL,
  active      BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE notification_templates IS 'Plantillas automáticas: Zoom, cobros, alertas (RF-016, RF-017)';

-- ============================================================================
-- ALERT_CONFIG — Configuración de alertas (RF-024)
-- ============================================================================
CREATE TABLE IF NOT EXISTS alert_config (
  id            SERIAL PRIMARY KEY,
  alert_type    TEXT     NOT NULL,           -- 'technical_inspection' | 'soap' | 'insurance' | 'installment_charge'
  advance_days  SMALLINT NOT NULL,           -- RF-024
  active        BOOLEAN  DEFAULT true,
  branch_id     INT      REFERENCES branches(id)  -- NULL = global
);

COMMENT ON TABLE alert_config IS 'Días de anticipación configurables por tipo de alerta (RF-024)';

-- ============================================================================
-- DISCIPLINARY_NOTES — Notas disciplinarias del alumno (RF-109)
-- ============================================================================
CREATE TABLE IF NOT EXISTS disciplinary_notes (
  id            SERIAL PRIMARY KEY,
  student_id    INT    NOT NULL REFERENCES students(id),
  description   TEXT   NOT NULL,
  date          DATE   NOT NULL,
  recorded_by   INT    REFERENCES users(id),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE disciplinary_notes IS 'Notas disciplinarias asociadas al perfil del alumno (RF-109)';

-- ============================================================================
-- BIOMETRIC_RECORDS — Entrada/salida por huella o facial (RF-126)
-- ============================================================================
CREATE TABLE IF NOT EXISTS biometric_records (
  id                        SERIAL PRIMARY KEY,
  student_id                INT    NOT NULL REFERENCES students(id),
  class_b_session_id        INT    REFERENCES class_b_sessions(id),
  professional_session_id   INT    REFERENCES professional_practice_sessions(id),
  event_type                TEXT,            -- 'entry' | 'exit'
  method                    TEXT,            -- 'fingerprint' | 'facial'
  gps                       POINT,
  timestamp                 TIMESTAMPTZ NOT NULL,
  created_at                TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE biometric_records IS 'Registro biométrico de entrada/salida por huella o facial (RF-126)';

-- Constraint: exactamente uno de class_b o professional
ALTER TABLE biometric_records ADD CONSTRAINT chk_biometric_context
  CHECK (
    (class_b_session_id IS NOT NULL AND professional_session_id IS NULL) OR
    (class_b_session_id IS NULL AND professional_session_id IS NOT NULL)
  );

-- ============================================================================
-- ÍNDICE — Notificaciones no leídas
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_unread_notifications
  ON notifications(recipient_id)
  WHERE read = false;


-- ############################################################################
-- PARTE B: FUNCIONES Y TRIGGERS
-- ############################################################################

-- ============================================================================
-- T1: Recalcular pending_balance en enrollments al insertar/actualizar payments
-- ============================================================================
CREATE OR REPLACE FUNCTION recalculate_enrollment_balance()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.enrollments
  SET total_paid = COALESCE((
        SELECT SUM(total_amount) FROM public.payments
        WHERE enrollment_id = NEW.enrollment_id AND status = 'paid'
      ), 0),
      pending_balance = base_price - discount - COALESCE((
        SELECT SUM(total_amount) FROM public.payments
        WHERE enrollment_id = NEW.enrollment_id AND status = 'paid'
      ), 0),
      payment_status = CASE
        WHEN base_price - discount <= COALESCE((
          SELECT SUM(total_amount) FROM public.payments
          WHERE enrollment_id = NEW.enrollment_id AND status = 'paid'
        ), 0) THEN 'paid_full'
        WHEN COALESCE((
          SELECT SUM(total_amount) FROM public.payments
          WHERE enrollment_id = NEW.enrollment_id AND status = 'paid'
        ), 0) > 0 THEN 'partial'
        ELSE 'pending'
      END,
      updated_at = NOW()
  WHERE id = NEW.enrollment_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';

CREATE TRIGGER trg_update_balance
  AFTER INSERT OR UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION recalculate_enrollment_balance();

-- ============================================================================
-- T2: Estado automático de vehicle_documents según expiry_date
-- ============================================================================
CREATE OR REPLACE FUNCTION calculate_vehicle_document_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.expiry_date < CURRENT_DATE THEN
    NEW.status := 'expired';
  ELSIF NEW.expiry_date <= CURRENT_DATE + INTERVAL '30 days' THEN
    NEW.status := 'expiring_soon';
  ELSE
    NEW.status := 'valid';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';

CREATE TRIGGER trg_vehicle_doc_status
  BEFORE INSERT OR UPDATE ON vehicle_documents
  FOR EACH ROW EXECUTE FUNCTION calculate_vehicle_document_status();

-- ============================================================================
-- T3: Log de auditoría automático en entidades críticas (RF-009)
-- ============================================================================
CREATE OR REPLACE FUNCTION log_change()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.audit_log (action, entity, entity_id, detail, created_at)
  VALUES (
    TG_OP,
    TG_TABLE_NAME,
    CASE
      WHEN TG_OP = 'DELETE' THEN OLD.id
      ELSE NEW.id
    END,
    CASE
      WHEN TG_OP = 'INSERT' THEN 'Registro creado'
      WHEN TG_OP = 'UPDATE' THEN 'Registro actualizado'
      WHEN TG_OP = 'DELETE' THEN 'Registro eliminado'
    END,
    NOW()
  );
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$ LANGUAGE plpgsql SET search_path = '';

-- Aplicar T3 a entidades críticas
CREATE TRIGGER trg_audit_enrollments
  AFTER INSERT OR UPDATE OR DELETE ON enrollments
  FOR EACH ROW EXECUTE FUNCTION log_change();

CREATE TRIGGER trg_audit_payments
  AFTER INSERT OR UPDATE OR DELETE ON payments
  FOR EACH ROW EXECUTE FUNCTION log_change();

CREATE TRIGGER trg_audit_users
  AFTER INSERT OR UPDATE OR DELETE ON users
  FOR EACH ROW EXECUTE FUNCTION log_change();

CREATE TRIGGER trg_audit_class_b_sessions
  AFTER INSERT OR UPDATE OR DELETE ON class_b_sessions
  FOR EACH ROW EXECUTE FUNCTION log_change();

CREATE TRIGGER trg_audit_class_b_theory_sessions
  AFTER INSERT OR UPDATE OR DELETE ON class_b_theory_sessions
  FOR EACH ROW EXECUTE FUNCTION log_change();

CREATE TRIGGER trg_audit_promotion_courses
  AFTER INSERT OR UPDATE OR DELETE ON promotion_courses
  FOR EACH ROW EXECUTE FUNCTION log_change();

CREATE TRIGGER trg_audit_professional_theory_sessions
  AFTER INSERT OR UPDATE OR DELETE ON professional_theory_sessions
  FOR EACH ROW EXECUTE FUNCTION log_change();

CREATE TRIGGER trg_audit_professional_practice_sessions
  AFTER INSERT OR UPDATE OR DELETE ON professional_practice_sessions
  FOR EACH ROW EXECUTE FUNCTION log_change();

CREATE TRIGGER trg_audit_professional_module_grades
  AFTER INSERT OR UPDATE OR DELETE ON professional_module_grades
  FOR EACH ROW EXECUTE FUNCTION log_change();

CREATE TRIGGER trg_audit_class_book
  AFTER INSERT OR UPDATE OR DELETE ON class_book
  FOR EACH ROW EXECUTE FUNCTION log_change();

-- ============================================================================
-- T4: Alerta cuando license_expiry del instructor ≤ 30 días
-- ============================================================================
CREATE OR REPLACE FUNCTION generate_license_alert()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.license_expiry <= CURRENT_DATE + INTERVAL '30 days' THEN
    NEW.license_status := 'expiring_soon';
  END IF;
  IF NEW.license_expiry < CURRENT_DATE THEN
    NEW.license_status := 'expired';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';

CREATE TRIGGER trg_license_alert
  BEFORE UPDATE OF license_expiry ON instructors
  FOR EACH ROW EXECUTE FUNCTION generate_license_alert();

-- ============================================================================
-- T5: Decrementar available_folios al emitir certificado
-- ============================================================================
CREATE OR REPLACE FUNCTION decrement_batch_folio()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.batch_id IS NOT NULL AND NEW.status = 'issued' THEN
    -- Verificar que el folio está dentro del rango del lote
    IF NOT EXISTS (
      SELECT 1 FROM public.certificate_batches
      WHERE id = NEW.batch_id
        AND NEW.folio BETWEEN folio_from AND folio_to
        AND available_folios > 0
    ) THEN
      RAISE EXCEPTION 'Folio % fuera de rango o sin folios disponibles en lote %', NEW.folio, NEW.batch_id;
    END IF;

    UPDATE public.certificate_batches
    SET available_folios = available_folios - 1
    WHERE id = NEW.batch_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';

CREATE TRIGGER trg_batch_folios
  AFTER INSERT ON certificates
  FOR EACH ROW EXECUTE FUNCTION decrement_batch_folio();

-- ============================================================================
-- T6a: Detectar 2 inasistencias prácticas consecutivas → deserción Clase B (RF-053)
-- ============================================================================
CREATE OR REPLACE FUNCTION verify_class_b_dropout_rule()
RETURNS TRIGGER AS $$
DECLARE
  v_consecutive INT;
BEGIN
  IF NEW.status IN ('absent', 'no_show') THEN
    -- Contar inasistencias consecutivas más recientes
    SELECT COUNT(*) INTO v_consecutive
    FROM (
      SELECT status FROM public.class_b_practice_attendance
      WHERE student_id = NEW.student_id
      ORDER BY recorded_at DESC
      LIMIT 2
    ) recent
    WHERE status IN ('absent', 'no_show');

    -- Actualizar el contador
    UPDATE public.class_b_practice_attendance
    SET consecutive_absences = v_consecutive
    WHERE id = NEW.id;

    -- Si 2 consecutivas, marcar como deserción (cancelar matrícula)
    IF v_consecutive >= 2 THEN
      UPDATE public.enrollments
      SET status = 'cancelled', updated_at = NOW()
      WHERE id = (
        SELECT enrollment_id FROM public.class_b_sessions WHERE id = NEW.class_b_session_id
      );
    END IF;
  ELSE
    -- Si asistió, resetear el contador
    UPDATE public.class_b_practice_attendance
    SET consecutive_absences = 0
    WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';

CREATE TRIGGER trg_class_b_dropout
  AFTER INSERT OR UPDATE ON class_b_practice_attendance
  FOR EACH ROW EXECUTE FUNCTION verify_class_b_dropout_rule();

-- ============================================================================
-- T6b: Detectar inasistencias en Profesional → semáforo (RF-070)
-- ============================================================================
CREATE OR REPLACE FUNCTION update_professional_attendance_flag()
RETURNS TRIGGER AS $$
BEGIN
  -- La lógica del semáforo se calcula en la vista v_professional_attendance.
  -- Este trigger puede usarse para generar notificaciones de alerta.
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';

CREATE TRIGGER trg_professional_attendance_flag
  AFTER INSERT OR UPDATE ON professional_theory_attendance
  FOR EACH ROW EXECUTE FUNCTION update_professional_attendance_flag();

CREATE TRIGGER trg_professional_practice_flag
  AFTER INSERT OR UPDATE ON professional_practice_attendance
  FOR EACH ROW EXECUTE FUNCTION update_professional_attendance_flag();

-- ============================================================================
-- T7: Gatillo RF-082.4: clase #12 completada + asistencia teórica 100%
--     → enrollments.certificate_enabled = true
-- ============================================================================
CREATE OR REPLACE FUNCTION verify_class_b_certificate_enablement()
RETURNS TRIGGER AS $$
DECLARE
  v_enrollment_id INT;
  v_student_id INT;
  v_branch_id INT;
  v_total_theory INT;
  v_attended INT;
BEGIN
  v_enrollment_id := NEW.enrollment_id;

  -- Obtener datos del alumno y sede
  SELECT e.branch_id, e.student_id
  INTO v_branch_id, v_student_id
  FROM public.enrollments e WHERE e.id = v_enrollment_id;

  -- Contar sesiones teóricas totales de la sede
  SELECT COUNT(*) INTO v_total_theory
  FROM public.class_b_theory_sessions
  WHERE branch_id = v_branch_id AND status = 'completed';

  -- Contar asistencias del alumno
  SELECT COUNT(*) INTO v_attended
  FROM public.class_b_theory_attendance cta
  JOIN public.class_b_theory_sessions cts ON cts.id = cta.theory_session_b_id
  WHERE cta.student_id = v_student_id
    AND cta.status = 'present'
    AND cts.branch_id = v_branch_id;

  -- Si 100% asistencia teórica y clase #12 completada → habilitar certificado
  IF v_total_theory > 0 AND v_attended >= v_total_theory THEN
    UPDATE public.enrollments
    SET certificate_enabled = true, updated_at = NOW()
    WHERE id = v_enrollment_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';

CREATE TRIGGER trg_enable_certificate_b
  AFTER UPDATE OF status ON class_b_sessions
  FOR EACH ROW WHEN (NEW.status = 'completed' AND NEW.class_number = 12)
  EXECUTE FUNCTION verify_class_b_certificate_enablement();

-- ============================================================================
-- T8: Gatillo RF-093 Profesional: certificado habilitado si cumple todo
-- ============================================================================
CREATE OR REPLACE FUNCTION verify_professional_certificate_enablement()
RETURNS TRIGGER AS $$
DECLARE
  v_pending INTEGER;
BEGIN
  IF NEW.result = 'approved' AND NEW.final_grade >= 4.0 THEN
    -- Verificar saldo pagado
    SELECT pending_balance INTO v_pending
    FROM public.enrollments WHERE id = NEW.enrollment_id;

    IF COALESCE(v_pending, 0) <= 0 THEN
      UPDATE public.enrollments
      SET certificate_enabled = true, updated_at = NOW()
      WHERE id = NEW.enrollment_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';

CREATE TRIGGER trg_enable_certificate_prof
  AFTER INSERT OR UPDATE ON professional_final_records
  FOR EACH ROW EXECUTE FUNCTION verify_professional_certificate_enablement();

-- ============================================================================
-- T9: Generar sesiones automáticamente desde plantilla de horario
-- ============================================================================
CREATE OR REPLACE FUNCTION generate_sessions_from_template()
RETURNS TRIGGER AS $$
DECLARE
  v_start_date DATE;
  v_block RECORD;
  v_real_date DATE;
BEGIN
  -- Obtener fecha de inicio de la promoción
  SELECT start_date INTO v_start_date
  FROM public.professional_promotions
  WHERE id = (SELECT promotion_id FROM public.promotion_courses WHERE id = NEW.id);

  -- Iterar sobre los bloques de la plantilla
  FOR v_block IN
    SELECT * FROM public.template_blocks WHERE template_id = NEW.template_id
  LOOP
    -- Calcular fecha real: start_date + (week_number-1)*7 + (day_of_week-1)
    v_real_date := v_start_date + ((v_block.week_number - 1) * 7 + (v_block.day_of_week - 1));

    IF v_block.type = 'theory' THEN
      INSERT INTO public.professional_theory_sessions
        (promotion_course_id, date, start_time, end_time, status, created_at)
      VALUES
        (NEW.id, v_real_date, v_block.start_time, v_block.end_time, 'scheduled', NOW());
    ELSIF v_block.type = 'practice' THEN
      INSERT INTO public.professional_practice_sessions
        (promotion_course_id, date, start_time, end_time, status, created_at)
      VALUES
        (NEW.id, v_real_date, v_block.start_time, v_block.end_time, 'scheduled', NOW());
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';

CREATE TRIGGER trg_generate_professional_course_sessions
  AFTER INSERT ON promotion_courses
  FOR EACH ROW WHEN (NEW.template_id IS NOT NULL)
  EXECUTE FUNCTION generate_sessions_from_template();

-- ============================================================================
-- T10: Validaciones de matrícula que requieren JOIN a courses
-- ============================================================================
CREATE OR REPLACE FUNCTION trg_enrollment_validation_fn()
RETURNS TRIGGER AS $$
DECLARE
  v_type TEXT;
BEGIN
  SELECT type INTO v_type FROM public.courses WHERE id = NEW.course_id;

  -- Clase B no puede tener promotion_course_id
  IF v_type = 'class_b' AND NEW.promotion_course_id IS NOT NULL THEN
    RAISE EXCEPTION 'Matrícula Clase B no puede tener promotion_course_id';
  END IF;

  -- Estado draft solo aplica a Clase B
  IF NEW.status = 'draft' AND v_type != 'class_b' THEN
    RAISE EXCEPTION 'Estado draft solo aplica a Clase B';
  END IF;

  -- Profesional debe ser presencial
  IF v_type = 'professional' AND NEW.registration_channel = 'online' THEN
    RAISE EXCEPTION 'Matrícula Profesional debe ser presencial (in_person)';
  END IF;

  -- SENCE debe ser presencial
  IF NEW.sence_code_id IS NOT NULL AND NEW.registration_channel = 'online' THEN
    RAISE EXCEPTION 'Matrícula SENCE debe ser presencial (in_person)';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';

CREATE TRIGGER trg_enrollment_validation
  BEFORE INSERT OR UPDATE ON enrollments
  FOR EACH ROW EXECUTE FUNCTION trg_enrollment_validation_fn();

-- ============================================================================
-- T11: Al transitar promoción a 'finished' → class_book a 'in_review'
-- ============================================================================
CREATE OR REPLACE FUNCTION update_class_book_to_in_review()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.class_book
  SET status = 'in_review',
      closes_at = NEW.end_date + INTERVAL '7 days',
      updated_at = NOW()
  WHERE promotion_course_id IN (
    SELECT id FROM public.promotion_courses WHERE promotion_id = NEW.id
  )
  AND status IN ('draft', 'active');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';

CREATE TRIGGER trg_class_book_lifecycle
  AFTER UPDATE OF status ON professional_promotions
  FOR EACH ROW WHEN (NEW.status = 'finished')
  EXECUTE FUNCTION update_class_book_to_in_review();

-- ============================================================================
-- T12: Validación draft → pending_docs: debe tener al menos 1 sesión agendada
-- ============================================================================
CREATE OR REPLACE FUNCTION trg_draft_to_pending_validation_fn()
RETURNS TRIGGER AS $$
DECLARE
  v_type  TEXT;
  v_count INT;
BEGIN
  -- Solo aplica a la transición draft → pending_docs
  IF OLD.status != 'draft' OR NEW.status != 'pending_docs' THEN
    RETURN NEW;
  END IF;

  SELECT type INTO v_type FROM public.courses WHERE id = NEW.course_id;

  IF v_type = 'class_b' THEN
    SELECT COUNT(*) INTO v_count
    FROM public.class_b_sessions
    WHERE enrollment_id = NEW.id AND status = 'scheduled';

    IF v_count = 0 THEN
      RAISE EXCEPTION 'Clase B: debe asignar al menos un bloque horario antes de avanzar la matrícula';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';

CREATE TRIGGER trg_draft_to_pending_validation
  BEFORE UPDATE OF status ON enrollments
  FOR EACH ROW EXECUTE FUNCTION trg_draft_to_pending_validation_fn();


-- ############################################################################
-- PARTE C: VISTAS
-- ############################################################################

-- ============================================================================
-- Vista: Progreso académico alumno Clase B
-- ============================================================================
CREATE OR REPLACE VIEW v_student_progress_b AS
SELECT
  m.id AS enrollment_id,
  s.id AS student_id,
  COUNT(cb.id) FILTER (WHERE cb.status = 'completed') AS completed_practices,
  ROUND(COUNT(cb.id) FILTER (WHERE cb.status = 'completed') / 12.0 * 100) AS pct_practices,
  ROUND(
    COUNT(at2.id) FILTER (WHERE at2.status = 'present') * 100.0 /
    NULLIF(COUNT(at2.id), 0)
  ) AS pct_theory_attendance,
  MAX(cb.updated_at) AS last_practice_session
FROM enrollments m
JOIN courses c ON c.id = m.course_id
JOIN students s ON s.id = m.student_id
LEFT JOIN class_b_sessions cb ON cb.enrollment_id = m.id
LEFT JOIN class_b_theory_sessions ctb ON ctb.branch_id = m.branch_id
LEFT JOIN class_b_theory_attendance at2 ON at2.theory_session_b_id = ctb.id AND at2.student_id = s.id
WHERE c.type = 'class_b'
GROUP BY m.id, s.id;
ALTER VIEW v_student_progress_b SET (security_invoker = true);

-- ============================================================================
-- Vista: Asistencia Clase Profesional por matrícula — semáforo RF-070
-- ============================================================================
CREATE OR REPLACE VIEW v_professional_attendance AS
SELECT
  m.id AS enrollment_id,
  s.id AS student_id,
  cc.promotion_id,
  cc.course_id,
  ROUND(
    COUNT(pta.id) FILTER (WHERE pta.status = 'present') * 100.0 /
    NULLIF(COUNT(pta.id), 0)
  ) AS pct_theory,
  ROUND(
    COUNT(ppa.id) FILTER (WHERE ppa.status = 'present') * 100.0 /
    NULLIF(COUNT(ppa.id), 0)
  ) AS pct_practice,
  CASE
    WHEN COUNT(pta.id) FILTER (WHERE pta.status = 'present') * 100.0 /
         NULLIF(COUNT(pta.id), 0) >= 75
     AND COUNT(ppa.id) FILTER (WHERE ppa.status = 'present') * 100.0 /
         NULLIF(COUNT(ppa.id), 0) = 100 THEN 'green'
    WHEN COUNT(pta.id) FILTER (WHERE pta.status = 'present') * 100.0 /
         NULLIF(COUNT(pta.id), 0) >= 60 THEN 'yellow'
    ELSE 'red'
  END AS attendance_flag
FROM enrollments m
JOIN courses c ON c.id = m.course_id
JOIN students s ON s.id = m.student_id
JOIN promotion_courses cc ON cc.id = m.promotion_course_id
LEFT JOIN professional_theory_sessions pts ON pts.promotion_course_id = m.promotion_course_id
LEFT JOIN professional_theory_attendance pta
  ON pta.theory_session_prof_id = pts.id AND pta.student_id = s.id
LEFT JOIN professional_practice_sessions pps ON pps.promotion_course_id = m.promotion_course_id
LEFT JOIN professional_practice_attendance ppa
  ON ppa.session_id = pps.id AND ppa.student_id = s.id
WHERE c.type = 'professional'
  AND m.promotion_course_id IS NOT NULL
GROUP BY m.id, s.id, cc.promotion_id, cc.course_id;
ALTER VIEW v_professional_attendance SET (security_invoker = true);

-- ============================================================================
-- Vista: DMS — Documentos del alumno unificados (student_documents + digital_contracts)
-- ============================================================================
CREATE OR REPLACE VIEW v_dms_student_documents AS
  SELECT
    sd.id::TEXT          AS id,
    'student_document'   AS source,
    e.student_id,
    sd.enrollment_id,
    sd.type,
    sd.file_name,
    sd.storage_url       AS file_url,
    sd.status,
    sd.uploaded_at       AS document_at,
    sd.reviewed_by       AS managed_by
  FROM student_documents sd
  JOIN enrollments e ON e.id = sd.enrollment_id

UNION ALL

  SELECT
    dc.id::TEXT          AS id,
    'digital_contract'   AS source,
    dc.student_id,
    dc.enrollment_id,
    'contract'           AS type,
    dc.file_name,
    dc.file_url,
    CASE WHEN dc.file_url IS NOT NULL THEN 'approved' ELSE 'pending' END AS status,
    dc.accepted_at       AS document_at,
    NULL::INT            AS managed_by
  FROM digital_contracts dc
  WHERE dc.file_url IS NOT NULL;
ALTER VIEW v_dms_student_documents SET (security_invoker = true);

-- ============================================================================
-- Vista: Disponibilidad horaria Clase B (triple match instructor + vehículo)
-- ============================================================================
CREATE OR REPLACE VIEW v_class_b_schedule_availability AS
SELECT
  i.id AS instructor_id,
  v.id AS vehicle_id,
  generate_series(
    CURRENT_DATE::TIMESTAMPTZ,
    (CURRENT_DATE + INTERVAL '14 days')::TIMESTAMPTZ,
    '1 hour'
  ) AS slot
FROM instructors i
JOIN users u ON u.id = i.user_id
CROSS JOIN vehicles v
WHERE u.branch_id = v.branch_id
  AND NOT EXISTS (
    SELECT 1 FROM class_b_sessions cb
    JOIN enrollments m ON m.id = cb.enrollment_id
    WHERE cb.instructor_id = i.id
      AND cb.vehicle_id = v.id
      AND cb.status NOT IN ('cancelled')
      AND (m.status != 'draft' OR m.expires_at > NOW())
  );
ALTER VIEW v_class_b_schedule_availability SET (security_invoker = true);


-- ############################################################################
-- FIN DEL ESQUEMA
-- ############################################################################
-- Orden de ejecución recomendado:
--   01_users_and_branches.sql
--   02_enrollments_and_courses.sql
--   03_academy_class_b.sql
--   04_academy_professional.sql
--   05_payments_and_finances.sql
--   06_documents_and_dms.sql
--   07_vehicles_and_fleet.sql
--   08_misc_and_triggers.sql   ← este archivo
-- ############################################################################

-- ============================================================================
-- 09 — Activar Row Level Security (RLS) en todas las tablas
-- ============================================================================
-- Ejecutar DESPUÉS de todos los archivos anteriores (01-08).
-- Este archivo SOLO habilita RLS. Las políticas (POLICY) se definen aparte.
-- Sin políticas definidas, RLS bloqueará todo acceso por defecto (deny-all).
-- ============================================================================

-- Módulo 1 — Usuarios, Roles y Sedes
ALTER TABLE branches                        ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles                           ENABLE ROW LEVEL SECURITY;
ALTER TABLE users                           ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_attempts                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE students                        ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses                         ENABLE ROW LEVEL SECURITY;
ALTER TABLE sence_codes                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_schedules                ENABLE ROW LEVEL SECURITY;
ALTER TABLE secretary_observations          ENABLE ROW LEVEL SECURITY;

-- Módulo 2 — Matrículas y Descuentos
ALTER TABLE discounts                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE professional_pre_registrations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE discount_applications           ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_seasons                 ENABLE ROW LEVEL SECURITY;

-- Módulo 3 — Gestión Académica Clase B
ALTER TABLE instructors                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_assignments             ENABLE ROW LEVEL SECURITY;
ALTER TABLE instructor_replacements         ENABLE ROW LEVEL SECURITY;
ALTER TABLE instructor_monthly_hours        ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_b_sessions                ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_b_theory_sessions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_b_theory_attendance       ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_b_practice_attendance     ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_b_exam_scores             ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_b_exam_catalog            ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_b_exam_questions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_b_exam_attempts           ENABLE ROW LEVEL SECURITY;

-- Módulo 4 — Gestión Académica Profesional
ALTER TABLE lecturers                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE lecturer_monthly_hours          ENABLE ROW LEVEL SECURITY;
ALTER TABLE professional_promotions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE professional_schedule_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_blocks                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotion_courses               ENABLE ROW LEVEL SECURITY;
ALTER TABLE professional_theory_sessions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE professional_practice_sessions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE absence_evidence                ENABLE ROW LEVEL SECURITY;
ALTER TABLE professional_theory_attendance  ENABLE ROW LEVEL SECURITY;
ALTER TABLE professional_practice_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE professional_module_grades      ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_machinery               ENABLE ROW LEVEL SECURITY;
ALTER TABLE license_validations             ENABLE ROW LEVEL SECURITY;
ALTER TABLE professional_final_records      ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_book                      ENABLE ROW LEVEL SECURITY;

-- Módulo 5 — Pagos y Finanzas
ALTER TABLE sii_receipts                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments                        ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_denominations           ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses                        ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_closings                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE instructor_advances             ENABLE ROW LEVEL SECURITY;
ALTER TABLE instructor_monthly_payments     ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_catalog                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE special_service_sales           ENABLE ROW LEVEL SECURITY;
ALTER TABLE standalone_courses              ENABLE ROW LEVEL SECURITY;
ALTER TABLE standalone_course_enrollments   ENABLE ROW LEVEL SECURITY;

-- Módulo 6 — Documentos y DMS
ALTER TABLE student_documents               ENABLE ROW LEVEL SECURITY;
ALTER TABLE digital_contracts               ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_documents                ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_templates              ENABLE ROW LEVEL SECURITY;

-- Módulo 7 — Flota y Vehículos
ALTER TABLE vehicles                        ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_documents               ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_records             ENABLE ROW LEVEL SECURITY;
ALTER TABLE route_incidents                 ENABLE ROW LEVEL SECURITY;

-- Módulo 8 — Certificados, Notificaciones, Biometría, Disciplina
ALTER TABLE certificate_batches             ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificates                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificate_issuance_log        ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_templates          ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_config                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE disciplinary_notes              ENABLE ROW LEVEL SECURITY;
ALTER TABLE biometric_records               ENABLE ROW LEVEL SECURITY;

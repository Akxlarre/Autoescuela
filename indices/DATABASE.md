# Registro de Base de Datos (Supabase)

> **Regla de Actualización (OBLIGATORIA):** El Agente DEBE usar sus herramientas de escritura de archivos para definir nuevas tablas en la lista de abajo cada vez que genere migraciones en `supabase/migrations/`. La documentación del RLS y FDs debe ser estricta.

| Tabla / Colección | Core / Dominio | Columnas Clave | Relaciones (FKs) | Restricciones RLS (Policies) | Estado |
|-------------------|----------------|----------------|------------------|------------------------------|--------|
| `profiles` | Auth | `id`, `household_id` | N/A (id vinculada a `auth.users`) | `SELECT` public, `UPDATE` own id | ✅ Estable |
| `branches` | M1 - Usuarios | `id`, `slug` | Ninguna | Admin: CRUD, Sec: R, Inst: R, Stu: R | ✅ Definida |
| `roles` | M1 - Usuarios | `id`, `name` | Ninguna | Admin: CRUD, Sec: R, Inst: R, Stu: R | ✅ Definida |
| `users` | M1 - Usuarios | `id`, `rut`, `email` | `role_id`, `branch_id` | Admin: CRUD, Sec: R, Inst: R (self), Stu: R (self) | ✅ Definida |
| `students` | M1 - Usuarios | `id`, `user_id` | `user_id` | Admin: CRUD, Sec: CRUD, Inst: R, Stu: R (self) | ✅ Definida |
| `courses` | M1 - Usuarios | `id`, `code` | `branch_id` | Admin: CRUD, Sec: R, Inst: R, Stu: R | ✅ Definida |
| `sence_codes` | M1 - Usuarios | `id`, `code` | `course_id` | Admin: CRUD, Sec: R, Inst: R, Stu: R | ✅ Definida |
| `audit_log` | M1 - Usuarios | `id`, `user_id` | `user_id` | Admin: R · INSERT: autenticados (solo vía triggers) | ✅ Definida |
| `login_attempts` | M1 - Usuarios | `id`, `email` | `user_id` | Admin: R | ✅ Definida |
| `notifications` | M2 - Notif. | `id`, `recipient_id` | `recipient_id` | Admin: CRUD, Sec: CRUD, Inst: R (self), Stu: R (self) | ✅ Definida |
| `notification_templates` | M2 - Notif. | `id`, `name` | Ninguna | Admin: CRUD, Sec: R, Inst: R | ✅ Definida |
| `alert_config` | M2 - Notif. | `id`, `alert_type` | `branch_id` | Admin: CRUD, Sec: R | ✅ Definida |
| `payments` | M3 - Finanzas | `id`, `enrollment_id`| `enrollment_id`, `receipt_id`, `registered_by` | Admin: CRUD, Sec: CRUD, Stu: R (self) | ✅ Definida |
| `payment_denominations` | M3 - Finanzas | `id`, `payment_id` | `payment_id` | Admin: CRUD, Sec: CRUD | ✅ Definida |
| `expenses` | M3 - Finanzas | `id`, `branch_id` | `branch_id`, `registered_by` | Admin: CRUD, Sec: CRUD | ✅ Definida |
| `sii_receipts` | M3 - Finanzas | `id`, `folio` | `branch_id` | Admin: CRUD, Sec: CRUD | ✅ Definida |
| `cash_closings` | M3 - Finanzas | `id`, `date` | `branch_id`, `closed_by` | Admin: CRUD, Sec: CRUD | ✅ Definida |
| `instructor_advances` | M3 - Finanzas | `id`, `instructor_id`| `instructor_id`, `registered_by` | Admin: CRUD, Sec: CRUD, Inst: R (self) | ✅ Definida |
| `instructor_monthly_payments` | M3 - Finanzas | `id`, `period` | `instructor_id`, `paid_by` | Admin: CRUD, Sec: R, Inst: R (self) | ✅ Definida |
| `standalone_courses` | M3 - Finanzas | `id`, `type` | `branch_id`, `registered_by` | Admin: CRUD, Sec: CRUD | ✅ Definida |
| `standalone_course_enrollments` | M3 - Finanzas | `id`, `course_id`| `standalone_course_id`, `student_id`, `certificate_id` | Admin: CRUD, Sec: CRUD | ✅ Definida |
| `service_catalog` | M3 - Finanzas | `id`, `name` | Ninguna | Admin: CRUD, Sec: R | ✅ Definida |
| `special_service_sales` | M3 - Finanzas | `id`, `service_id`| `student_id`, `service_id`, `registered_by` | Admin: CRUD, Sec: CRUD | ✅ Definida |
| `discounts` | M3 - Finanzas | `id`, `name` | `created_by` | Admin: CRUD, Sec: R | ✅ Definida |
| `discount_applications` | M3 - Finanzas | `id`, `discount_id`| `discount_id`, `enrollment_id`, `applied_by` | Admin: CRUD, Sec: CRUD | ✅ Definida |
| `instructors` | M4 - Acad. B | `id`, `user_id` | `user_id` | Admin: CRUD, Sec: CRUD, Inst: R (self) | ✅ Definida |
| `vehicle_assignments` | M4 - Acad. B | `id`, `vehicle_id` | `instructor_id`, `vehicle_id`, `assigned_by` | Admin: CRUD, Sec: CRUD, Inst: R (self) | ✅ Definida |
| `instructor_replacements` | M4 - Acad. B | `id`, `date` | `absent_instructor_id`, `replacement_instructor_id`, `registered_by` | Admin: CRUD, Sec: CRUD | ✅ Definida |
| `instructor_monthly_hours` | M4 - Acad. B | `id`, `period` | `instructor_id` | Admin: CRUD, Sec: R, Inst: R (self) | ✅ Definida |
| `class_b_sessions` | M4 - Acad. B | `id`, `scheduled_at`, `duration_min` (DEFAULT 45) | `enrollment_id`, `instructor_id`, `vehicle_id`, `original_instructor_id`, `registered_by` | Admin: CRUD, Sec: CRUD, Inst: CRU, Stu: R (suyas) | ✅ Definida |
| `class_b_theory_sessions` | M4 - Acad. B | `id`, `scheduled_at` | `branch_id`, `instructor_id`, `registered_by` | Admin: CRUD, Sec: CRUD, Inst: CRU, Stu: R | ✅ Definida |
| `class_b_theory_attendance` | M4 - Acad. B | `id`, `session_id` | `theory_session_b_id`, `student_id`, `recorded_by` | Admin: CRUD, Sec: CRUD, Inst: CRU, Stu: R (suyas) | ✅ Definida |
| `class_b_practice_attendance` | M4 - Acad. B | `id`, `session_id` | `class_b_session_id`, `student_id`, `recorded_by` | Admin: CRUD, Sec: CRUD, Inst: CRU, Stu: R (suyas) | ✅ Definida |
| `class_b_exam_scores` | M4 - Acad. B | `id`, `student_id` | `student_id`, `enrollment_id`, `registered_by` | Admin: CRUD, Sec: CRUD, Inst: R, Stu: R (suyos) | ✅ Definida |
| `class_b_exam_catalog` | M4 - Acad. B | `id`, `title` | `created_by` | Admin: CRUD, Sec: R, Stu: R | ✅ Definida |
| `class_b_exam_questions` | M4 - Acad. B | `id`, `exam_id` | `exam_id` | Admin: CRUD, Stu: R | ✅ Definida |
| `class_b_exam_attempts` | M4 - Acad. B | `id`, `exam_id` | `exam_id`, `student_id`, `enrollment_id` | Admin: CRUD, Sec: R, Stu: CR (suyos) | ✅ Definida |
| `route_incidents` | M4 - Acad. B | `id`, `vehicle_id` | `vehicle_id`, `instructor_id`, `class_b_session_id`, `registered_by` | Admin: CRUD, Sec: CRUD, Inst: CR | ✅ Definida |
| `lecturers` | M5 - Prof. | `id`, `rut` | Ninguna | Admin: CRUD, Sec: CRUD | ✅ Definida |
| `lecturer_monthly_hours` | M5 - Prof. | `id`, `period` | `lecturer_id` | Admin: CRUD, Sec: CRUD | ✅ Definida |
| `professional_promotions` | M5 - Prof. | `id`, `code` | `branch_id` | Admin: CRUD, Sec: CRUD, Stu: R | ✅ Definida |
| `promotion_courses` | M5 - Prof. | `id`, `promotion_id` | `promotion_id`, `course_id`, `lecturer_id`, `template_id` | Admin: CRUD, Sec: CRUD, Stu: R | ✅ Definida |
| `professional_theory_sessions`| M5 - Prof. | `id`, `date` | `promotion_course_id`, `registered_by` | Admin: CRUD, Sec: CRUD, Stu: R | ✅ Definida |
| `professional_practice_sessions`| M5 - Prof. | `id`, `date` | `promotion_course_id`, `registered_by` | Admin: CRUD, Sec: CRUD, Stu: R (suyas) | ✅ Definida |
| `professional_theory_attendance`| M5 - Prof.| `id`, `status` | `theory_session_prof_id`, `enrollment_id`, `student_id`, `evidence_id`, `recorded_by` | Admin: CRUD, Sec: CRUD, Stu: R (suyas) | ✅ Definida |
| `professional_practice_attendance`| M5 - Prof.| `id`, `status` | `session_id`, `enrollment_id`, `student_id`, `evidence_id`, `recorded_by` | Admin: CRUD, Sec: CRUD, Stu: R (suyas) | ✅ Definida |
| `professional_module_grades` | M5 - Prof. | `id`, `module` | `enrollment_id`, `recorded_by` | Admin: CRUD, Sec: CRUD, Stu: R (suyas) | ✅ Definida |
| `license_validations` | M5 - Prof. | `id`, `student_id` | `student_id`, `enrollment_a2_id`, `enrollment_a4_id`, `history_ref_id` | Admin: CRUD, Sec: CRUD, Stu: R (suyas) | ✅ Definida |
| `session_machinery` | M5 - Prof. | `id`, `session_id` | `session_id` | Admin: CRUD, Sec: CRUD | ✅ Definida |
| `absence_evidence` | M5 - Prof. | `id`, `file_url` | `enrollment_id`, `reviewed_by` | Admin: CRUD, Sec: CRUD, Stu: CR (suyas) | ✅ Definida |
| `professional_final_records` | M5 - Prof. | `id`, `enrollment_id`| `enrollment_id`, `registered_by` | Admin: CRUD, Sec: CRUD, Stu: R (suyas) | ✅ Definida |
| `professional_schedule_templates`| M5 - Prof.| `id`, `name` | Ninguna | Admin: CRUD, Sec: R | ✅ Definida |
| `template_blocks` | M5 - Prof. | `id`, `template_id`| `template_id` | Admin: CRUD, Sec: R | ✅ Definida |
| `professional_pre_registrations`| M6 - Matrí. | `id`, `temp_user_id` | `temp_user_id`, `converted_enrollment_id` | Admin: CRUD, Sec: CRUD, Stu: R (suyas) | ✅ Definida |
| `enrollments` | M6 - Matrí. | `id`, `number` | `student_id`, `course_id`, `branch_id`, `sence_code_id`, `promotion_course_id`, `registered_by` | Admin: CRUD, Sec: CRUD, Inst: R, Stu: R (self) | ✅ Definida |
| `student_documents` | M6 - Matrí. | `id`, `type` | `enrollment_id`, `reviewed_by` | Admin: CRUD, Sec: CRUD, Stu: CR (self) | ✅ Definida |
| `digital_contracts` | M6 - Matrí. | `id`, `content_hash` | `enrollment_id`, `student_id` | Admin: CRUD, Sec: CRUD, Stu: CR (self) | ✅ Definida |
| `certificate_issuance_log` | M6 - Matrí. | `id`, `action` | `certificate_id`, `user_id` | Admin: CRUD, Sec: R | ✅ Definida |
| `school_documents` | M6 - Matrí. | `id`, `type` | `branch_id`, `uploaded_by` | Admin: CRUD, Sec: CR | ✅ Definida |
| `document_templates` | M6 - Matrí. | `id`, `name` | `updated_by` | Admin: CRUD, Sec: R, Stu: R, Inst: R | ✅ Definida |
| `vehicles` | M7 - Flota | `id`, `license_plate` (UNIQUE NOT NULL) | `branch_id` | Admin: CRUD, Sec: CRUD, Inst: R | ✅ Definida |
| `vehicle_documents` | M7 - Flota | `id`, `type` | `vehicle_id` | Admin: CRUD, Sec: CRUD | ✅ Definida |
| `maintenance_records` | M7 - Flota | `id`, `type` | `vehicle_id`, `registered_by` | Admin: CRUD, Sec: CRUD | ✅ Definida |
| `secretary_observations` | M8 - Admin | `id`, `type` | `created_by`, `seen_by` | Admin: Read/Resolve/Del, Sec: Create/Read | ✅ Definida |
| `school_schedules` | M8 - Admin | `id`, `branch_id` | `branch_id` | Admin: CRUD, Sec: R | ✅ Definida |
| `class_book` | M9 - Calidad| `id`, `period` | `branch_id`, `promotion_course_id`, `generated_by`, `closed_by` | Admin: CRUD, Sec: CRUD | ✅ Definida |
| `disciplinary_notes` | M10 - Reglas| `id`, `student_id` | `student_id`, `recorded_by` | Admin: CRUD, Sec: CRUD, Stu: R (suyas) | ✅ Definida |
| `pricing_seasons` | M10 - Reglas| `id`, `name` | `created_by` | Admin: CRUD, Sec: R | ✅ Definida |
| `certificate_batches` | M10 - Reglas| `id`, `batch_code` | `branch_id`, `received_by` | Admin: CRUD, Sec: R | ✅ Definida |
| `certificates` | M10 - Reglas| `id`, `folio` | `batch_id`, `enrollment_id`, `student_id`, `issued_by` | Admin: CRUD, Sec: CRUD, Stu: R (self) | ✅ Definida |
| `biometric_records` | M14 - Norm. | `id`, `method` | `student_id`, `class_b_session_id`, `professional_session_id` | Admin: CRUD, Sec: R, Stu: R (self) | ✅ Definida |

## Vistas (security_invoker = true)

| Vista | Dominio | Descripción | Roles con acceso efectivo |
|-------|---------|-------------|--------------------------|
| `v_student_progress_b` | M4 - Acad. B | Progreso prácticas (0-12) + % asistencia teórica por matrícula Clase B | Admin, Sec, Inst (propias), Stu (propia) |
| `v_professional_attendance` | M5 - Prof. | Semáforo `green`/`yellow`/`red` de asistencia por matrícula profesional (RF-070) | Admin, Sec, Stu (propia) |
| `v_dms_student_documents` | M6 - Matrí. | Documentos del alumno unificados (`student_documents` + `digital_contracts`) | Admin, Sec, Stu (propios) |
| `v_class_b_schedule_availability` | M4 - Acad. B | **Slots de 45 min disponibles** por instructor+vehículo en las próximas 4 semanas. Filtra por `available_days`/`available_from`/`available_until` y excluye solapamientos reales de instructor y vehículo. Usar para agenda de matrícula (RF-046). | Admin, Sec (acceso completo) · Inst (solo sí mismo) · Stu: sin acceso (ver nota) |

> **Nota `v_class_b_schedule_availability`:** El rol `student` no puede ver `instructors` ni `vehicles` según sus policies actuales, por lo que la vista devuelve vacío si la consulta un alumno. Si se requiere self-service de selección de horario, implementar un RPC `SECURITY DEFINER` específico.

## Edge Functions (`supabase/functions/`)

| Función | Ubicación | Invocación | Descripción |
|---------|-----------|------------|-------------|
| `generate-contract-pdf` | `supabase/functions/generate-contract-pdf/index.ts` | `supabase.functions.invoke('generate-contract-pdf', { body: { enrollment_id } })` | Genera PDF de contrato de matrícula (RF-083). Lee enrollment+student+course+branch, construye HTML con cláusulas legales, renderiza a PDF (builder interno sin deps externas), sube a Storage bucket `documents` path `contracts/{id}/`, upsert en `digital_contracts` con content_hash SHA-256. Retorna `{ pdfUrl }`. Usa `SUPABASE_SERVICE_ROLE_KEY` (admin). |

# Registro de Base de Datos (Supabase)

> **Regla de Actualización (OBLIGATORIA):** El Agente DEBE usar sus herramientas de escritura de archivos para definir nuevas tablas en la lista de abajo cada vez que genere migraciones en `supabase/migrations/`. La documentación del RLS y FDs debe ser estricta.

| Tabla / Colección | Core / Dominio | Columnas Clave | Relaciones (FKs) | Restricciones RLS (Policies) | Estado |
|-------------------|----------------|----------------|------------------|------------------------------|--------|
| `profiles` | Auth | `id`, `household_id` | N/A (id vinculada a `auth.users`) | `SELECT` public, `UPDATE` own id | ✅ Estable |
| `branches` | M1 - Usuarios | `id`, `slug` | Ninguna | Admin: CRUD, Sec: R, Inst: R, Stu: R | ✅ Definida |
| `roles` | M1 - Usuarios | `id`, `name` | Ninguna | Admin: CRUD, Sec: R, Inst: R, Stu: R | ✅ Definida |
| `users` | M1 - Usuarios | `id`, `rut`, `email` | `role_id`, `branch_id` | Admin: CRUD, Sec: R, Inst: R (self), Stu: R (self) | ✅ Definida |
| `students` | M1 - Usuarios | `id`, `user_id`, `address` (sin `region`/`district`) | `user_id` | Admin: CRUD, Sec: CRUD, Inst: R, Stu: R (self) | ✅ Definida |
| `courses` | M1 - Usuarios | `id`, `code`, `schedule_days`, `schedule_blocks`, `is_convalidation` (BOOL, default false) | `branch_id` | Admin: CRUD, Sec: R, Inst: R, Stu: R | ✅ Definida · `cc_class_b` + `cc_class_b_sence` agregados para branch 2 (`20260311100000`) · `is_convalidation` + cursos `conv_a4`/`conv_a3` agregados (`20260313100000`). Los cursos con `is_convalidation=true` NO generan enrollments ni cuentan contra cupo. |
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
| `class_b_sessions` | M4 - Acad. B | `id`, `scheduled_at`, `duration_min`, `evaluation_grade`, `evaluation_checklist` (JSONB) | `enrollment_id`, `instructor_id`, `vehicle_id`, `original_instructor_id`, `registered_by` | Admin: CRUD, Sec: CRUD, Inst: CRU, Stu: R (suyas) | ✅ Definida · Evaluación Checklist agregada (`20260401000100`) · **Realtime habilitado** |
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
| `promotion_courses` | M5 - Prof. | `id`, `code` (opcional, ej: "PC-A2-001"), `promotion_id` | `promotion_id`, `course_id`, `lecturer_id`, `template_id` | Admin: CRUD, Sec: CRUD, Stu: R | ✅ Definida |
| `professional_theory_sessions`| M5 - Prof. | `id`, `date` | `promotion_course_id`, `registered_by` | Admin: CRUD, Sec: CRUD, Stu: R | ✅ Definida |
| `professional_practice_sessions`| M5 - Prof. | `id`, `date` | `promotion_course_id`, `registered_by` | Admin: CRUD, Sec: CRUD, Stu: R (suyas) | ✅ Definida |
| `professional_theory_attendance`| M5 - Prof.| `id`, `status` | `theory_session_prof_id`, `enrollment_id`, `student_id`, `evidence_id`, `recorded_by` | Admin: CRUD, Sec: CRUD, Stu: R (suyas) | ✅ Definida |
| `professional_practice_attendance`| M5 - Prof.| `id`, `status` | `session_id`, `enrollment_id`, `student_id`, `evidence_id`, `recorded_by` | Admin: CRUD, Sec: CRUD, Stu: R (suyas) | ✅ Definida |
| `professional_module_grades` | M5 - Prof. | `id`, `module` | `enrollment_id`, `recorded_by` | Admin: CRUD, Sec: CRUD, Stu: R (suyas) | ✅ Definida |
| `license_validations` | M5 - Prof. | `id`, `enrollment_id`, `convalidated_license` ('A4'\|'A3'), `convalidation_promotion_course_id`, `reduced_hours`, `book2_open_date`, `history_ref_id` | `enrollment_id` (CASCADE), `convalidation_promotion_course_id`, `history_ref_id` | Admin: CRUD, Sec: CRUD, Stu: R (suyas) | ✅ Rediseñada `20260313110000`: modelo de 1 solo enrollment (curso madre) + soporte A5+A3. UNIQUE(`enrollment_id`). Elimina `enrollment_a2_id`/`enrollment_a4_id`. `student_id` eliminado `20260313120000`: alumno se obtiene vía `enrollment_id → enrollments.student_id`. |
| `session_machinery` | M5 - Prof. | `id`, `session_id` | `session_id` | Admin: CRUD, Sec: CRUD | ✅ Definida |
| `absence_evidence` | M5 - Prof. | `id`, `file_url` | `enrollment_id`, `reviewed_by` | Admin: CRUD, Sec: CRUD, Stu: CR (suyas) | ✅ Definida |
| `professional_final_records` | M5 - Prof. | `id`, `enrollment_id`| `enrollment_id`, `registered_by` | Admin: CRUD, Sec: CRUD, Stu: R (suyas) | ✅ Definida |
| `professional_schedule_templates`| M5 - Prof.| `id`, `name` | Ninguna | Admin: CRUD, Sec: R | ✅ Definida |
| `template_blocks` | M5 - Prof. | `id`, `template_id`| `template_id` | Admin: CRUD, Sec: R | ✅ Definida |
| `slot_holds` | M6 - Matrí. | `id`, `session_token`, `instructor_id`, `slot_start`, `expires_at` | `instructor_id` (CASCADE) | Sin políticas públicas — solo service role (Edge Function `public-enrollment`) | ✅ Definida (`20260317100000`) · TTL 20 min · Creadas por `reserve-slots`, liberadas por `release-slots` y `submit-clase-b`. Superpuestas en `load-schedule` para marcar slots tomados por otras sesiones como ocupados. |
| `payment_attempts` | M6 - Matrí. | `id`, `session_token` (UNIQUE), `status` ('pending'\|'confirmed'\|'failed'), `draft_snapshot` jsonb, `enrollment_id`, `transbank_token` | `enrollment_id` (SET NULL) | Sin políticas públicas — solo service role (Edge Function `public-enrollment`) | ✅ Definida (`20260317100000`) · Idempotencia de pagos por `session_token` (UUID almacenado en `localStorage`). Cuando se integre Transbank: `transbank_token` almacena el token de Webpay y `status` refleja el resultado. |
| `professional_pre_registrations`| M6 - Matrí. | `id`, `temp_user_id`, `branch_id`, `requested_license_class`, `convalidates_simultaneously` (BOOL), `registration_channel` ('online'\|'presencial'), `notes`, `psych_test_answers` (JSONB, array 81 bool), `psych_test_status` ('not_started'\|'completed'), `psych_test_result` (null\|'fit'\|'unfit'), `psych_test_completed_at` (TIMESTAMPTZ), `status` ('pending_review'\|'approved'\|'enrolled'\|'expired'\|'rejected') | `temp_user_id`, `branch_id`, `converted_enrollment_id` | Admin: CRUD, Sec: CRUD, Stu: R (suyas) | ✅ Definida · `20260319100000`: añadidos `psych_test_answers` (JSONB) y `psych_test_completed_at`. · `20260320000000`: añadidos `branch_id`, `requested_license_class`, `convalidates_simultaneously`, `registration_channel`, `notes` para alinear con la Edge Function `public-enrollment`. `status` usa `'pending_review'` como default. |
| `enrollments` | M6 - Matrí. | `id`, `number`, `current_step` (1-6), `payment_mode` ('total'\|'deposit'), `license_group` ('class_b'\|'professional'), `status` ('draft'\|'pending_payment'\|'active'\|'inactive'\|'completed'\|'cancelled'), `registration_channel` ('presential'\|'online') | `student_id`, `course_id`, `branch_id`, `sence_code_id`, `promotion_course_id`, `registered_by` | Admin: CRUD, Sec: CRUD, Inst: R, Stu: R (self) | ✅ Definida · Fix `20260312100000`: UNIQUE(`number`) reemplazado por UNIQUE(`number`, `branch_id`, `license_group`) para soportar secuencias independientes por sede. `license_group` se auto-popula vía trigger `trg_set_enrollment_license_group`. · Fix `20260317150000`: `chk_enrollment_number` actualizado a `status IN ('draft','pending_payment','cancelled') OR number IS NOT NULL` — los enrollments `pending_payment` se crean sin número; el número se asigna al confirmar el pago en `confirm-payment`. |
| `student_documents` | M6 - Matrí. | `id`, `type` | `enrollment_id`, `reviewed_by`; **UNIQUE(`enrollment_id`,`type`)** | Admin: CRUD, Sec: CRUD, Stu: CR (self) · Fix `20260310140000`: DELETE ahora incluye secretary | ✅ Definida · Fix `20260317140000`: fotos subidas en flujo público se insertan vía Edge Function (service role) desde ruta temporal `public-uploads/carnet/{sessionToken}` tras crear el enrollment |
| `digital_contracts` | M6 - Matrí. | `id`, `content_hash` | `enrollment_id`, `student_id` | Admin: CRUD, Sec: CRUD, Stu: CR (self) · Fix `20260310140000`: DELETE incluye secretary · Fix `20260313130000`: UPDATE incluye secretary (necesario para upsert con `onConflict`) | ✅ Definida |
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
| `v_class_b_schedule_availability` | M4 - Acad. B | **Slots de 45 min (disponibles y ocupados)** por instructor+vehículo en las próximas 4 semanas. Columna `slot_status TEXT ('available'\|'occupied')` indica disponibilidad. Horarios derivados de `courses.schedule_days`/`schedule_blocks` (horario operativo de la autoescuela, compartido por todos los instructores). NO filtra los slots ocupados, los expone con `slot_status='occupied'` para que la UI los muestre en gris. Usar para agenda de matrícula (RF-046). | Admin, Sec (acceso completo) · Inst (solo sí mismo) · Stu: sin acceso (ver nota) |

> **Nota `v_class_b_schedule_availability`:** El rol `student` no puede ver `instructors` ni `vehicles` según sus policies actuales, por lo que la vista devuelve vacío si la consulta un alumno. Si se requiere self-service de selección de horario, implementar un RPC `SECURITY DEFINER` específico.

## Edge Functions (`supabase/functions/`)

| Función | Ubicación | Invocación | Descripción |
|---------|-----------|------------|-------------|
| `generate-contract-pdf` | `supabase/functions/generate-contract-pdf/index.ts` | `supabase.functions.invoke('generate-contract-pdf', { body: { enrollment_id } })` | Genera PDF de contrato de matrícula (RF-083). Lee enrollment+student+course+branch, construye HTML con cláusulas legales, renderiza a PDF (builder interno sin deps externas), sube a Storage bucket `documents` path `contracts/{id}/`, upsert en `digital_contracts` con content_hash SHA-256. Retorna `{ pdfUrl }`. Usa `SUPABASE_SERVICE_ROLE_KEY` (admin). |
| `public-enrollment` | `supabase/functions/public-enrollment/index.ts` | `supabase.functions.invoke('public-enrollment', { body: { action: '...' } })` | Matrícula pública (sin auth). Actions: `load-instructors`, `load-schedule` (filtra `slot_holds` de otras sesiones como ocupados, acepta `sessionToken`), `reserve-slots` (crea/reemplaza holds TTL 20 min), `release-slots` (libera holds al retroceder), `submit-clase-b` (idempotente vía `payment_attempts.session_token`; acepta `carnetStoragePath` opcional para mover foto desde ruta temporal a `students/{id}/id_photo` + registrar en `student_documents`), `submit-pre-inscription`, `initiate-payment` (crea enrollment `pending_payment` + class_b_sessions `reserved` + draft_snapshot en BD incluyendo `carnetStoragePath`; sets `base_price`, `pending_balance`, `total_paid=0`, `payment_status='pending'` en enrollment; inicia transacción Webpay Plus vía REST; retorna `{webpayUrl, webpayToken}`), `confirm-payment` (recibe `tokenWs` del return_url, llama `webpayCommit`, valida `response_code===0 && status==='AUTHORIZED'`, activa enrollment + actualiza `total_paid`/`pending_balance`/`payment_status`, activa sesiones, genera número matrícula, inserta registro en `payments` (type='online', card_amount), mueve foto carnet desde ruta temporal del snapshot, libera slot_holds; retorna respuesta enriquecida con `branchName`, `courseName`, `amountPaid`, `courseBasePrice`, `pendingBalance`, `sessionCount`, `paymentMode`, `studentName`). Usa `SERVICE_ROLE_KEY` para bypass RLS. Transbank: env `TRANSBANK_ENV` (`integration`\|`production`), credenciales en `TRANSBANK_COMMERCE_CODE`/`TRANSBANK_API_KEY`; en integration usa credenciales públicas predefinidas. **Foto carnet (flujo 2 etapas):** cliente anón sube a `documents/public-uploads/carnet/{sessionToken}` (política `20260317140000`); `carnetStoragePath` se guarda en `draft_snapshot` durante `initiate-payment`; la EF mueve vía `storage.move()` a `documents/students/{enrollmentId}/id_photo` e inserta en `student_documents` (tipo `id_photo`, status `approved`) durante `confirm-payment`. |

## Funciones SQL

| Función | Migración | Programación | Descripción |
|---------|-----------|--------------|-------------|
| `cleanup_expired_public_enrollment()` | `20260317100000` + actualizada en `20260317120000` | Manual o pg_cron | Limpia `slot_holds` expirados, marca `payment_attempts` pendientes vencidos como `'failed'`, y cancela enrollments `pending_payment` cuya ventana de pago venció (`UPDATE enrollments SET status='cancelled' WHERE id IN (SELECT enrollment_id FROM payment_attempts WHERE status='failed')`). `SECURITY DEFINER`. |
| `cleanup_expired_drafts()` | `20260313140000_fix_cleanup_drafts_class_b_sessions.sql` | pg_cron: `0 3 * * *` (diario 3AM UTC) | Limpia enrollments en `status='draft'` con `expires_at < NOW()`. Archivos de storage se limpian externamente via Storage API. Borra en cascada: `class_b_sessions` (**todas**, sin filtrar por status — Fix `20260313140000`: el filtro `status='reserved'` anterior dejaba sesiones con otros status que violaban la FK), `discount_applications`, `payments`, `student_documents`, `digital_contracts`, `enrollments`. Retorna conteo de enrollments eliminados. |
| `trg_enrollment_validation_fn()` | `20260309130000_allow_draft_status_for_professional.sql` | Trigger BEFORE INSERT OR UPDATE en `enrollments` | Valida reglas de negocio: Clase B no puede tener `promotion_course_id`; cursos `professional` y SENCE deben ser `in_person`. **Desde esta migración, `status='draft'` está permitido para todos los tipos de curso** (antes restringido solo a `class_b`). |
| `auth_can_enroll_course_type(p_course_id INT)` | `20260310100000_enrollment_branch_course_restriction.sql` | Usada en RLS de `enrollments` (INSERT/UPDATE) | Restringe el tipo de curso según rol y sucursal: admin → sin límite; secretary branch 2 (Conductores Chillán) → todo; secretary branch 1 (Autoescuela Chillán) → solo `class_b` y `singular` (no `professional`). |
| `get_next_enrollment_number(p_course_id INT)` | `20260311100000_class_b_courses_branch2_and_enrollment_number_fix.sql` (actualiza `20260310110000`) | Llamada desde `EnrollmentFacade.confirmEnrollment()` vía RPC | Devuelve el siguiente número secuencial de matrícula **separado por (sede × tipo de licencia)**: Clase B Autoescuela Chillán, Clase B Conductores Chillán y Profesional tienen contadores independientes. Los drafts sin confirmar (`status = 'draft'`) no consumen número. Formato: 4 dígitos (0001–9999), 5 desde 10000. `SECURITY DEFINER`. |
| `set_enrollment_license_group()` | `20260312100000_fix_enrollment_number_unique_constraint.sql` | Trigger `BEFORE INSERT` en `enrollments` | Popula `enrollments.license_group` automáticamente a partir de `courses.license_class` del curso asociado. Evita que el consumidor tenga que calcularlo manualmente. |

## Migraciones RLS adicionales

| Migración | Descripción |
|-----------|-------------|
| `20260314100000_public_enrollment_anon_rls.sql` | Policies SELECT anónimas para `branches` (todas) y `courses` (activas, no convalidación) para la vista de matrícula pública. |
| `20260315100000_enable_realtime_class_b_sessions.sql` | Habilita Supabase Realtime en `class_b_sessions` (`ALTER PUBLICATION supabase_realtime ADD TABLE`). Permite que secretarias/admin reciban actualizaciones en vivo de slots ocupados durante matrícula. |

## Storage Buckets

| Bucket | Migración creación | Migración fix | Visibilidad | MIME permitidos | Límite | Policies |
|--------|-------------------|---------------|-------------|-----------------|--------|----------|
| `documents` | `20260307160000_create_documents_storage_bucket.sql` | `20260310130000_fix_documents_storage_rls.sql` | `public: true` | `image/jpeg`, `image/png`, `image/webp`, `application/pdf` | 10 MB | SELECT: público · INSERT/UPDATE: secretary o admin (subquery directa) · DELETE: solo admin |

> **Fix aplicado `20260310130000`:** Se reemplazó `auth_user_role()` por subquery `EXISTS(... JOIN roles ...)` en todas las policies de storage para evitar fallos en el contexto de evaluación del schema `storage`. Se agregó `WITH CHECK` a la policy UPDATE (necesario para que `upsert: true` funcione cuando el archivo ya existe). Se cambió `ON CONFLICT DO NOTHING` por `DO UPDATE SET` para forzar actualización de `allowed_mime_types` si el bucket ya existía antes de la migración original.

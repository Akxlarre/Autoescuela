# Registro de Base de Datos (Supabase)

> **Regla de Actualización (OBLIGATORIA):** El Agente DEBE usar sus herramientas de escritura de archivos para definir nuevas tablas en la lista de abajo cada vez que genere migraciones en `supabase/migrations/`. La documentación del RLS y FDs debe ser estricta.

| Tabla / Colección | Core / Dominio | Columnas Clave | Relaciones (FKs) | Restricciones RLS (Policies) | Estado |
|-------------------|----------------|----------------|------------------|------------------------------|--------|
| `profiles` | Auth | `id`, `household_id` | N/A (id vinculada a `auth.users`) | `SELECT` public, `UPDATE` own id | ✅ Estable |
| `branches` | M1 - Usuarios | `id`, `slug`, `has_professional` (BOOL, def false) | Ninguna | Admin: CRUD, Sec: R, Inst: R, Stu: R | ✅ Definida · `20260403110000`: añadida `has_professional`; branch 2 (Conductores Chillán) = true |
| `roles` | M1 - Usuarios | `id`, `name` | Ninguna | Admin: CRUD, Sec: R, Inst: R, Stu: R | ✅ Definida |
| `users` | M1 - Usuarios | `id`, `rut`, `email` | `role_id`, `branch_id` | Admin: CRUD, Sec: R, Inst: R (self), Stu: R (self) | ✅ Definida · `20260612120000`: COMMENT ON COLUMN `users.gender` y `professional_pre_registrations.gender` — valores M/F/X (ley REC Chile 2022). |
| `students` | M1 - Usuarios | `id`, `user_id`, `address` (sin `region`/`district`), `status` (TEXT: 'active'\|'pending'\|'inactive'\|'graduated'\|**'archived'** — sin CHECK constraint) | `user_id` | Admin: CRUD, Sec: CRUD, Inst: R, Stu: R (self) | ✅ Definida · `20260426000001`: documentado `'archived'` como valor de soft-delete. `AdminAlumnosFacade` excluye `.neq('status','archived')` de la query. · `20260624120000` (spec 0017): SELECT de `secretary` ahora `branch_visible` sobre la sede del user dueño (antes sin filtro). |
| `courses` | M1 - Usuarios | `id`, `code`, `schedule_days`, `schedule_blocks`, `is_convalidation` (BOOL, default false), `max_classes_per_day` (INT, default 1) | `branch_id` | Admin: CRUD, Sec: R, Inst: R, Stu: R | ✅ Definida · `cc_class_b` + `cc_class_b_sence` agregados para branch 2 (`20260311100000`) · `is_convalidation` + cursos `conv_a4`/`conv_a3` agregados (`20260313100000`). Los cursos con `is_convalidation=true` NO generan enrollments ni cuentan contra cupo. · **`20260513000001`:** `schedule_blocks` cambiado de rangos continuos a **slots exactos** (cada elemento `{"from","to"}` es un slot de 45 min, no un rango). Nuevos horarios L-V: 08:30-09:15 · 09:20-10:05 · 10:10-10:55 · 11:00-11:45 · 11:50-12:35 · 12:40-13:25 · 15:00-15:45 · 15:50-16:35 · 16:40-17:25 · 17:30-18:15 · 18:20-19:05 · 19:10-19:55 · 20:00-20:45. Aplica a ambas sedes. · **`20260613000000`:** `max_classes_per_day` añadido para permitir agendamientos intensivos. |
| `sence_codes` | M1 - Usuarios | `id`, `code` | `course_id` | Admin: CRUD, Sec: R, Inst: R, Stu: R | ✅ Definida |
| `audit_log` | M1 - Usuarios | `id`, `user_id` | `user_id` | Admin: R · INSERT: autenticados (solo vía triggers) | ✅ Definida |
| `login_attempts` | M1 - Usuarios | `id`, `email` | `user_id` | Admin: R | ✅ Definida |
| `notifications` | M2 - Notif. | `id`, `recipient_id` | `recipient_id` | Admin: CRUD, Sec: CRUD, Inst: R (self), Stu: R (self) | ✅ Definida |
| `notification_templates` | M2 - Notif. | `id`, `name` | Ninguna | Admin: CRUD, Sec: R, Inst: R | ✅ Definida |
| `alert_config` | M2 - Notif. | `id`, `alert_type` | `branch_id` | Admin: CRUD, Sec: R | ✅ Definida |
| `payments` | M3 - Finanzas | `id`, `enrollment_id`| `enrollment_id`, `receipt_id`, `registered_by` | Admin: CRUD, Sec: CRUD, Stu: R (self) | ✅ Definida |
| `payment_denominations` | M3 - Finanzas | `id`, `payment_id` | `payment_id` | Admin: CRUD, Sec: CRUD | ✅ Definida |
| `expenses` | M3 - Finanzas | `id`, `branch_id` | `branch_id`, `registered_by` | Admin: CRUD, Sec: CRUD | ✅ Definida |
| `fixed_expenses` | M3 - Finanzas | `id`, `branch_id`, `category` (salary\|utility\|insurance\|repair\|rent\|other), `description`, `amount`, `date`, `created_by`, `created_at` | `branch_id`, `date` | Admin: CRUD. Sec: Sin acceso (RLS) | ✅ Definida |
| `sii_receipts` | M3 - Finanzas | `id`, `folio` | `branch_id` | Admin: CRUD, Sec: CRUD | ✅ Definida |
| `cash_closings` | M3 - Finanzas | `id`, `date` | `branch_id`, `closed_by` | Admin: CRUD, Sec: CRUD | ✅ Definida |
| `instructor_advances` | M3 - Finanzas | `id`, `instructor_id`| `instructor_id`, `registered_by` | Admin: CRUD, Sec: CRUD, Inst: R (self) | ✅ Definida |
| `instructor_monthly_payments` | M3 - Finanzas | `id`, `period` | `instructor_id`, `paid_by` | Admin: CRUD, Sec: R, Inst: R (self) | ✅ Definida |
| `standalone_courses` | M3 - Finanzas | `id`, `type`, `branch_id` (**NOT NULL** desde `20260612000001` — backfill NULL→1), `updated_at` (TIMESTAMPTZ, agregado en `20260615120000`) | `branch_id`, `registered_by` | Admin: CRUD, Sec: CRUD | ✅ Definida · `20260612000001` (fix-016-m): `branch_id` obligatorio; trigger `trg_standalone_capacity` (BEFORE INSERT en enrollments, `FOR UPDATE` sobre el curso) bloquea sobreventa de cupos con `RAISE EXCEPTION 'CUPOS_AGOTADOS'` (la UI lo traduce vía `db-error.utils`). · `20260615120000`: `updated_at` añadido para soporte del cron `auto_transition_standalone_course_status`. |
| `standalone_course_enrollments` | M3 - Finanzas | `id`, `course_id`, `payment_method` (TEXT, def 'efectivo'), `registered_by` (FK users), `discount_amount` (INT NOT NULL def 0), `discount_reason` (TEXT), `paid_at` (TIMESTAMPTZ — NULL si pendiente) | `standalone_course_id`, `student_id`, `certificate_id`, `registered_by` | Admin: CRUD, Sec: CRUD | ✅ Definida · `20260417000003`: `payment_method` y `registered_by`. · `20260612000001` (fix-016-m): descuentos persistidos (`discount_amount`/`discount_reason` — el cobro es `base_price − discount_amount`) y `paid_at` (fuente de la cuadratura diaria; backfill `enrolled_at` para pagados históricos). |
| `service_catalog` | M3 - Finanzas | `id`, `name`, `description`, `base_price`, `active` | Ninguna | Admin: CRUD, Sec: R | ✅ Definida |
| `special_service_sales` | M3 - Finanzas | `id`, `service_id`→service_catalog, `student_id` (nullable), `is_student`, `client_name`, `client_rut`, `sale_date`, `price`, `status` (pending/completed), `paid`, `metadata` JSONB, `registered_by`→users | `service_id`, `registered_by` | Admin: CRUD, Sec: CRUD | ✅ Definida — patch 20260407: student_id nullable, +is_student/client_name/client_rut/status/paid |
| `discounts` | M3 - Finanzas | `id`, `name` | `created_by` | Admin: CRUD, Sec: R | ✅ Definida |
| `discount_applications` | M3 - Finanzas | `id`, `discount_id`| `discount_id`, `enrollment_id`, `applied_by` | Admin: CRUD, Sec: CRUD | ✅ Definida |
| `instructors` | M4 - Acad. B | `id`, `user_id`, `both_branches` (BOOL, def false) | `user_id` | Admin: CRUD, Sec: **R por sede** (SELECT `branch_visible` sobre la sede del user dueño **OR `both_branches`** — spec 0017 + 0004-m; honra `can_access_both_branches`), Inst: R (self) | ✅ Definida · `20260624120000` scope SELECT por sede · `20260730100000` (spec 0004-m): columna `both_branches` — instructor dicta clases en las dos sedes; `branch_id` (de `users`) sigue siendo su sede principal |
| `instructor_documents` | M4 - Acad. B | `id`, `instructor_id`, `type`, `status` (def `'pending'`) | `instructor_id`→instructors, `uploaded_by`→users | Admin: CRUD, Sec: CRU **por sede** (`branch_visible` sobre la sede del user dueño del instructor, vía join `instructors.user_id`) | ✅ Definida · `20260729120000` (spec 0003-m) |
| `vehicle_assignments` | M4 - Acad. B | `id`, `vehicle_id` | `instructor_id`, `vehicle_id`, `assigned_by` | Admin: CRUD, Sec: CRUD, Inst: R (self) | ✅ Definida |
| `instructor_replacements` | M4 - Acad. B | `id`, `date` | `absent_instructor_id`, `replacement_instructor_id`, `registered_by` | Admin: CRUD, Sec: CRUD | ✅ Definida |
| `instructor_monthly_hours` | M4 - Acad. B | `id`, `period` | `instructor_id` | Admin: CRUD, Sec: R, Inst: R (self) | ✅ Definida |
| `class_b_sessions` | M4 - Acad. B | `id`, `scheduled_at`, `duration_min`, `class_number` (SMALLINT, 1-12), `evaluation_grade`, `evaluation_checklist` (JSONB) | `enrollment_id`, `instructor_id`, `vehicle_id`, `original_instructor_id`, `registered_by` | Admin: CRUD, Sec: CRUD, Inst: CRU, Stu: R (suyas) | ✅ Definida · Evaluación Checklist agregada (`20260401000100`) · **Realtime habilitado** · **`20260709120100` (fix-028-m):** `class_number` reforzado con `CHECK (class_number BETWEEN 1 AND 12)` (`chk_class_b_sessions_class_number_range`) y `UNIQUE (enrollment_id, class_number)` (`uq_class_b_sessions_enrollment_class_number`) — antes solo era un comentario de columna, sin protección real. Reagendar una sesión `cancelled`/`no_show` (RF-053, `AdminAlumnoDetalleFacade.reagendarClasesPenalizadas()`) siempre recicla in-place la misma fila; nunca inserta una fila nueva. |
| `class_b_theory_cycles` | M4 - Acad. B | `id`, `branch_id`, `start_date` (lunes), `end_date` (=start+11, viernes semana 2), `status` ('active'\|'finished') · UNIQUE(`branch_id`,`start_date`) | `branch_id` | Admin: CRUD · Sec: CRUD por sede (`branch_visible`) · Inst/Stu: R | ✅ Definida · **`20260630000000` (Spec 0001-m):** Ciclos teóricos Clase B (cohorte 2 semanas, 6 clases L/X/V). Transición `active→finished` vía pg_cron `auto_transition_theory_cycle_status`. |
| `class_b_theory_sessions` | M4 - Acad. B | `id`, `cycle_id`, `class_number` (1–6), `class_date`, `topic` (opcional), `zoom_link`, `zoom_sent_at` · UNIQUE(`cycle_id`,`class_number`) | `cycle_id`→class_b_theory_cycles (CASCADE), `branch_id`, `registered_by` | Admin: CRUD, Sec: CRUD, Inst: CRU, Stu: R | ✅ **Reutilizada `20260630000000` (Spec 0001-m):** ahora modela las **6 clases de un ciclo** (no sesiones sueltas). Datos legacy `TRUNCATE`; `scheduled_at` ahora nullable; sin asistencia. |
| ~~`class_b_theory_attendance`~~ | M4 - Acad. B | — | — | — | ❌ Eliminada (`20260630000000`, Spec 0001-m) — la asistencia teórica es irrelevante por decisión de negocio. Purgada de facades/UI y de `v_student_progress_b`. |
| `class_b_practice_attendance` | M4 - Acad. B | `id`, `session_id` | `class_b_session_id`, `student_id`, `recorded_by` | Admin: CRUD, Sec: CRUD, Inst: CRU, Stu: R (suyas) | ✅ Definida |
| `class_b_exam_scores` | M4 - Acad. B | `id`, `student_id` | `student_id`, `enrollment_id`, `registered_by` | Admin: CRUD, Sec: CRUD, Inst: R, Stu: R (suyos) | ✅ Definida · Relaciones explicitadas via `20260406000000` para corregir error de resolución en PostgREST. |
| `class_b_exam_catalog` | M4 - Acad. B | `id`, `title` | `created_by` | Admin: CRUD, Sec: R, Stu: R | ✅ Definida |
| `class_b_exam_questions` | M4 - Acad. B | `id`, `exam_id` | `exam_id` | Admin: CRUD, Stu: R | ✅ Definida |
| `class_b_exam_attempts` | M4 - Acad. B | `id`, `exam_id` | `exam_id`, `enrollment_id` | Admin: CRUD, Sec: R, Stu: CR (suyos) | ✅ Definida · `20260404120000`: eliminado `student_id` redundante — alumno se obtiene vía `enrollment_id → enrollments.student_id`. |
| `route_incidents` | M4 - Acad. B | `id`, `vehicle_id` | `vehicle_id`, `instructor_id`, `class_b_session_id`, `registered_by` | Admin: CRUD, Sec: CRUD, Inst: CR | ✅ Definida |
| `lecturers` | M5 - Prof. | `id`, `rut` | Ninguna | Admin: CRUD, Sec: CRUD | ✅ Definida |
| `lecturer_monthly_hours` | M5 - Prof. | `id`, `period` | `lecturer_id` | Admin: CRUD, Sec: CRUD | ✅ Definida |
| `professional_promotions` | M5 - Prof. | `id`, `code`, `updated_at` (timestamptz, default now()) | `branch_id` | Admin: CRUD, Sec: CRUD, Stu: R | ✅ Definida · `20260415000001`: añadida columna `updated_at` con trigger `trg_professional_promotions_updated_at` → `set_updated_at()`. · `20260415000002`: trigger `trg_cascade_promotion_status` → `cascade_promotion_status_to_courses()`: propaga cambios de `status` a todos los `promotion_courses` hijos (cubre UI manual y pg_cron). |
| `promotion_courses` | M5 - Prof. | `id`, `code` (opcional, ej: "PC-A2-001"), `promotion_id` | `promotion_id`, `course_id` | Admin: CRUD, Sec: CRUD, Stu: R | ✅ Definida · `20260325100000`: eliminado `lecturer_id` — reemplazado por tabla intersección `promotion_course_lecturers`. · `20260326100000`: eliminada columna `enrolled_students` — conteo derivado en runtime desde tabla `enrollments` vía `promotion_course_id`. · `20260329100000`: eliminada columna `template_id` y tablas `professional_schedule_templates`/`template_blocks`. Trigger `trg_generate_professional_course_sessions` reescrito: genera sesiones L-S (solo fecha, sin horario) automáticamente desde `start_date`/`end_date` de la promoción padre. |
| `promotion_course_lecturers` | M5 - Prof. | `id`, `promotion_course_id`, `lecturer_id`, `role` (`theory`\|`practice`\|`both`\|NULL) | `promotion_course_id` (CASCADE), `lecturer_id` (RESTRICT) · UNIQUE(`promotion_course_id`, `lecturer_id`) | Admin: CRUD, Sec: CRU, resto: R | ✅ Definida (`20260325100000`) · Migra automáticamente los `lecturer_id` existentes con `role=NULL`. |
| `professional_theory_sessions`| M5 - Prof. | `id`, `date` | `promotion_course_id`, `registered_by` | Admin: CRUD, Sec: CRUD, Stu: R | ✅ Definida |
| `professional_practice_sessions`| M5 - Prof. | `id`, `date` | `promotion_course_id`, `registered_by` | Admin: CRUD, Sec: CRUD, Stu: R (suyas) | ✅ Definida |
| `professional_theory_attendance`| M5 - Prof.| `id`, `status` | `theory_session_prof_id`, `enrollment_id`, `evidence_id`, `recorded_by` · UNIQUE(`theory_session_prof_id`, `enrollment_id`) | Admin: CRUD, Sec: CRUD, Stu: R (suyas) | ✅ Definida · `20260404120000`: eliminado `student_id` redundante; UNIQUE actualizado a `(theory_session_prof_id, enrollment_id)`. |
| `professional_practice_attendance`| M5 - Prof.| `id`, `status` | `session_id`, `enrollment_id`, `evidence_id`, `recorded_by` · UNIQUE(`session_id`, `enrollment_id`) | Admin: CRUD, Sec: CRUD, Stu: R (suyas) | ✅ Definida · `20260404120000`: eliminado `student_id` redundante; UNIQUE actualizado a `(session_id, enrollment_id)`. |
| `professional_module_grades` | M5 - Prof. | `id`, `module_number` (1–7), `module` (texto descriptivo), `grade` (NUMERIC 5,1 · 10–100), `passed` (≥75), `status` ('draft'\|'confirmed') | `enrollment_id`, `recorded_by` · UNIQUE(`enrollment_id`, `module_number`) | Admin: CRUD, Sec: CRUD, Stu: R (suyas) | ✅ Rediseñada (`20260404130000`) · Escala cambiada de 1–7 a MTT 10–100. Añadidos: `module_number`, `status`, UNIQUE por matrícula×módulo. Mínimo aprobación: 75. Módulo 5 varía por `courses.license_class`: A2/A3=Pasajeros, A4/A5=Carga (lógica en `core/utils/professional-modules.ts`). |
| `license_validations` | M5 - Prof. | `id`, `enrollment_id`, `convalidated_license` ('A4'\|'A3'), `convalidation_promotion_course_id`, `reduced_hours`, `book2_open_date`, `history_ref_id` | `enrollment_id` (CASCADE), `convalidation_promotion_course_id`, `history_ref_id` | Admin: CRUD, Sec: CRUD, Stu: R (suyas) | ✅ Rediseñada `20260313110000`: modelo de 1 solo enrollment (curso madre) + soporte A5+A3. UNIQUE(`enrollment_id`). Elimina `enrollment_a2_id`/`enrollment_a4_id`. `student_id` eliminado `20260313120000`: alumno se obtiene vía `enrollment_id → enrollments.student_id`. |
| `session_machinery` | M5 - Prof. | `id`, `session_id` | `session_id` | Admin: CRUD, Sec: CRUD | ✅ Definida |
| `absence_evidence` | M5 - Prof. | `id`, `file_url` | `enrollment_id`, `reviewed_by` | Admin: CRUD, Sec: CRUD, Stu: CR (suyas) | ✅ Definida |
| `professional_final_records` | M5 - Prof. | `id`, `enrollment_id`| `enrollment_id`, `registered_by` | Admin: CRUD, Sec: CRUD, Stu: R (suyas) | ✅ Definida |
| ~~`professional_schedule_templates`~~ | M5 - Prof. | — | — | — | ❌ Eliminada (`20260329100000`) — reemplazada por columnas de horario en `promotion_courses` |
| ~~`template_blocks`~~ | M5 - Prof. | — | — | — | ❌ Eliminada (`20260329100000`) — generación de sesiones ahora directa desde fechas de promoción |
| ~~`secretary_observations`~~ | M8 - Admin | — | — | — | ❌ Eliminada (`20260518000000`) — reemplazada por `tasks` con `type='observation'`. Datos migrados con `from_role='secretary'`, `to_role='admin'`. |
| `slot_holds` | M6 - Matrí. | `id`, `session_token`, `instructor_id`, `slot_start`, `expires_at` | `instructor_id` (CASCADE) | Sin políticas públicas — solo service role (Edge Function `public-enrollment`) | ✅ Definida (`20260317100000`) · TTL 20 min · Creadas por `reserve-slots`, liberadas por `release-slots` y `submit-clase-b`. Superpuestas en `load-schedule` para marcar slots tomados por otras sesiones como ocupados. |
| `payment_attempts` | M6 - Matrí. | `id`, `session_token` (UNIQUE), `status` ('pending'\|'confirmed'\|'failed'), `draft_snapshot` jsonb, `enrollment_id`, `transbank_token` | `enrollment_id` (SET NULL) | Sin políticas públicas — solo service role (Edge Function `public-enrollment`) | ✅ Definida (`20260317100000`) · Idempotencia de pagos por `session_token` (UUID almacenado en `localStorage`). Cuando se integre Transbank: `transbank_token` almacena el token de Webpay y `status` refleja el resultado. |
| `public_enrollment_throttle` | M6 - Matrí. | `id` (bigserial), `ip`, `action`, `created_at` | Ninguna | Sin políticas públicas — solo service role (Edge Function `public-enrollment`) | ✅ Definida (`20260603120000`) · **Spec 0010 (S1).** Rate-limiting server-side cero-deps: una fila por request de mutación; la EF cuenta por `(ip, action)` en ventana deslizante (10 req / 10 min) y responde `429` al exceder. Índice `(ip, action, created_at)`. Limpieza vía `cleanup_public_enrollment_throttle()`. |
| `professional_pre_registrations`| M6 - Matrí. | `id`, `temp_user_id`, `branch_id`, `requested_license_class`, `convalidates_simultaneously` (BOOL), `registration_channel` ('online'\|'presencial'), `notes`, `psych_test_answers` (JSONB, array 81 bool), `psych_test_status` ('not_started'\|'completed'), `psych_test_result` (null\|'fit'\|'unfit'), `psych_test_completed_at` (TIMESTAMPTZ), `psych_evaluated_by` (INT FK users), `psych_evaluated_at` (TIMESTAMPTZ), `psych_rejection_reason` (TEXT), `birth_date` (DATE), `gender` (CHAR(1)), `address` (TEXT), `status` ('pending_review'\|'approved'\|'enrolled'\|'expired'\|'rejected') | `temp_user_id`, `branch_id`, `converted_enrollment_id`, `psych_evaluated_by` | Admin: CRUD, Sec: CRUD, Stu: R (suyas) | ✅ Definida · `20260319100000`: añadidos `psych_test_answers` (JSONB) y `psych_test_completed_at`. · `20260320000000`: añadidos `branch_id`, `requested_license_class`, `convalidates_simultaneously`, `registration_channel`, `notes`. · `20260407000001`: añadidos `psych_evaluated_by` (FK users — quien evaluó), `psych_evaluated_at` y `psych_rejection_reason`. · `20260408000001`: añadidos `birth_date` y `gender` — capturados en el formulario público y guardados en la pre-inscripción para que el admin no los repita al completar matrícula. |
| `enrollments` | M6 - Matrí. | `id`, `number`, `current_step` (1-6), `payment_mode` ('total'\|'partial') — ⚠️ corregido 2026-07-10 (Spec 0026): el índice documentaba 'deposit', pero el valor real usado en producción es 'partial' (verificado contra 44 enrollments reales), `license_group` ('class_b'\|'professional'), `status` ('draft'\|'pending_payment'\|'active'\|'inactive'\|'completed'\|'cancelled'), `registration_channel` ('presential'\|'online'), `certificate_enabled` (BOOL, false), `certificate_b_pdf_url` (TEXT, null hasta generar), `certificate_professional_pdf_url` (TEXT, null hasta generar), `license_pdf_url` (TEXT, **legacy** — ya no se escribe), `license_initial_url` (TEXT, null hasta generar — carnet 6 clases/amarillo), `license_full_url` (TEXT, null hasta generar — carnet 12 clases/verde), `theory_cycle_id` (INT, null — ciclo teórico asignado) | `student_id`, `course_id`, `branch_id`, `sence_code_id`, `promotion_course_id`, `registered_by`, `theory_cycle_id`→class_b_theory_cycles | Admin: CRUD, Sec: CRUD, Inst: R, Stu: R (self) | ✅ Definida · Fix `20260312100000`: UNIQUE(`number`, `branch_id`, `license_group`). · **`20260630000000` (Spec 0001-m):** `theory_cycle_id` — asignado automáticamente por trigger `trg_assign_theory_cycle` al activar una matrícula Clase B (RF-04/05/06). · Fix `20260317150000`: `chk_enrollment_number` actualizado. · **`20260412000001`:** `certificate_enabled` pasa a `true` cuando el trigger `trg_enable_certificate_b` detecta que la **clase práctica #12** fue completada. · **`20260413000000`:** añadida `certificate_professional_pdf_url` (TEXT) — path relativo del PDF de certificado Clase Profesional en bucket 'documents'. · **`20260501000001`:** añadida `license_pdf_url` (TEXT) — path relativo del PDF de carnet Clase B en bucket `documents/student-licenses/`; generado por EF `generate-student-license-pdf`. · **`20260621000001` (fix-019-m):** carnet dual — `license_initial_url` (6 clases, fondo amarillo) y `license_full_url` (12 clases, fondo verde) reemplazan a `license_pdf_url` (que queda legacy, backfilled a `license_initial_url`). La EF recibe `variant: 'initial'\|'full'` y escribe la columna correspondiente; ambos carnets coexisten. |
| `student_documents` | M6 - Matrí. | `id`, `type` | `enrollment_id`, `reviewed_by`; **UNIQUE(`enrollment_id`,`type`)** | Admin: CRUD · Sec: CRUD (sede propia vía `branch_visible` en enrollment) · Inst: R (solo alumnos con `class_b_sessions` asignadas) · Stu: CR (self) · Fix `20260310140000`: DELETE incluye secretary · **Fix `20260413000002`: SELECT acotado — Sec filtra por sede, Inst solo sus alumnos** · **Fix `20260723000000` (H-028): UPDATE ahora sí incluye secretary (sede propia) — antes solo admin/student, bloqueaba upsert de matrícula Profesional con 403** | ✅ Definida · Fix `20260317140000`: fotos subidas en flujo público se insertan vía Edge Function (service role) desde ruta temporal `public-uploads/carnet/{sessionToken}` tras crear el enrollment · **`20260413000001`: `storage_url` ahora almacena path relativo** (ej: `students/42/id_photo`), no URL pública. |
| `digital_contracts` | M6 - Matrí. | `id`, `content_hash`, `signed_contract_url` (TEXT, null — path relativo del PDF firmado escaneado; solo para flujo online) | `enrollment_id` (UNIQUE) | Admin: CRUD · Sec: CRUD (sede propia vía `branch_visible` en enrollment) · Stu: CR (self) · Fix `20260310140000`: DELETE incluye secretary · Fix `20260313130000`: UPDATE incluye secretary (necesario para upsert con `onConflict`) · **Fix `20260413000002`: SELECT acotado — Sec filtra por sede vía enrollment** | ✅ Definida · `20260404120000`: eliminado `student_id` redundante. · **`20260413000001`: `file_url` almacena path relativo** (ej: `contracts/42/contract.pdf`). · **`20260501000002`: añadida `signed_contract_url`** — path relativo del contrato físicamente firmado. `null` en flujo online hasta que se suba; en flujo presencial `file_url` ya es el firmado. |
| `certificate_issuance_log` | M6 - Matrí. | `id`, `action` | `certificate_id`, `user_id` | Admin: CRUD, Sec: R | ✅ Definida |
| `school_documents` | M6 - Matrí. | `id`, `type` | `branch_id`, `uploaded_by` | Admin: CRUD, Sec: CR | ✅ Definida |
| `document_templates` | M6 - Matrí. | `id`, `name` | `updated_by` | Admin: CRUD, Sec: R, Stu: R, Inst: R | ✅ Definida |
| `vehicles` | M7 - Flota | `id`, `license_plate` (UNIQUE NOT NULL), `both_branches` (BOOL, def false) | `branch_id` | Admin: CRUD, Sec: **CRU por sede** (`insert`/`update` acotado a su propia sede, nunca `both_branches=true` — spec 0004-m; antes admin-only pese a documentar "Sec: CRUD"), Inst: R | ✅ Definida · `20260730100000` (spec 0004-m): columna `both_branches` + RLS `insert_vehicles`/`update_vehicles` habilitada para secretary |
| `vehicle_documents` | M7 - Flota | `id`, `type` | `vehicle_id` | Admin: CRUD, Sec: CRUD | ✅ Definida |
| `maintenance_records` | M7 - Flota | `id`, `type` | `vehicle_id`, `registered_by` | Admin: CRUD, Sec: CRUD | ✅ Definida |
| `tasks` | M8 - Tareas | `id` (UUID), `branch_id`, `from_user_id`, `from_role` (`admin`\|`secretary`), `to_user_id`, `to_role` (`admin`\|`secretary`\|`instructor`), `type` (`task`\|`observation`\|`question`), `subject`, `body`, `status` (`pending`\|`in_progress`\|`completed`\|`seen`), `due_date` (solo type=task), `completed_at`, `seen_at`, `seen_by`, `created_at`, `updated_at`, `deleted_at` | `branch_id`→branches, `from_user_id`→users, `to_user_id`→users, `seen_by`→users · constraints: `role_matrix` (admin→{sec,inst}, sec→{admin,inst}), `due_date_only_for_tasks` | Admin: SELECT (branch_visible), INSERT/UPDATE (branch_visible), DELETE (admin). Sec: SELECT (from=me OR to=me), INSERT (from_role=secretary, to_role in admin/instructor, misma sede), UPDATE (from=me OR to=me). Inst: SELECT (to=me), UPDATE (to=me). Soft delete vía UPDATE.deleted_at | ✅ Definida — `20260518000000` · Realtime habilitado (publicación supabase_realtime) · Reemplaza `secretary_observations` |
| `task_replies` | M8 - Tareas | `id` (UUID), `task_id`, `from_user_id`, `body`, `created_at` | `task_id`→tasks (ON DELETE CASCADE), `from_user_id`→users | Admin/Sec: SELECT (si puede ver la task padre), INSERT (si participante y task.status≠completed). Inst: INSERT solo en type=question donde to_user_id=me. DELETE: solo admin. Sin UPDATE (replies inmutables). | ✅ Definida — `20260518000000` |
| `school_schedules` | M8 - Admin | `id`, `branch_id` | `branch_id` | Admin: CRUD, Sec: R | ✅ Definida |
| `class_book` | M9 - Calidad| `id`, `period`, `sence_code` (TEXT), `horario` (TEXT) | `branch_id`, `promotion_course_id`, `generated_by`, `closed_by`, `sence_code_updated_by` | Admin: CRUD, Sec: CRUD | ✅ Definida · `20260405100000`: añadidos `sence_code` (código SENCE autorizado) y `horario` (texto libre). Auto-insert para promotion_courses existentes sin registro. · `20260801130000`: añadidos `sence_code_updated_by`/`sence_code_updated_at` (fix-098-m) — auditoría de quién cambió el código SENCE y cuándo; sigue editable con el libro cerrado (decisión explícita del owner). |
| `disciplinary_notes` | M10 - Reglas| `id`, `student_id` | `student_id`, `recorded_by` | Admin: CRUD, Sec: CRUD, Stu: R (suyas) | ✅ Definida |
| `pricing_seasons` | M10 - Reglas| `id`, `name` | `created_by` | Admin: CRUD, Sec: R | ✅ Definida |
| `certificate_batches` | M10 - Reglas| `id`, `batch_code` | `branch_id`, `received_by` | Admin: CRUD, Sec: R | ✅ Definida |
| `certificates` | M10 - Reglas| `id`, `folio` | `batch_id`, `enrollment_id`, `student_id`, `issued_by` | Admin: CRUD, Sec: CRUD, Stu: R (self) | ✅ Definida |
| `student_surveys` | M15 - Calidad| `id`, `obtained_license`, `satisfaction_rating` | `enrollment_id` | Admin: R, Sec: R | ✅ Definida (`20260408000000`) |
| `professional_weekly_signatures` | M5 - Prof. | `id`, `week_start_date` (DATE, siempre lunes), `signed_at`, `notes` | `promotion_course_id` (CASCADE), `enrollment_id` (CASCADE), `recorded_by` · UNIQUE(`enrollment_id`, `week_start_date`) | Admin: CRUD, Sec: CRUD, Inst: R, Stu: R (suyas vía enrollment) | ✅ Definida (`20260403100000`) |
| `website_config` | M6 - Matrí. | `id`, `branch_id`, `config` (JSONB) | `branch_id` (UNIQUE FK branches) · `config->courses[*].course_id` lógica → `courses(id)` validada por trigger | PUBLIC: SELECT · Admin: CRUD · Sec: CRUD (sede propia vía `branch_visible`) | ✅ Definida (`20260522000000`) · **`20260523000000` (Spec 0004):** shape de `config.courses[]` refactorizado a `{course_id, description, priceNote, duration, includes, highlighted, badge, priceOverride, displayOrder}`. FK lógica obligatoria validada por trigger `trg_validate_website_config_courses_fk`. Datos legacy vaciados a `[]` en la misma migración. |

## Vistas (security_invoker = true)

| Vista | Dominio | Descripción | Roles con acceso efectivo |
|-------|---------|-------------|--------------------------|
| `v_student_progress_b` | M4 - Acad. B | Progreso prácticas (0-12) `completed_practices`/`pct_practices`/`last_practice_session` por matrícula Clase B. **`20260630000000` (Spec 0001-m): eliminada `pct_theory_attendance`** — la asistencia teórica ya no existe. | Admin, Sec, Inst (propias), Stu (propia) |
| `v_professional_attendance` | M5 - Prof. | Semáforo `green`/`yellow`/`red` de asistencia por matrícula profesional (RF-070) | Admin, Sec, Stu (propia) |
| `v_dms_student_documents` | M6 - Matrí. | Documentos del alumno unificados (`student_documents` + `digital_contracts`) | Admin, Sec, Stu (propios) |
| `v_class_b_schedule_availability` | M4 - Acad. B | **Slots de 45 min (disponibles y ocupados)** por instructor+vehículo en las próximas 4 semanas. Columna `slot_status TEXT ('available'\|'occupied')` indica disponibilidad. Horarios derivados de `courses.schedule_days`/`schedule_blocks` (cada elemento del JSONB es un slot exacto, no un rango). NO filtra los slots ocupados, los expone con `slot_status='occupied'` para que la UI los muestre en gris. Usar para agenda de matrícula (RF-046). **`20260513000001`:** Vista recreada — ya no usa `generate_series` de 45 min; expande directamente los slots del JSONB a los días operativos de las próximas 4 semanas. **`20260730100000` (spec 0004-m):** un instructor `both_branches=true` genera filas para las dos sedes (join de `course_slots` ya no ancla solo a su sede); el vehículo asignado debe cubrir la sede del slot (`v.branch_id = cs.branch_id OR v.both_branches`) — si su vehículo no es `both_branches`, la sede no cubierta queda **sin filas** (no "occupied", ausente). Los `NOT EXISTS` de conflicto siguen siendo globales por `instructor_id`/`vehicle_id` sin filtro de sede (sin cambios): un instructor u vehículo ocupado en una sede ya bloqueaba el mismo horario en la otra. | Admin, Sec (acceso completo) · Inst (solo sí mismo) · Stu: sin acceso (ver nota) |

> **Nota `v_class_b_schedule_availability`:** El rol `student` no puede ver `instructors` ni `vehicles` según sus policies actuales, por lo que la vista devuelve vacío si la consulta un alumno. Si se requiere self-service de selección de horario, implementar un RPC `SECURITY DEFINER` específico.

## Edge Functions (`supabase/functions/`)

| Función | Ubicación | Invocación | Descripción |
|---------|-----------|------------|-------------|
| `generate-contract-pdf` | `supabase/functions/generate-contract-pdf/index.ts` | `supabase.functions.invoke('generate-contract-pdf', { body: { enrollment_id } })` | Genera PDF de contrato de matrícula (RF-083). Lee enrollment+student+course+branch, construye HTML con cláusulas legales, renderiza a PDF (builder interno sin deps externas), sube a Storage bucket `documents` path `contracts/{id}/`, upsert en `digital_contracts` con content_hash SHA-256. Retorna `{ pdfUrl }`. Usa `SUPABASE_SERVICE_ROLE_KEY` (admin). |
| `create-secretary` | `supabase/functions/create-secretary/index.ts` | `supabase.functions.invoke('create-secretary', { body: { ... } })` | Crea secretaria en Auth + `users`. Valida caller admin/secretary, crea auth user con password = RUT sin DV, INSERT en `users` con `role_id` secretary y `first_login=true`. Rollback: borra auth user si INSERT falla. |
| `update-secretary` | `supabase/functions/update-secretary/index.ts` | `supabase.functions.invoke('update-secretary', { body: { id, ... } })` | Actualiza secretaria. Detecta cambio de email → `updateUserById` en Auth + UPDATE en `users`. Payload parcial. |
| `create-instructor` | `supabase/functions/create-instructor/index.ts` | `supabase.functions.invoke('create-instructor', { body: { ... } })` | Crea instructor en Auth + `users` + `instructors`. Valida caller admin/secretary, valida licencia no expirada, crea auth user con password = RUT sin DV, INSERT en `users` (role instructor), INSERT en `instructors` (tipo, licencia), opcionalmente INSERT en `vehicle_assignments`. Rollback cascado: borra instructor → users → auth si falla. |
| `update-instructor` | `supabase/functions/update-instructor/index.ts` | `supabase.functions.invoke('update-instructor', { body: { id, ... } })` | Actualiza instructor. Detecta cambio de email → Auth sync. UPDATE en `users` + `instructors` (recomputa `license_status`). Gestiona cambio de vehículo: cierra asignación anterior (`end_date=now`), crea nueva en `vehicle_assignments`. |
| `auto-create-next-promotions` | `supabase/functions/auto-create-next-promotions/index.ts` | pg_cron → `net.http_post` (migración `20260807090000_auto_create_next_promotions_cron.sql`, diario `0 6 * * *`, DESPUÉS de `auto_transition_promotion_status()` en el mismo horario) | 0002-m. Garantiza colchón de 1 `professional_promotions` `in_progress` + 2 `planned` (branch_id=2 fijo) hacia adelante — no solo "la siguiente". Ancla la cadencia (+14 días) en `MAX(start_date)` existente; `code` en `MAX(code::int)+1` (fallback `start_date='2026-07-27'`/`code=275` solo si la tabla está vacía, no se espera en producción). Por cada promoción que falte: fetchea feriados del año vía `_shared/holidays.ts` (`fetchHolidaysForYears`, puerto Deno de `fetchHolidaysForYears` de `promociones.facade.ts`), calcula `end_date` con `computePromotionEndDate()` (puerto de `core/utils/promotion-end-date.utils.ts` — mismo algoritmo, recuperación de feriados AC6), INSERT `professional_promotions`, y por cada curso `type='professional' AND is_convalidation=false`: INSERT `promotion_courses` (dispara `generate_sessions_from_promotion()`, por eso `end_date` debe estar correcto antes) + INSERT `class_book` explícito (`status='draft'`, no depende de los 2 puntos de creación perezosa existentes). Cancela sesiones que caen en feriados del rango extendido. Idempotente por `start_date` (AC-E1): si ya existe, no duplica, la cadena avanza igual. Usa `SUPABASE_SERVICE_ROLE_KEY` (bypassa RLS). |
| `public-enrollment` | `supabase/functions/public-enrollment/index.ts` | `supabase.functions.invoke('public-enrollment', { body: { action: '...' } })` | Matrícula pública (sin auth). Actions: `load-instructors`, `load-schedule` (filtra `slot_holds` de otras sesiones como ocupados, acepta `sessionToken`), `reserve-slots` (crea/reemplaza holds TTL 20 min), `release-slots` (libera holds al retroceder), `submit-clase-b` (idempotente vía `payment_attempts.session_token`; acepta `carnetStoragePath` opcional para mover foto desde ruta temporal a `students/{id}/id_photo` + registrar en `student_documents`), `submit-pre-inscription`, `initiate-payment` (crea enrollment `pending_payment` + class_b_sessions `reserved` + draft_snapshot en BD incluyendo `carnetStoragePath`; sets `base_price`, `pending_balance`, `total_paid=0`, `payment_status='pending'` en enrollment; inicia transacción Webpay Plus vía REST; retorna `{webpayUrl, webpayToken}`), `confirm-payment` (recibe `tokenWs` del return_url, llama `webpayCommit`, valida `response_code===0 && status==='AUTHORIZED'`, activa enrollment + actualiza `total_paid`/`pending_balance`/`payment_status`, activa sesiones, genera número matrícula, inserta registro en `payments` (type='online', card_amount), mueve foto carnet desde ruta temporal del snapshot, libera slot_holds; retorna respuesta enriquecida con `branchName`, `courseName`, `amountPaid`, `courseBasePrice`, `pendingBalance`, `sessionCount`, `paymentMode`, `studentName`). Usa `SERVICE_ROLE_KEY` para bypass RLS. Transbank: env `TRANSBANK_ENV` (`integration`\|`production`), credenciales en `TRANSBANK_COMMERCE_CODE`/`TRANSBANK_API_KEY`; en integration usa credenciales públicas predefinidas. **Foto carnet (flujo 2 etapas):** cliente anón sube a `documents/public-uploads/carnet/{sessionToken}` (política `20260317140000`); `carnetStoragePath` se guarda en `draft_snapshot` durante `initiate-payment`; la EF mueve vía `storage.move()` a `documents/students/{enrollmentId}/id_photo` e inserta en `student_documents` (tipo `id_photo`, status `approved`) durante `confirm-payment`. |

## Funciones SQL

| Función | Migración | Programación | Descripción |
|---------|-----------|--------------|-------------|
| `auto_transition_promotion_status()` | `20260330100000` | pg_cron: `0 6 * * *` (diario 06:00 UTC ≈ 03:00 CLT) | Transiciona `professional_promotions`: `planned→in_progress` cuando `start_date <= CURRENT_DATE AND end_date >= CURRENT_DATE`; `in_progress→finished` cuando `end_date < CURRENT_DATE`. Nunca toca `cancelled`. Procesa `finished` primero para cubrir el edge-case `start_date == end_date`. `SECURITY DEFINER`. |
| `mark_end_of_day_class_b_absences()` | Definida en `20260705000000` → redefinida en `20260707000000` (ambas perdidas, nunca versionadas) → **recuperada y corregida en `20260709120000_recover_class_b_absence_penalty_functions.sql`** | pg_cron: `0 1 * * *` (diario 01:00 UTC ≈ 21:00 CLT invierno, fin de jornada) | RF-053. Recorre `class_b_sessions` en `status='scheduled'` cuya fecha (America/Santiago) sea hoy o anterior (`ORDER BY enrollment_id, class_number` — determinismo, no afecta corrección) y las marca `status='no_show'`, insertando `class_b_practice_attendance(status='absent')` por alumno (`ON CONFLICT DO NOTHING`, idempotente). Por cada matrícula afectada invoca `apply_class_b_absence_penalty()`. Cada fila corre en su propio bloque `BEGIN/EXCEPTION` — una excepción en una fila no aborta el resto del batch. **Fix `20260709120000` (fix-028-m):** el `UPDATE ... status='no_show'` ahora exige `AND status='scheduled'` — el cursor del loop es un snapshot tomado al inicio; sin este guard, una fila cancelada por `apply_class_b_absence_penalty()` en una iteración anterior del mismo run quedaba sobreescrita de vuelta a `no_show` cuando el loop llegaba a su turno. `SECURITY DEFINER`. |
| `apply_class_b_absence_penalty(p_enrollment_id INT)` | Definida en `20260705000000` → corregida en `20260706000000` → redefinida en `20260707000000` (todas perdidas, nunca versionadas) → **recuperada y corregida en `20260709120000_recover_class_b_absence_penalty_functions.sql`** | Llamada por `mark_end_of_day_class_b_absences()` y por `AsistenciaClaseBFacade.markAttendance()` vía `supabase.rpc()` | RF-053: 2 inasistencias no justificadas **consecutivas** (class_number adyacente N, N+1) = pérdida de agenda. La detección (`EXISTS`) y la cancelación (`UPDATE ... status='cancelled'`) ocurren en **una sola sentencia atómica**; sin filtro de fecha — cualquier sesión `'scheduled'` de la matrícula se cancela, sin importar si su fecha ya pasó. **Fix `20260709120000` (fix-028-m):** la cancelación ahora acota `AND class_number BETWEEN 1 AND 12` — nunca cancela (ni depende de) filas fuera del rango válido de una matrícula Clase B. Retorna `INT` con la cantidad cancelada (`0` si no aplica). `SECURITY DEFINER`. |

> ⚠️ **Nota de gobernanza (resuelta parcialmente en fix-028-m):** las migraciones `20260705000000`, `20260706000000` y `20260707000000` que originalmente crearon y corrigieron estas dos funciones se aplicaron directamente vía SQL Editor de Supabase y los archivos locales nunca llegaron a commitearse — se perdieron del repo sin dejar rastro en git. `20260709120000` recupera ambas funciones completas (`CREATE OR REPLACE`, idempotente) a partir del código real vigente en producción (confirmado por el dueño 2026-07-09) y corrige dos bugs adicionales encontrados en la revisión (ver descripciones arriba). **Nunca alterar la BD desde el Dashboard sin además guardar el archivo de migración correspondiente en `supabase/migrations/` y comitearlo.**
| `cleanup_expired_public_enrollment()` | `20260317100000` + actualizada en `20260317120000` | Manual o pg_cron | Limpia `slot_holds` expirados, marca `payment_attempts` pendientes vencidos como `'failed'`, y cancela enrollments `pending_payment` cuya ventana de pago venció (`UPDATE enrollments SET status='cancelled' WHERE id IN (SELECT enrollment_id FROM payment_attempts WHERE status='failed')`). `SECURITY DEFINER`. |
| `cleanup_public_enrollment_throttle()` | `20260603120000` | Manual o pg_cron | **Spec 0010 (S1).** Borra filas de `public_enrollment_throttle` con `created_at < now() - interval '1 day'` (fuera de cualquier ventana de rate-limit). `SECURITY DEFINER`. |
| `cleanup_expired_drafts()` | `20260313140000` → `20260618120000` → `20260618140000` → **`20260622000001_drop_biometric_records.sql`** | pg_cron: `0 3 * * *` (diario 3AM UTC) | Limpia enrollments en `status='draft'` con `expires_at < NOW()`. Cascade: `route_incidents→NULL`, `class_b_practice_attendance→DELETE`, `class_b_sessions→DELETE`, `license_validations→DELETE`, `discount_applications→DELETE`, `payments→DELETE`, `student_documents→DELETE`, `digital_contracts→DELETE`, `enrollments→DELETE`. También elimina `students` (si no tienen otras matrículas) y `users` (si `supabase_uid IS NULL` Y no existen en `instructors`) creados durante el wizard que quedaron huérfanos. Guards: admins/secretarias siempre tienen `supabase_uid` activo → protegidos; instructores sin Auth → protegidos por NOT EXISTS en `instructors`. Por diseño, un draft nunca tiene `total_paid > 0`. Retorna conteo de enrollments eliminados. |
| `confirm_enrollment_with_payment(p_enrollment_id, p_payment_method, p_total_amount, p_discount_id, p_discount_amount, p_registered_by, p_is_deposit)` | **`20260618130000_rpc_confirm_enrollment_with_payment.sql`** | Llamada desde `EnrollmentFacade.confirmWithPayment()` vía `supabase.rpc()` | Consolida en una sola transacción atómica lo que antes eran dos llamadas independientes (`recordPayment` + `confirmEnrollment`). Orden: (1) SELECT enrollment FOR UPDATE (bloqueo anti-doble-clic, valida `status='draft'`); (2) `get_next_enrollment_number(course_id)`; (3) DELETE idempotente de payments/discount_applications previos; (4) INSERT payment; (5) INSERT discount_application si aplica; (6) UPDATE enrollment → `status='active'`, number, totales, `expires_at=NULL`; (7) UPDATE class_b_sessions `reserved→scheduled`. Retorna `TEXT` con número de matrícula. Lanza EXCEPTION si enrollment no existe o ya fue procesado. **El pago (paso 4) se inserta ANTES de asignar `number` (paso 6) — por diseño, no reordenar**: `check_payment_within_pending_balance()` (fix-057-m/H-024) depende de que `pending_balance` siga `NULL` en ese momento para no bloquear el pago de confirmación; consumidores de `audit_log.detail` para `payments` deben tolerar `enrollments.number` aún NULL en ese instante (ver `log_change()` (13)/fix-145-m). `SECURITY DEFINER`. |
| `get_student_payment_status(p_supabase_uid TEXT)` | `20260416000001_rpc_get_student_payment_status.sql` | Llamada desde Edge Function `student-payment` acción `load-enrollment-status` vía `supabase.rpc()` | Consolida 5 round-trips en 1 transacción PostgreSQL. Busca user→student→enrollment (activo, class_b, partial, saldo>0) y en paralelo: sede, curso, instructor (primera sesión no cancelada), conteo de sesiones, historial de pagos. Retorna JSONB con `hasPaymentPending`, `enrollment`, `instructor`, `payments`, `studentName`, `existingSessionCount`. Si no encuentra usuario/alumno retorna `{ error, status }`. Solo accesible por `service_role` (REVOKE de PUBLIC/anon/authenticated). `SECURITY DEFINER`, `STABLE`. |
| `trg_enrollment_validation_fn()` | `20260309130000_allow_draft_status_for_professional.sql` | Trigger BEFORE INSERT OR UPDATE en `enrollments` | Valida reglas de negocio: Clase B no puede tener `promotion_course_id`; cursos `professional` y SENCE deben ser `in_person`. **Desde esta migración, `status='draft'` está permitido para todos los tipos de curso** (antes restringido solo a `class_b`). |
| `auth_can_enroll_course_type(p_course_id INT)` | `20260310100000_enrollment_branch_course_restriction.sql` | Usada en RLS de `enrollments` (INSERT/UPDATE) | Restringe el tipo de curso según rol y sucursal: admin → sin límite; secretary branch 2 (Conductores Chillán) → todo; secretary branch 1 (Autoescuela Chillán) → solo `class_b` y `singular` (no `professional`). |
| `get_next_enrollment_number(p_course_id INT)` | `20260311100000_class_b_courses_branch2_and_enrollment_number_fix.sql` (actualiza `20260310110000`) | Llamada desde `EnrollmentFacade.confirmEnrollment()` vía RPC | Devuelve el siguiente número secuencial de matrícula **separado por (sede × tipo de licencia)**: Clase B Autoescuela Chillán, Clase B Conductores Chillán y Profesional tienen contadores independientes. Los drafts sin confirmar (`status = 'draft'`) no consumen número. Formato: 4 dígitos (0001-m–9999), 5 desde 10000. `SECURITY DEFINER`. |
| `set_enrollment_license_group()` | `20260312100000_fix_enrollment_number_unique_constraint.sql` | Trigger `BEFORE INSERT` en `enrollments` | Popula `enrollments.license_group` automáticamente a partir de `courses.license_class` del curso asociado. Evita que el consumidor tenga que calcularlo manualmente. |
| `log_change()` | `20260301000008` → `20260323100000` → `20260323120000` → `20260323130000` → `20260614201000` → `20260801120000` → `20260801140000` → `20260802120000` → `20260802130000` → `20260802150000` → `20260802160000` → `20260805090000` → **`20260809100000`** | Trigger AFTER INSERT/UPDATE/DELETE en 23+ tablas (16 de `20260323110000` + 3 de `20260614160000`) | Registra operaciones en `audit_log`. **Evolución:** (1) Original: `user_id=NULL`, detalle genérico. (2) `20260323100000`: captura `user_id` via `auth.uid()`. (3) `20260323120000`: resuelve `user_id` desde header HTTP `x-audit-user-id` con fallback a `auth.uid()`. (4) `20260323130000`: diff legible en español (`[Nombre Entidad] Etiqueta: antes → después`), etiquetas en español con fallback `initcap(snake_case)`, resolución de `user_id` con skip de admins. (5) `20260614201000`: reimplementación con `entity_label` por tabla (`enrollments`, `payments`, `standalone_course_enrollments`, `special_service_sales`, `class_b_sessions`, `users`, `students`, `professional_pre_registrations`) + `branch_id` en `audit_log` — **regresión no intencional**: perdió el skip de admins y la resolución por header `x-audit-user-id` de `20260323130000`, y además declaró la variable de trabajo `v_src` como `record` en vez de `jsonb`, usando `v_src->>'columna'` — el operador `->>` no existe para `record` en Postgres, así que **la función rompía en la primera línea para cualquier tabla/operación** y el `EXCEPTION WHEN OTHERS` la dejaba fallar en silencio (solo `RAISE WARNING`, sin insertar). Desde el 2026-06-14 hasta el fix de abajo, `audit_log` **no registró ninguna acción nueva**. (6) `20260801120000` (**fix-097-m**): agrega `entity_label` legible para las tablas que quedaban en el fallback `id=X` — `student_documents`, `certificates`, `vehicles`, `vehicle_documents`, `maintenance_records`, `class_b_theory_sessions`, `promotion_courses`, `class_book`, `professional_theory_sessions`, `professional_practice_sessions`, `professional_module_grades`. (7) `20260801140000` (**fix-099-m**): restaura la lectura del header `x-audit-user-id` (prioridad 1, antes de `registered_by`) y corrige `v_src` de `record` a `jsonb` (`to_jsonb(OLD)`/`to_jsonb(NEW)`) — la función vuelve a insertar en `audit_log`. Verificado con Supabase local + Docker (`docker exec supabase_db_Autoescuela psql`). (8) `20260802120000` (**fix-102-m**): el diff de UPDATE reemplaza el `CASE` hardcodeado de 8 columnas por `audit_humanize_column()` (diccionario ~90 columnas + fallback genérico) y agrega `audit_resolve_display_value()` para resolver IDs de FK (`promotion_course_id`, `course_id`, `instructor_id`, etc.) y enums (`current_step`) a texto legible en vez de mostrar el ID crudo de Supabase. (9) `20260802130000` (**fix-103-m**): corrige el Fallback 3 de resolución de `v_user_id` — casteaba `request.jwt.claim.sub` (UUID de `auth.uid()`) directo a `INT`, lo que siempre fallaba silenciosamente; ahora resuelve por `supabase_uid` igual que `auth_user_id()`. Antes de este fix, cualquier acción de una sesión autenticada normal sobre una tabla sin `registered_by` (`users`, `students`, `vehicles`, `vehicle_documents`, `promotion_courses`, `website_config`) quedaba atribuida a `user_id=NULL` ("Sistema / Online" en el frontend) en vez del usuario real. (10) `20260802150000` (**fix-106-m**): las ramas de `entity_label` de `student_documents`/`vehicle_documents`/`maintenance_records` (usadas por INSERT/DELETE) ahora traducen la columna `type` vía `audit_humanize_enum_value()` en vez de mostrarla cruda (ej. `"cedula_identidad"` → `"Cédula de Identidad"`) — antes de este fix, `audit_humanize_enum_value()` solo se invocaba desde el diff de UPDATE, nunca desde la construcción de `entity_label`. **⚠️ No verificado contra Supabase local en el entorno donde se escribió originalmente (8)/(9) (Docker Desktop no estaba corriendo) — (10) sí se verificó localmente tras levantar Docker.** (11) `20260802160000` (**fix-108-m**): el Fallback 3 de `v_user_id` en (9) seguía roto en peticiones reales — leía `current_setting('request.jwt.claim.sub')`, un GUC que **PostgREST nunca setea** en este stack (solo expone el JSON agregado `request.jwt.claims`); la "verificación" de (9) fue un fixture SQL que simulaba el GUC con `SET LOCAL`, nunca una petición HTTP real. Confirmado empíricamente contra Supabase local (JWT firmado a mano + `PATCH /rest/v1/users` real): `current_setting('request.jwt.claim.sub', true)` devuelve `NULL` siempre; `auth.uid()` sí resuelve correctamente en el mismo contexto. Ahora el Fallback 3 usa `auth.uid()` directo (mismo mecanismo que `auth_user_id()` en RLS). Ver `indices/DOMAIN-GOTCHAS.md` DG-049. Tablas sin rama explícita de `entity_label` siguen usando `id=X`. (12) `20260805090000` (fix-112-m): formatea timestamps/horas/fechas ISO crudos (`audit_format_timestamp_value()`) y resume `evaluation_checklist` ("N de M ítems marcados") en vez de mostrar el JSON crudo. (13) `20260809100000` (**fix-145-m**, QA de spec 0006-m): 4 causas raíz reproducidas y verificadas contra Supabase local antes del fix — a) agrega `SET search_path = public, pg_temp` (faltaba desde la regresión de (6)/fix-097-m, que dejó de calificar tablas; `recalculate_enrollment_balance()` (`trg_update_balance` en `payments`) SÍ tiene `SET search_path=''`, y cuando dispara `UPDATE enrollments` anida un `log_change()` que heredaba ese search_path vacío → `relation "students" does not exist`, la auditoría del recálculo de saldo se perdía en silencio); b) rama `payments`: usaba columnas `amount`/`method` que **nunca existieron** en la tabla (es `total_amount` + `cash_amount`/`transfer_amount`/`card_amount`/`voucher_amount`, sin columna de método unificada) → siempre mostraba "$0 (Desconocido)" para CUALQUIER pago; además `confirm_enrollment_with_payment()` inserta el pago (paso 5) antes de asignar `enrollments.number` (paso 7, por diseño — ver fila de `confirm_enrollment_with_payment` y fix-057-m/H-024) → `COALESCE(e.number, c.name)` (nombre del curso) reemplaza el `'?'` desnudo — se descartó usar `e.id` (el PK interno de Supabase) por no ser legible para quien lee el feed; c) `class_b_theory_sessions`: `ensure_theory_cycle()` (Spec 0001) autogenera las 6 clases de un ciclo seteando solo `cycle_id`/`class_number`/`class_date`, nunca `topic`/`scheduled_at` (modelo pre-Spec-0001) → entity_label caía en fallback `class_number`/`class_date` en vez de "Sesión teórica -" vacío; d) agrega `theory_cycle_id` al diccionario de `audit_humanize_column()`/`audit_resolve_display_value()` y silencia `supabase_uid` + las `*_url` de storage de `enrollments` (`license_initial_url`, `license_full_url`, `license_pdf_url`, `certificate_b_pdf_url`, `certificate_professional_pdf_url`) en `v_skip_fields`. `SECURITY DEFINER`. |
| `audit_humanize_column(p_key TEXT)` | `20260802120000_audit_log_humanize_columns_and_values.sql` (fix-102-m) → **`20260809100000`** (fix-145-m) | Llamada por `log_change()` en el diff de UPDATE | Traduce un nombre de columna de `audit_log.detail` a español (`current_step` → "Paso actual", `promotion_course_id` → "Curso de promoción", etc.). Diccionario de ~90 columnas conocidas de las tablas auditadas + fallback genérico `initcap(replace(col,'_',' '))` para columnas futuras no listadas (nunca vuelve a mostrar snake_case crudo). fix-145-m agrega `theory_cycle_id` → "Ciclo teórico". Editar esta función (no `log_change()` completa) es la forma recomendada de agregar una columna nueva al diccionario. `IMMUTABLE`. |
| `audit_resolve_display_value(p_column TEXT, p_value TEXT)` | `20260802120000_audit_log_humanize_columns_and_values.sql` (fix-102-m) → `20260802140000_audit_log_translate_boolean_enum_values.sql` (fix-104-m) → **`20260809100000`** (fix-145-m) | Llamada por `log_change()` en el diff de UPDATE | Resuelve el VALOR de una columna FK/enum a texto legible (ej. `promotion_course_id=29` → `"PC-A2-01 (Clase Profesional A2)"`, `current_step=3` → `"Documentos"`). Cubre FKs conocidas (`course_id`, `branch_id`, `instructor_id`, `lecturer_id`, `vehicle_id`, `student_id`, `enrollment_id`, `certificate_id`, `receipt_id`, `discount_id`, `service_id`, `sence_code_id`, `template_id`, `batch_id`, `role_id`, `theory_cycle_id` (fix-145-m: `class_b_theory_cycles` → `"Ciclo DD-MM-YYYY al DD-MM-YYYY"`, la tabla no tiene nombre/código propio), cualquier columna `*_by` vía `users`) y el enum `current_step` (1-6, pasos del wizard de matrícula). **fix-104-m:** cuando la columna no tiene regla propia, agrega dos fallbacks antes de rendirse — booleano (`true`/`false` → `"Sí"`/`"No"`) y `audit_humanize_enum_value()` (diccionario de ~110 valores de enum del esquema: `status`, `type`, `category`, etc.). **fix-145-m:** agrega `SET search_path = public, pg_temp` — sin esto, invocada anidada dentro de un caller con `search_path=''` (ver `log_change()` (13)), las tablas sin calificar (`courses`, `branches`, `instructors`, etc.) no resolvían, degradando silenciosamente al ID crudo. Devuelve `NULL` solo si nada aplica — el caller conserva el valor crudo. `STABLE`. |
| `audit_humanize_enum_value(p_value TEXT)` | `20260802140000_audit_log_translate_boolean_enum_values.sql` (fix-104-m) → **`20260802150000_audit_log_humanize_entity_label_types.sql`** (fix-106-m) | Llamada por `audit_resolve_display_value()` (diff de UPDATE) y por `log_change()` directamente (entity_label de `student_documents`/`vehicle_documents`/`maintenance_records`) | Traduce un valor de enum crudo (`draft`, `active`, `pending`, `scheduled`, `no_show`, etc.) a español. Diccionario de ~120 tokens: los enums documentados en las tablas auditadas (`enrollments.status`, `vehicles.status`, `payments.status`, `class_b_sessions.status`, categorías, etc.) **más los valores REALES de `student_documents.type` verificados contra el código de la app** (`cedula_identidad`, `licencia_conducir`, `hoja_vida_conductor`, `autorizacion_notarial`, `contrato`, `certificado_medico`, `certificado_antecedentes`, `id_photo` — fix-106-m: los del comentario original de la tabla, `national_id`/`driver_license`/etc., estaban obsoletos y nunca se usaron en código real, se conservan solo por compatibilidad). Devuelve `NULL` si el valor no está listado — **sin fallback de humanización genérica** (a diferencia de `audit_humanize_column()`): capitalizar una palabra en inglés no la traduce, así que un valor no cubierto se muestra crudo hasta que se agregue aquí. `IMMUTABLE`. |
| `recalc_instructor_monthly_hours(p_instructor_id, p_period)` | `20260509000001` | Llamada desde trigger `trg_class_b_sessions_monthly_hours` | Recuenta desde cero las `class_b_sessions` con `status='completed'` para el instructor+periodo dado (zona `America/Santiago`) y hace UPSERT en `instructor_monthly_hours`. Fórmula: `total_equivalent = practical_sessions × 0.75` (45 min/sesión). Si el recuento es 0, elimina la fila. `SECURITY DEFINER` para bypassear RLS de la tabla destino. |
| `trg_class_b_sessions_update_monthly_hours()` | `20260509000001` | Trigger `trg_class_b_sessions_monthly_hours` — AFTER INSERT OR UPDATE OR DELETE en `class_b_sessions` (FOR EACH ROW) | Detecta transiciones de/hacia `status='completed'` y llama `recalc_instructor_monthly_hours()`. En UPDATE también recalcula el instructor/periodo anterior si cambiaron. En DELETE recalcula si la sesión eliminada era `completed`. |
| `set_updated_at()` | `20260415000001` (creada) → reutilizada por `20260709003142` | Trigger `trg_class_b_sessions_updated_at` — BEFORE UPDATE en `class_b_sessions` (FOR EACH ROW) | Setea `NEW.updated_at = now()` en cada UPDATE. **Fix hotfix-012-m**: la tabla tenía `updated_at DEFAULT NOW()` pero ningún trigger la refrescaba — quedaba congelada en el valor del INSERT. Misma función ya usada por `professional_promotions` y `website_config`. |
| `prevent_concurrent_in_progress_class_b_sessions()` | `20260804120000` | Trigger `trg_prevent_concurrent_in_progress` — BEFORE UPDATE en `class_b_sessions` (FOR EACH ROW) | **Spec 0001-i (AC1, AC-E1).** Exclusión mutua: cuando `NEW.status='in_progress'` y `OLD.status` no lo era, rechaza el `UPDATE` (`RAISE EXCEPTION ... ERRCODE='P0001'`) si el mismo `instructor_id` ya tiene otra fila `in_progress` (excluyendo la propia). Global por instructor, sin filtro de sede — un instructor es una sola persona física. Cubre los 2 puntos de entrada existentes (`InstructorClasesFacade.startClass()` y `AsistenciaClaseBFacade.startClass()`) sin duplicar la validación en cada Facade — es la única garantía real, ya que un Facade no puede saber si el otro ya inició una clase para el mismo instructor. `SECURITY DEFINER`. |
| `prevent_double_booking_class_b_sessions()` | `20260811110000` | Trigger `trg_prevent_double_booking` — BEFORE INSERT OR UPDATE OF `instructor_id, scheduled_at, duration_min, status` en `class_b_sessions` (FOR EACH ROW) | **Fix 152-m.** Rechaza (`RAISE EXCEPTION ... ERRCODE='P0001'`) un `INSERT`/`UPDATE` si el `instructor_id` de `NEW` ya tiene otra fila no-`cancelled` cuyo rango `[scheduled_at, scheduled_at + duration_min)` se solapa con el de `NEW` (misma fórmula de solape que usa `v_class_b_schedule_availability`). Antes de este fix, la única protección era esa vista filtrando **al leer** — dos secretarias agendando casi simultáneo podían generar una colisión real de instructor a nivel de escritura. Complementa (no reemplaza) a `prevent_concurrent_in_progress_class_b_sessions()`, que cubre la exclusión mutua específica de `in_progress`. `SECURITY DEFINER`. |
| `validate_website_config_courses_fk()` | `20260523000000` | Trigger `trg_validate_website_config_courses_fk` — BEFORE INSERT OR UPDATE en `website_config` (FOR EACH ROW) | **Spec 0004.** Itera `config->'courses'` y valida por cada card: (a) `course_id` no null, (b) existe en `courses`, (c) `courses.branch_id = website_config.branch_id`, (d) `course_id` único dentro del array. Lanza `RAISE EXCEPTION` con mensaje específico en cada violación. `SECURITY DEFINER`. |
| `prevent_courses_delete_when_in_website_config()` | `20260523000000` | Trigger `trg_prevent_courses_delete_when_in_website_config` — BEFORE DELETE en `courses` (FOR EACH ROW) | **Spec 0004.** Cuenta refs a `OLD.id` en `website_config.config->'courses'`. Si hay ≥1, bloquea el DELETE con mensaje "No se puede eliminar: N card(s) de website_config referencian este curso. Quitá esas cards desde Configuración Web antes de eliminar el curso del catálogo." `SECURITY DEFINER`. |
| `ensure_theory_cycle(p_branch_id INT, p_ref_date DATE)` | `20260630000000` | Llamada por el trigger `trg_assign_theory_cycle` y por el backfill | **Spec 0001-m.** Devuelve (creando si no existe) el ciclo teórico de la sede para la fecha dada: calcula el lunes objetivo (RF-04: Lun–Mié → semana en curso; RF-05: Jue–Dom → semana siguiente) y, al crear, genera las **6 clases** en `class_b_theory_sessions` (`class_number` 1–6, `class_date` = lunes + [0,2,4,7,9,11]). `SECURITY DEFINER`, TZ implícita por `p_ref_date`. |
| `assign_theory_cycle()` | `20260630000000` | Trigger `trg_assign_theory_cycle` — BEFORE INSERT OR UPDATE OF status en `enrollments` (FOR EACH ROW) | **Spec 0001-m (RF-06).** Al pasar una matrícula Clase B a `active` con `theory_cycle_id` NULL, fija `NEW.theory_cycle_id = ensure_theory_cycle(branch_id, hoy America/Santiago)`. Cubre presencial, online y re-matrícula. `SECURITY DEFINER`. |
| `auto_transition_theory_cycle_status()` | `20260630000000` | pg_cron `auto-transition-theory-cycle-status`: `0 6 * * *` | **Spec 0001-m.** Marca `finished` los ciclos `active` cuyo `end_date < CURRENT_DATE`. `SECURITY DEFINER`. |
| `notify_class_b_completed()` | `20260710000000_notify_class_b_session_events.sql` → **extendida en `20260801100000_notify_secretary_class_b_completed.sql`** → **corregida en `20260810120000_fix148_notify_secretary_detail_and_actor.sql`** | Trigger `trg_notify_class_b_completed` — AFTER UPDATE OF status ON class_b_sessions (FOR EACH ROW) | **Spec 0026 (C1).** Notifica al alumno (`students.user_id` vía `enrollments.student_id`) cuando una clase práctica B pasa a `status='completed'` (`WHEN NEW.status='completed' AND OLD.status IS DISTINCT FROM 'completed'`). Mensaje "Clase N/6" o "N/12" (según `courses.is_reinforcement` — fix-148-m, antes fijo en `/12`), `reference_type='class_b'`. `SECURITY DEFINER` — el actor puede ser instructor, secretaría o admin (todos usan `AsistenciaClaseBFacade.finalizarClase()`), y el instructor no tiene permiso de INSERT en `notifications` vía RLS. `EXCEPTION WHEN OTHERS` absorbe errores sin abortar el UPDATE real. **Fix-091-m (ASG-b-044, 2026-08-01):** además notifica a **todas** las secretarias de la sede de la matrícula (`users` con `roles.name='secretary'` y `branch_id = enrollments.branch_id`), una notificación por clase completada (sin agregación), mismo `reference_type='class_b'`. **Fix-148-m (2026-08-10):** el bloque de secretaría **solo** se ejecuta si `auth_user_role() = 'instructor'` (evita que secretaría/admin reciba notificación de su propio cierre); mensaje ahora incluye matrícula y alumno: "Clase N/6 de matrícula #{number} (PrimerNombre ApellidoPaterno) completada por el instructor". |
| `notify_deposit_reminder()` | `20260710000000_notify_class_b_session_events.sql` → **corregida en `20260710000200_fix_deposit_reminder_payment_mode.sql`** | Trigger `trg_notify_deposit_reminder` — mismo evento que `notify_class_b_completed()`, `WHEN ... AND NEW.class_number = 6` | **Spec 0026 (D1, RF-018).** Al completarse la clase 6, avisa al alumno si su matrícula es `payment_mode='partial'` y `pending_balance > 0` que debe pagar antes de la clase 7. `reference_type='payment'`. **Fix `20260710000200`:** el guard original usaba `payment_mode='deposit'` (valor que nunca existe en producción — los reales son `'total'\|'partial'`, ver corrección arriba en `enrollments`); detectado en QA en vivo, el trigger nunca disparaba antes del fix. `SECURITY DEFINER`. |
| `notify_task_reply()` | `20260710000100_notify_task_events.sql` → **corregida en `20260710000300_fix_task_notifications_reference_id_type.sql`** | Trigger `trg_notify_task_reply` — AFTER INSERT ON task_replies (FOR EACH ROW) | **Spec 0026 (C2).** Notifica a la contraparte de una tarea (`tasks.from_user_id`/`to_user_id`) cuando la otra parte responde en el hilo — nunca a quien escribió. `reference_type='task'`, `reference_id=NULL`. **Fix `20260710000300`:** la versión original casteaba `tasks.id` (UUID) a texto e intentaba guardarlo en `notifications.reference_id` (columna INT) — fallaba en cada ejecución, atrapado silenciosamente por el `EXCEPTION WHEN OTHERS`; detectado en QA en vivo. `SECURITY DEFINER`. |
| `notify_task_completed()` | `20260710000100_notify_task_events.sql` → **corregida en `20260710000300_fix_task_notifications_reference_id_type.sql`** | Trigger `trg_notify_task_completed` — AFTER UPDATE OF status ON tasks (FOR EACH ROW), `WHEN NEW.status='completed' AND OLD.status IS DISTINCT FROM 'completed'` | **Spec 0026 (C2).** Notifica a la contraparte cuando una tarea se marca `completed`. Usa `auth_user_id()` (ya existente, `20260301000011`) para identificar al actor real que cerró la tarea y excluirlo del destinatario. Mismo fix de `reference_id=NULL` que `notify_task_reply()`. `SECURITY DEFINER`. |
| `notify_vehicle_document_expiry()` | `20260710010000_notify_vehicle_document_expiry.sql` | pg_cron `notify-vehicle-document-expiry`: `0 6 * * *` | **Spec 0027 (D3).** Recorre `vehicle_documents` cuyo `expiry_date` cae exactamente hoy o exactamente `advance_days` (de `alert_config`, tipo `document_expiry`, default 30) a futuro. Notifica al instructor con asignación activa (`vehicle_assignments.end_date IS NULL` → `instructors.user_id`, si existe) y a todos los admins activos. Un `INSERT` por documento×destinatario (sin agrupar). Cada documento en su propio bloque `EXCEPTION WHEN OTHERS` — un error no aborta el resto de la corrida. `reference_type='document_expiry'`, `reference_id=vehicle_documents.vehicle_id`. `SECURITY DEFINER`. Verificado con datos reales vía REST/RPC directo (5 notificaciones esperadas y generadas exactamente: 2 destinatarios × 2 documentos + 1 destinatario × 1 documento sin instructor asignado). |

> ⚠️ **Corrección de documentación (Spec 0027, 2026-07-10):** algunas filas de este documento referenciaban `vehicle_id → vehicles.vehicle_id` — esa columna no existe. La tabla `vehicles` solo tiene `id` como PK. Verificado contra `supabase/migrations/20260301000007_07_vehicles_and_fleet.sql`: todas las FKs reales apuntan a `vehicles(id)`. Si ves `vehicles.vehicle_id` en otra parte de este archivo, es un error de documentación heredado — el join correcto siempre es contra `vehicles.id`.

## Migraciones RLS adicionales

| Migración | Descripción |
|-----------|-------------|
| `20260314100000_public_enrollment_anon_rls.sql` | Policies SELECT anónimas para `branches` (todas) y `courses` (activas, no convalidación) para la vista de matrícula pública. |
| `20260315100000_enable_realtime_class_b_sessions.sql` | Habilita Supabase Realtime en `class_b_sessions` (`ALTER PUBLICATION supabase_realtime ADD TABLE`). Permite que secretarias/admin reciban actualizaciones en vivo de slots ocupados durante matrícula. |
| `20260624120000_rls_branch_scope_students_instructors.sql` | **Spec 0017.** Recrea `select_students` y `select_instructors` aplicando `branch_visible(<sede del user dueño>)` a la rama `secretary` (antes `IN ('admin','secretary')` sin filtro de sede → fuga multi-sede). Reutiliza `can_access_both_branches` (RF-013): `branch_visible` ya lo honra, así que la secretaria con grant ve todas las sedes. Ramas admin/instructor/student preservadas de `20260301000011`. `select_enrollments` y `select_users` SIN cambios (este último por fix-002). |
| `20260625120000_enable_realtime_users.sql` | **Spec 0017 / AC-E3.** Habilita Supabase Realtime en `users` (`ALTER PUBLICATION supabase_realtime ADD TABLE`, idempotente vía `pg_publication_tables`). Permite que `AuthFacade` refleje el otorgar/revocar del grant `can_access_both_branches` en caliente (sin re-login) suscribiéndose a su propia fila (`id=eq.{dbId}`). Realtime respeta RLS. |

## GRANTs Data API (Supabase PostgREST)

Desde el 30 de Octubre 2026, Supabase elimina los permisos implícitos sobre tablas del schema `public`. La migración `20260513000002_grant_data_api_access.sql` añade los GRANTs explícitos:

| Rol | Tablas | Permisos |
|-----|--------|----------|
| `authenticated` | ALL TABLES IN SCHEMA public | SELECT, INSERT, UPDATE, DELETE |
| `authenticated` | ALL SEQUENCES IN SCHEMA public | USAGE, SELECT |
| `authenticated` | ALL FUNCTIONS IN SCHEMA public | EXECUTE |
| `anon` | `branches`, `courses` | SELECT (solo tablas con policies FOR anon) |

`ALTER DEFAULT PRIVILEGES` cubre tablas y secuencias creadas en migraciones futuras para `authenticated`. **RLS sigue siendo la capa de seguridad real** — estos GRANTs solo habilitan el acceso a nivel de objeto en PostgREST.

## Storage Buckets

| Bucket | Migración creación | Migración fix | Visibilidad | MIME permitidos | Límite | Policies |
|--------|-------------------|---------------|-------------|-----------------|--------|----------|
| `documents` | `20260307160000_create_documents_storage_bucket.sql` | `20260413000001_secure_documents_bucket.sql` · `20260424000001_fix_anon_carnet_upload_rls.sql` | **`public: false`** (privado desde 2026-04-13) | `image/jpeg`, `image/png`, `image/webp`, `application/pdf` | 10 MB | SELECT: solo `authenticated` con rol `admin/secretary` (policy `documents_authenticated_read`) · INSERT/UPDATE authenticated: secretary o admin (policy `documents_auth_insert`/`documents_auth_update`) · INSERT/UPDATE anon: **solo** `public-uploads/carnet/{token}` donde `token ~ /^[0-9a-zA-Z-]+$/` (policies `documents_anon_carnet_insert`/`documents_anon_carnet_update`, re-creadas en `20260424000001` con regex más estricta) · DELETE: solo admin. **URLs en BD son rutas relativas** (path sin bucket); las Facades generan `createSignedUrl()` con TTL 1h bajo demanda. Carpetas internas: `class-books/`, `contracts/`, `student-docs/`, `certificates/{enrollment_id}/`, `public-uploads/carnet/` |
| `website-public` | `20260522010000_create_website_public_bucket.sql` | - | **`public: true`** (público) | `image/jpeg`, `image/png`, `image/webp`, `image/svg+xml` | 50 MB | SELECT: público para todos (policy `website_public_select`) · INSERT: authenticated admins/secretaries (`website_public_insert`) y anon temporal en `seeds/*` (`website_public_seed_insert`) · UPDATE: authenticated admins/secretaries (`website_public_update`) · DELETE: authenticated admins (`website_public_delete`). **URLs en BD son URLs públicas absolutas del CDN**; las Facades cargan directamente sin firmas. Carpetas internas: `seeds/` (assets de marca iniciales), `website-assets/branch-{branchId}/` (assets de subida) |

> **Fix aplicado `20260310130000`:** Se reemplazó `auth_user_role()` por subquery `EXISTS(... JOIN roles ...)` en todas las policies de storage para evitar fallos en el contexto de evaluación del schema `storage`. Se agregó `WITH CHECK` a la policy UPDATE (necesario para que `upsert: true` funcione cuando el archivo ya existe). Se cambió `ON CONFLICT DO NOTHING` por `DO UPDATE SET` para forzar actualización de `allowed_mime_types` si el bucket ya existía antes de la migración original.

## Esquema auto-generado desde migraciones

> Regenerado con `npm run indices:sync` (spec 0022). Estado acumulado de las 133+ migraciones
> en orden cronológico. La documentación manual de arriba complementa; ante discrepancia,
> esta sección refleja el SQL real.

<!-- AUTO-GENERATED:BEGIN -->
## Esquema efectivo (78 tablas, acumulado de las migraciones)

### `absence_evidence` — 🔒 RLS

> Adjuntos de licencias médicas para justificar faltas profesionales (RF-071)

| Columna | Tipo | Null | Default | FK |
|---------|------|------|---------|----|
| `id` PK | SERIAL | NO | — | — |
| `enrollment_id` | INT | NO | — | → `enrollments.id` |
| `document_type` | TEXT | sí | — | — |
| `description` | TEXT | sí | — | — |
| `file_url` | TEXT | NO | — | — |
| `document_date` | DATE | sí | — | — |
| `status` | TEXT | sí | — | — |
| `reviewed_by` | INT | sí | — | → `users.id` |
| `reviewed_at` | TIMESTAMPTZ | sí | — | — |
| `created_at` | TIMESTAMPTZ | sí | `NOW()` | — |

**Policies:**

| Policy | Cmd | USING | WITH CHECK |
|--------|-----|-------|------------|
| select_absence_evidence | SELECT | `auth_user_role() IN ('admin', 'secretary') OR (auth_user_role() = 'student' A…` | — |
| insert_absence_evidence | INSERT | — | `auth_user_role() IN ('admin', 'secretary') OR (auth_user_role() = 'student' A…` |
| update_absence_evidence | UPDATE | `auth_user_role() IN ('admin', 'secretary') OR (auth_user_role() = 'student' A…` | — |
| delete_absence_evidence | DELETE | `auth_user_role() IN ('admin', 'secretary')` | — |

### `alert_config` — 🔒 RLS

> Días de anticipación configurables por tipo de alerta (RF-024)

| Columna | Tipo | Null | Default | FK |
|---------|------|------|---------|----|
| `id` PK | SERIAL | NO | — | — |
| `alert_type` | TEXT | NO | — | — |
| `advance_days` | SMALLINT | NO | — | — |
| `active` | BOOLEAN | sí | `true` | — |
| `branch_id` | INT | sí | — | → `branches.id` |

**Policies:**

| Policy | Cmd | USING | WITH CHECK |
|--------|-----|-------|------------|
| all_alert_config | ALL | `auth_user_role() = 'admin'` | — |

### `audit_log` — 🔒 RLS

> Historial inmutable de acciones del sistema (RF-009, RF-010). Sin updated_at.

| Columna | Tipo | Null | Default | FK |
|---------|------|------|---------|----|
| `id` PK | SERIAL | NO | — | — |
| `user_id` | INT | sí | — | → `users.id` |
| `action` | TEXT | NO | — | — |
| `entity` | TEXT | sí | — | — |
| `entity_id` | INT | sí | — | — |
| `detail` | TEXT | sí | — | — |
| `ip` | TEXT | sí | — | — |
| `created_at` | TIMESTAMPTZ | sí | `NOW()` | — |
| `branch_id` | INT | sí | — | → `branches.id` |

**Policies:**

| Policy | Cmd | USING | WITH CHECK |
|--------|-----|-------|------------|
| select_audit_log | SELECT | `auth_user_role() = 'admin'` | — |
| insert_audit_log | INSERT | — | `(SELECT auth.uid()) IS NOT NULL` |

**Índices:** `idx_audit_log_time`, `idx_audit_log_user`

### `branches` — 🔒 RLS

> Sedes físicas de la escuela de conductores (RF-012)

| Columna | Tipo | Null | Default | FK |
|---------|------|------|---------|----|
| `id` PK | SERIAL | NO | — | — |
| `name` | TEXT | NO | — | — |
| `slug` UQ | TEXT | sí | — | — |
| `address` | TEXT | sí | — | — |
| `phone` | TEXT | sí | — | — |
| `email` | TEXT | sí | — | — |
| `active` | BOOLEAN | sí | `true` | — |
| `created_at` | TIMESTAMPTZ | sí | `NOW()` | — |
| `has_professional` | BOOLEAN | NO | `false` | — |

**Policies:**

| Policy | Cmd | USING | WITH CHECK |
|--------|-----|-------|------------|
| select_branches | SELECT | `(SELECT auth.uid()) IS NOT NULL` | — |
| insert_branches | INSERT | — | `auth_user_role() = 'admin'` |
| update_branches | UPDATE | `auth_user_role() = 'admin'` | — |
| delete_branches | DELETE | `auth_user_role() = 'admin'` | — |
| select_branches_anon | SELECT | `true` | — |

### `cash_closings` — 🔒 RLS

> Cuadratura diaria con arqueo físico de billetes/monedas (RF-029, RF-032, RF-037)

| Columna | Tipo | Null | Default | FK |
|---------|------|------|---------|----|
| `id` PK | SERIAL | NO | — | — |
| `branch_id` | INT | sí | — | → `branches.id` |
| `date` | DATE | NO | — | — |
| `cash_amount` | INTEGER | sí | `0` | — |
| `transfer_amount` | INTEGER | sí | `0` | — |
| `card_amount` | INTEGER | sí | `0` | — |
| `voucher_amount` | INTEGER | sí | `0` | — |
| `total_income` | INTEGER | sí | — | — |
| `total_expenses` | INTEGER | sí | — | — |
| `balance` | INTEGER | sí | — | — |
| `payments_count` | INTEGER | sí | — | — |
| `qty_bill_20000` | SMALLINT | sí | `0` | — |
| `qty_bill_10000` | SMALLINT | sí | `0` | — |
| `qty_bill_5000` | SMALLINT | sí | `0` | — |
| `qty_bill_2000` | SMALLINT | sí | `0` | — |
| `qty_bill_1000` | SMALLINT | sí | `0` | — |
| `qty_coin_500` | SMALLINT | sí | `0` | — |
| `qty_coin_100` | SMALLINT | sí | `0` | — |
| `qty_coin_50` | SMALLINT | sí | `0` | — |
| `qty_coin_10` | SMALLINT | sí | `0` | — |
| `arqueo_amount` | INTEGER | sí | — | — |
| `difference` | INTEGER | sí | — | — |
| `status` | TEXT | sí | `'open'` | — |
| `closed` | BOOLEAN | sí | `false` | — |
| `closed_by` | INT | sí | — | → `users.id` |
| `closed_at` | TIMESTAMPTZ | sí | — | — |
| `notes` | TEXT | sí | — | — |

**Policies:**

| Policy | Cmd | USING | WITH CHECK |
|--------|-----|-------|------------|
| select_cash_closings | SELECT | `auth_user_role() = 'admin' OR (auth_user_role() = 'secretary' AND date >= CUR…` | — |
| insert_cash_closings | INSERT | — | `auth_user_role() = 'admin' OR (auth_user_role() = 'secretary' AND branch_visi…` |
| update_cash_closings | UPDATE | `auth_user_role() = 'admin'` | — |
| delete_cash_closings | DELETE | `auth_user_role() = 'admin'` | — |

### `certificate_batches` — 🔒 RLS

> Lotes de folios Casa de Moneda: rango y disponibilidad (RF-112)

| Columna | Tipo | Null | Default | FK |
|---------|------|------|---------|----|
| `id` PK | SERIAL | NO | — | — |
| `batch_code` UQ | TEXT | NO | — | — |
| `folio_from` | INTEGER | NO | — | — |
| `folio_to` | INTEGER | NO | — | — |
| `available_folios` | INTEGER | sí | — | — |
| `branch_id` | INT | sí | — | → `branches.id` |
| `received_date` | DATE | sí | — | — |
| `received_by` | INT | sí | — | → `users.id` |
| `created_at` | TIMESTAMPTZ | sí | `NOW()` | — |

**Policies:**

| Policy | Cmd | USING | WITH CHECK |
|--------|-----|-------|------------|
| all_certificate_batches | ALL | `auth_user_role() = 'admin'` | — |

### `certificate_issuance_log` — 🔒 RLS

> Historial de descargas, envíos e impresiones de certificados (RF-096)

| Columna | Tipo | Null | Default | FK |
|---------|------|------|---------|----|
| `id` PK | SERIAL | NO | — | — |
| `certificate_id` | INT | NO | — | → `certificates.id` |
| `action` | TEXT | sí | — | — |
| `user_id` | INT | sí | — | → `users.id` |
| `ip` | TEXT | sí | — | — |
| `created_at` | TIMESTAMPTZ | sí | `NOW()` | — |

**Policies:**

| Policy | Cmd | USING | WITH CHECK |
|--------|-----|-------|------------|
| select_certificate_issuance_log | SELECT | `auth_user_role() IN ('admin', 'secretary')` | — |
| insert_certificate_issuance_log | INSERT | — | `auth_user_role() = 'admin'` |
| update_certificate_issuance_log | UPDATE | `auth_user_role() = 'admin'` | — |
| delete_certificate_issuance_log | DELETE | `auth_user_role() = 'admin'` | — |

### `certificates` — 🔒 RLS

> Certificados emitidos con folio único, QR y link a lote Casa de Moneda (RF-075, RF-076)

| Columna | Tipo | Null | Default | FK |
|---------|------|------|---------|----|
| `id` PK | SERIAL | NO | — | — |
| `folio` UQ | INTEGER | NO | — | — |
| `batch_id` | INT | sí | — | → `certificate_batches.id` |
| `enrollment_id` | INT | sí | — | → `enrollments.id` |
| `student_id` | INT | sí | — | → `students.id` |
| `type` | TEXT | sí | — | — |
| `status` | TEXT | sí | — | — |
| `qr_url` | TEXT | sí | — | — |
| `issued_date` | DATE | sí | — | — |
| `issued_by` | INT | sí | — | → `users.id` |
| `created_at` | TIMESTAMPTZ | sí | `NOW()` | — |

**Policies:**

| Policy | Cmd | USING | WITH CHECK |
|--------|-----|-------|------------|
| select_certificates | SELECT | `auth_user_role() IN ('admin', 'secretary') OR (auth_user_role() = 'student' A…` | — |
| insert_certificates | INSERT | — | `auth_user_role() IN ('admin', 'secretary')` |
| update_certificates | UPDATE | `auth_user_role() = 'admin'` | — |
| delete_certificates | DELETE | `auth_user_role() = 'admin'` | — |

### `class_b_exam_attempts` — 🔒 RLS

> Intentos de alumnos en ensayos online con calificación automática (RF-057)

| Columna | Tipo | Null | Default | FK |
|---------|------|------|---------|----|
| `id` PK | SERIAL | NO | — | — |
| `exam_id` | INT | NO | — | → `class_b_exam_catalog.id` |
| `enrollment_id` | INT | NO | — | → `enrollments.id` |
| `started_at` | TIMESTAMPTZ | NO | — | — |
| `submitted_at` | TIMESTAMPTZ | sí | — | — |
| `score` | SMALLINT | sí | — | — |
| `passed` | BOOLEAN | sí | — | — |
| `answers` | JSONB | sí | — | — |
| `timed_out` | BOOLEAN | sí | `false` | — |
| `created_at` | TIMESTAMPTZ | sí | `NOW()` | — |

**Policies:**

| Policy | Cmd | USING | WITH CHECK |
|--------|-----|-------|------------|
| update_class_b_exam_attempts | UPDATE | `auth_user_role() = 'admin'` | — |
| delete_class_b_exam_attempts | DELETE | `auth_user_role() = 'admin'` | — |
| select_class_b_exam_attempts | SELECT | `auth_user_role() IN ('admin', 'secretary') OR ( auth_user_role() = 'student' …` | — |
| insert_class_b_exam_attempts | INSERT | — | `auth_user_role() = 'admin' OR ( auth_user_role() = 'student' AND EXISTS ( SEL…` |

### `class_b_exam_catalog` — 🔒 RLS

> Catálogo de ensayos online autogestionados Clase B (RF-057)

| Columna | Tipo | Null | Default | FK |
|---------|------|------|---------|----|
| `id` PK | SERIAL | NO | — | — |
| `title` | TEXT | NO | — | — |
| `description` | TEXT | sí | — | — |
| `time_limit_min` | SMALLINT | NO | — | — |
| `total_questions` | SMALLINT | NO | — | — |
| `pass_score` | SMALLINT | NO | — | — |
| `active` | BOOLEAN | sí | `true` | — |
| `created_by` | INT | sí | — | → `users.id` |
| `created_at` | TIMESTAMPTZ | sí | `NOW()` | — |
| `updated_at` | TIMESTAMPTZ | sí | `NOW()` | — |

**Policies:**

| Policy | Cmd | USING | WITH CHECK |
|--------|-----|-------|------------|
| select_class_b_exam_catalog | SELECT | `auth_user_role() IN ('admin', 'secretary', 'student')` | — |
| insert_class_b_exam_catalog | INSERT | — | `auth_user_role() = 'admin'` |
| update_class_b_exam_catalog | UPDATE | `auth_user_role() = 'admin'` | — |
| delete_class_b_exam_catalog | DELETE | `auth_user_role() = 'admin'` | — |

### `class_b_exam_questions` — 🔒 RLS

> Banco de preguntas reutilizables para ensayos online Clase B (RF-057)

| Columna | Tipo | Null | Default | FK |
|---------|------|------|---------|----|
| `id` PK | SERIAL | NO | — | — |
| `exam_id` | INT | NO | — | → `class_b_exam_catalog.id` |
| `question_text` | TEXT | NO | — | — |
| `option_a` | TEXT | NO | — | — |
| `option_b` | TEXT | NO | — | — |
| `option_c` | TEXT | NO | — | — |
| `option_d` | TEXT | sí | — | — |
| `correct_option` | CHAR(1) | NO | — | — |
| `active` | BOOLEAN | sí | `true` | — |
| `created_at` | TIMESTAMPTZ | sí | `NOW()` | — |

**Policies:**

| Policy | Cmd | USING | WITH CHECK |
|--------|-----|-------|------------|
| insert_class_b_exam_questions | INSERT | — | `auth_user_role() = 'admin'` |
| update_class_b_exam_questions | UPDATE | `auth_user_role() = 'admin'` | — |
| delete_class_b_exam_questions | DELETE | `auth_user_role() = 'admin'` | — |

### `class_b_exam_scores` — 🔒 RLS

> Puntajes de ensayos físicos de preparación examen municipal, ingreso manual (RF-057)

| Columna | Tipo | Null | Default | FK |
|---------|------|------|---------|----|
| `id` PK | SERIAL | NO | — | — |
| `enrollment_id` | INT | NO | — | → `enrollments.id` |
| `date` | DATE | sí | — | — |
| `score` | SMALLINT | sí | — | — |
| `passed` | BOOLEAN | sí | — | — |
| `registered_by` | INT | sí | — | → `users.id` |
| `created_at` | TIMESTAMPTZ | sí | `NOW()` | — |

**Policies:**

| Policy | Cmd | USING | WITH CHECK |
|--------|-----|-------|------------|
| insert_class_b_exam_scores | INSERT | — | `auth_user_role() IN ('admin', 'secretary', 'instructor')` |
| update_class_b_exam_scores | UPDATE | `auth_user_role() IN ('admin', 'instructor')` | — |
| delete_class_b_exam_scores | DELETE | `auth_user_role() = 'admin'` | — |
| select_class_b_exam_scores | SELECT | `auth_user_role() IN ('admin', 'secretary', 'instructor') OR ( auth_user_role(…` | — |

### `class_b_practice_attendance` — 🔒 RLS

> Asistencia a clases prácticas individuales Clase B. RF-053: 2 inasistencias = deserción

| Columna | Tipo | Null | Default | FK |
|---------|------|------|---------|----|
| `id` PK | SERIAL | NO | — | — |
| `class_b_session_id` | INT | NO | — | → `class_b_sessions.id` |
| `student_id` | INT | NO | — | → `students.id` |
| `status` | TEXT | sí | — | — |
| `justification` | TEXT | sí | — | — |
| `evidence_url` | TEXT | sí | — | — |
| `consecutive_absences` | INT | sí | `0` | — |
| `recorded_by` | INT | sí | — | → `users.id` |
| `recorded_at` | TIMESTAMPTZ | sí | `NOW()` | — |

**Policies:**

| Policy | Cmd | USING | WITH CHECK |
|--------|-----|-------|------------|
| select_class_b_practice_attendance | SELECT | `auth_user_role() IN ('admin', 'secretary', 'instructor') OR (auth_user_role()…` | — |
| insert_class_b_practice_attendance | INSERT | — | `auth_user_role() IN ('admin', 'secretary', 'instructor')` |
| update_class_b_practice_attendance | UPDATE | `auth_user_role() IN ('admin', 'secretary', 'instructor')` | — |
| delete_class_b_practice_attendance | DELETE | `auth_user_role() IN ('admin', 'secretary')` | — |

**Índices:** `idx_class_b_practice_attendance_student`

### `class_b_sessions` — 🔒 RLS

> Sesiones prácticas individuales Clase B: 1 alumno + 1 instructor + 1 vehículo, secuencia 1-12 (RF-046)

| Columna | Tipo | Null | Default | FK |
|---------|------|------|---------|----|
| `id` PK | SERIAL | NO | — | — |
| `enrollment_id` | INT | NO | — | → `enrollments.id` |
| `instructor_id` | INT | NO | — | → `instructors.id` |
| `vehicle_id` | INT | NO | — | → `vehicles.vehicle_id` |
| `class_number` | SMALLINT | sí | — | — |
| `scheduled_at` | TIMESTAMPTZ | sí | — | — |
| `start_time` | TIME | sí | — | — |
| `end_time` | TIME | sí | — | — |
| `duration_min` | SMALLINT | sí | `45` | — |
| `status` | TEXT | sí | — | — |
| `counts_as_taken` | BOOLEAN | sí | `false` | — |
| `cancelled_at` | TIMESTAMPTZ | sí | — | — |
| `completed_at` | TIMESTAMPTZ | sí | — | — |
| `evaluation_grade` | NUMERIC(3,1) | sí | — | — |
| `performance_notes` | TEXT | sí | — | — |
| `km_start` | INTEGER | sí | — | — |
| `km_end` | INTEGER | sí | — | — |
| `gps_start` | POINT | sí | — | — |
| `gps_end` | POINT | sí | — | — |
| `notes` | TEXT | sí | — | — |
| `student_signature` | BOOLEAN | sí | `false` | — |
| `instructor_signature` | BOOLEAN | sí | `false` | — |
| `signature_timestamp` | TIMESTAMPTZ | sí | — | — |
| `original_instructor_id` | INT | sí | — | → `instructors.id` |
| `registered_by` | INT | sí | — | → `users.id` |
| `created_at` | TIMESTAMPTZ | sí | `NOW()` | — |
| `updated_at` | TIMESTAMPTZ | sí | `NOW()` | — |
| `evaluation_checklist` | JSONB | sí | `'[]'::jsonb` | — |

**Policies:**

| Policy | Cmd | USING | WITH CHECK |
|--------|-----|-------|------------|
| select_class_b_sessions | SELECT | `auth_user_role() IN ('admin', 'secretary') OR (auth_user_role() = 'instructor…` | — |
| insert_class_b_sessions | INSERT | — | `auth_user_role() IN ('admin', 'secretary') OR (auth_user_role() = 'instructor…` |
| update_class_b_sessions | UPDATE | `auth_user_role() IN ('admin', 'secretary') OR (auth_user_role() = 'instructor…` | — |
| delete_class_b_sessions | DELETE | `auth_user_role() IN ('admin', 'secretary')` | — |

**Índices:** `idx_class_b_sessions_date_instructor`, `idx_class_b_sessions_date_vehicle`

### `class_b_theory_cycles` — 🔒 RLS

> Ciclos teóricos Clase B (Spec 0001): cohorte de 2 semanas, 6 clases L/X/V. '
  'start_date siempre Lunes, end_date = start_date + 11 (Viernes semana 2).

| Columna | Tipo | Null | Default | FK |
|---------|------|------|---------|----|
| `id` PK | SERIAL | NO | — | — |
| `branch_id` | INT | NO | — | → `branches.id` |
| `start_date` | DATE | NO | — | — |
| `end_date` | DATE | NO | — | — |
| `status` | TEXT | NO | `'active'` | — |
| `created_at` | TIMESTAMPTZ | sí | `NOW()` | — |

**Policies:**

| Policy | Cmd | USING | WITH CHECK |
|--------|-----|-------|------------|
| select_class_b_theory_cycles | SELECT | `auth_user_role() IN ('admin', 'instructor', 'student') OR (auth_user_role() =…` | — |
| insert_class_b_theory_cycles | INSERT | — | `auth_user_role() = 'admin' OR (auth_user_role() = 'secretary' AND branch_visi…` |
| update_class_b_theory_cycles | UPDATE | `auth_user_role() = 'admin' OR (auth_user_role() = 'secretary' AND branch_visi…` | — |
| delete_class_b_theory_cycles | DELETE | `auth_user_role() = 'admin'` | — |

**Índices:** `idx_class_b_theory_cycles_branch_status`

### `class_b_theory_sessions` — 🔒 RLS

> Clases de un ciclo teórico Clase B (Spec 0001): 6 por ciclo (L/X/V × 2 semanas). '
  'class_number 1-6, class_date, zoom_link + zoom_sent_at. Sin asistencia (irrelevante).

| Columna | Tipo | Null | Default | FK |
|---------|------|------|---------|----|
| `id` PK | SERIAL | NO | — | — |
| `branch_id` | INT | sí | — | → `branches.id` |
| `instructor_id` | INT | sí | — | → `instructors.id` |
| `scheduled_at` | TIMESTAMPTZ | sí | — | — |
| `start_time` | TIME | sí | — | — |
| `end_time` | TIME | sí | — | — |
| `duration_min` | SMALLINT | sí | `90` | — |
| `topic` | TEXT | sí | — | — |
| `zoom_link` | TEXT | sí | — | — |
| `status` | TEXT | sí | — | — |
| `notes` | TEXT | sí | — | — |
| `registered_by` | INT | sí | — | → `users.id` |
| `created_at` | TIMESTAMPTZ | sí | `NOW()` | — |
| `cycle_id` | INT | sí | — | → `class_b_theory_cycles.id` |
| `class_number` | SMALLINT | sí | — | — |
| `class_date` | DATE | sí | — | — |
| `zoom_sent_at` | TIMESTAMPTZ | sí | — | — |

**Policies:**

| Policy | Cmd | USING | WITH CHECK |
|--------|-----|-------|------------|
| select_class_b_theory_sessions | SELECT | `auth_user_role() IN ('admin', 'secretary', 'instructor', 'student')` | — |
| insert_class_b_theory_sessions | INSERT | — | `auth_user_role() IN ('admin', 'secretary', 'instructor')` |
| update_class_b_theory_sessions | UPDATE | `auth_user_role() IN ('admin', 'secretary', 'instructor')` | — |
| delete_class_b_theory_sessions | DELETE | `auth_user_role() IN ('admin', 'secretary')` | — |

**Índices:** `idx_class_b_theory_sessions_branch`

### `class_book` — 🔒 RLS

> Libro oficial por curso profesional, para auditorías MTT. Exclusivo Clase Profesional (RF-103)

| Columna | Tipo | Null | Default | FK |
|---------|------|------|---------|----|
| `id` PK | SERIAL | NO | — | — |
| `branch_id` | INT | sí | — | → `branches.id` |
| `promotion_course_id` | INT | NO | — | → `promotion_courses.id` |
| `period` | TEXT | NO | — | — |
| `pdf_url` | TEXT | sí | — | — |
| `generated_by` | INT | sí | — | → `users.id` |
| `generated_at` | TIMESTAMPTZ | sí | — | — |
| `status` | TEXT | sí | — | — |
| `closes_at` | TIMESTAMPTZ | sí | — | — |
| `closed_at` | TIMESTAMPTZ | sí | — | — |
| `closed_by` | INT | sí | — | → `users.id` |
| `created_at` | TIMESTAMPTZ | sí | `NOW()` | — |
| `updated_at` | TIMESTAMPTZ | sí | `NOW()` | — |
| `sence_code` | TEXT | sí | — | — |
| `horario` | TEXT | sí | — | — |
| `sence_code_updated_by` | INT | sí | — | → `users.id` |
| `sence_code_updated_at` | TIMESTAMPTZ | sí | — | — |

**Policies:**

| Policy | Cmd | USING | WITH CHECK |
|--------|-----|-------|------------|
| insert_class_book | INSERT | — | `auth_user_role() IN ('admin', 'secretary')` |
| update_class_book | UPDATE | `auth_user_role() = 'admin' OR (auth_user_role() = 'secretary' AND status != '…` | — |
| delete_class_book | DELETE | `auth_user_role() = 'admin'` | — |
| select_class_book | SELECT | `auth_user_role() IN ('admin', 'secretary') OR (auth_user_role() = 'student' A…` | — |

### `courses` — 🔒 RLS

> Catálogo de cursos ofrecidos por sede: Clase B y Profesional (RF-012). '
  'Los cursos con is_convalidation = true (conv_a4, conv_a3) son contenedores '
  'de sesiones para convalidaciones simultáneas; no tienen enrollments propios.

| Columna | Tipo | Null | Default | FK |
|---------|------|------|---------|----|
| `id` PK | SERIAL | NO | — | — |
| `code` UQ | TEXT | sí | — | — |
| `name` | TEXT | NO | — | — |
| `type` | TEXT | sí | — | — |
| `duration_weeks` | INT | sí | — | — |
| `practical_hours` | NUMERIC(5,1) | sí | — | — |
| `theory_hours` | NUMERIC(5,1) | sí | — | — |
| `base_price` | INTEGER | sí | — | — |
| `license_class` | TEXT | sí | — | — |
| `branch_id` | INT | sí | — | → `branches.id` |
| `active` | BOOLEAN | sí | `true` | — |
| `schedule_days` | INT[] | sí | `'{1` | — |
| `schedule_blocks` | JSONB | sí | `'[
    {"from":"08:30","to":"09:15"},
    {"from":"09:20","to":"10:05"},
    {"from":"10:10","to":"10:55"},
    {"from":"11:00","to":"11:45"},
    {"from":"11:50","to":"12:35"},
    {"from":"12:40","to":"13:25"},
    {"from":"15:00","to":"15:45"},
    {"from":"15:50","to":"16:35"},
    {"from":"16:40","to":"17:25"},
    {"from":"17:30","to":"18:15"},
    {"from":"18:20","to":"19:05"},
    {"from":"19:10","to":"19:55"},
    {"from":"20:00","to":"20:45"}
  ]'::JSONB` | — |
| `is_convalidation` | BOOLEAN | NO | `false` | — |
| `max_classes_per_day` | INTEGER | NO | `1` | — |
| `is_reinforcement` | BOOLEAN | NO | `false` | — |

**Policies:**

| Policy | Cmd | USING | WITH CHECK |
|--------|-----|-------|------------|
| select_courses | SELECT | `(SELECT auth.uid()) IS NOT NULL` | — |
| insert_courses | INSERT | — | `auth_user_role() = 'admin'` |
| update_courses | UPDATE | `auth_user_role() = 'admin'` | — |
| delete_courses | DELETE | `auth_user_role() = 'admin'` | — |
| select_courses_anon | SELECT | `active = true AND (is_convalidation IS NOT TRUE) AND (is_reinforcement IS NOT…` | — |

### `cuadratura_adjustments` — 🔒 RLS

> Ajustes posteriores sobre cuadraturas cerradas (spec 0002-i / ASG-b-037). '
  'Inmutable: sin UPDATE ni DELETE -- una corrección mal hecha se compensa con OTRO ajuste.

| Columna | Tipo | Null | Default | FK |
|---------|------|------|---------|----|
| `id` PK | SERIAL | NO | — | — |
| `cuadratura_id` | INT | NO | — | → `cash_closings.id` |
| `tipo` | TEXT | NO | — | — |
| `monto` | INTEGER | NO | — | — |
| `motivo` | TEXT | NO | — | — |
| `expense_id` | INT | sí | — | → `expenses.id` |
| `registered_by` | INT | NO | — | → `users.id` |
| `created_at` | TIMESTAMPTZ | NO | `NOW()` | — |

**Policies:**

| Policy | Cmd | USING | WITH CHECK |
|--------|-----|-------|------------|
| select_cuadratura_adjustments | SELECT | `auth_user_role() = 'admin'` | — |
| insert_cuadratura_adjustments | INSERT | — | `auth_user_role() = 'admin'` |

### `digital_contracts` — 🔒 RLS

> Contrato digital firmado por el alumno, con PDF para el DMS (RF-083)

| Columna | Tipo | Null | Default | FK |
|---------|------|------|---------|----|
| `id` PK | SERIAL | NO | — | — |
| `enrollment_id` UQ | INT | NO | — | → `enrollments.id` |
| `content_hash` | TEXT | sí | — | — |
| `signature_ip` | TEXT | sí | — | — |
| `accepted_at` | TIMESTAMPTZ | sí | — | — |
| `file_name` | TEXT | sí | — | — |
| `file_url` | TEXT | sí | — | — |
| `signed_contract_url` | TEXT | sí | — | — |

**Policies:**

| Policy | Cmd | USING | WITH CHECK |
|--------|-----|-------|------------|
| insert_digital_contracts | INSERT | — | `auth_user_role() IN ('admin', 'secretary')` |
| update_digital_contracts | UPDATE | `auth_user_role() IN ('admin', 'secretary')` | — |
| select_digital_contracts | SELECT | `auth_user_role() = 'admin' OR ( auth_user_role() = 'secretary' AND enrollment…` | — |
| delete_digital_contracts | DELETE | `auth_user_role() = 'admin' OR ( auth_user_role() = 'secretary' AND enrollment…` | — |

### `disciplinary_notes` — 🔒 RLS

> Notas disciplinarias asociadas al perfil del alumno (RF-109)

| Columna | Tipo | Null | Default | FK |
|---------|------|------|---------|----|
| `id` PK | SERIAL | NO | — | — |
| `student_id` | INT | NO | — | → `students.id` |
| `description` | TEXT | NO | — | — |
| `date` | DATE | NO | — | — |
| `recorded_by` | INT | sí | — | → `users.id` |
| `created_at` | TIMESTAMPTZ | sí | `NOW()` | — |

**Policies:**

| Policy | Cmd | USING | WITH CHECK |
|--------|-----|-------|------------|
| select_disciplinary_notes | SELECT | `auth_user_role() IN ('admin', 'secretary') OR (auth_user_role() = 'student' A…` | — |
| insert_disciplinary_notes | INSERT | — | `auth_user_role() IN ('admin', 'secretary')` |
| update_disciplinary_notes | UPDATE | `auth_user_role() = 'admin'` | — |
| delete_disciplinary_notes | DELETE | `auth_user_role() = 'admin'` | — |

### `discount_applications` — 🔒 RLS

> Registro de descuento aplicado a una matrícula específica

| Columna | Tipo | Null | Default | FK |
|---------|------|------|---------|----|
| `id` PK | SERIAL | NO | — | — |
| `discount_id` | INT | NO | — | → `discounts.id` |
| `enrollment_id` | INT | NO | — | → `enrollments.id` |
| `discount_amount` | INTEGER | NO | — | — |
| `applied_by` | INT | sí | — | → `users.id` |
| `applied_at` | TIMESTAMPTZ | sí | `NOW()` | — |

**Policies:**

| Policy | Cmd | USING | WITH CHECK |
|--------|-----|-------|------------|
| select_discount_applications | SELECT | `auth_user_role() IN ('admin', 'secretary')` | — |
| insert_discount_applications | INSERT | — | `auth_user_role() IN ('admin', 'secretary')` |
| update_discount_applications | UPDATE | `auth_user_role() = 'admin'` | — |
| delete_discount_applications | DELETE | `auth_user_role() = 'admin'` | — |

### `discounts` — 🔒 RLS

> Descuentos comerciales aplicables a matrículas (porcentaje o monto fijo)

| Columna | Tipo | Null | Default | FK |
|---------|------|------|---------|----|
| `id` PK | SERIAL | NO | — | — |
| `name` | TEXT | NO | — | — |
| `discount_type` | TEXT | sí | — | — |
| `value` | INTEGER | NO | — | — |
| `valid_from` | DATE | NO | — | — |
| `valid_until` | DATE | sí | — | — |
| `applicable_to` | TEXT | sí | — | — |
| `status` | TEXT | sí | — | — |
| `referral_code` | TEXT | sí | — | — |
| `created_by` | INT | sí | — | → `users.id` |
| `created_at` | TIMESTAMPTZ | sí | `NOW()` | — |

**Policies:**

| Policy | Cmd | USING | WITH CHECK |
|--------|-----|-------|------------|
| select_discounts | SELECT | `auth_user_role() IN ('admin', 'secretary')` | — |
| insert_discounts | INSERT | — | `auth_user_role() = 'admin'` |
| update_discounts | UPDATE | `auth_user_role() = 'admin'` | — |
| delete_discounts | DELETE | `auth_user_role() = 'admin'` | — |

### `document_templates` — 🔒 RLS

> Plantillas descargables del DMS: contratos, formularios MTT, comprobantes. Solo Admin gestiona.

| Columna | Tipo | Null | Default | FK |
|---------|------|------|---------|----|
| `id` PK | SERIAL | NO | — | — |
| `name` | TEXT | NO | — | — |
| `description` | TEXT | sí | — | — |
| `category` | TEXT | NO | — | — |
| `format` | TEXT | NO | — | — |
| `version` | TEXT | sí | — | — |
| `file_url` | TEXT | NO | — | — |
| `download_count` | INTEGER | sí | `0` | — |
| `active` | BOOLEAN | sí | `true` | — |
| `updated_by` | INT | sí | — | → `users.id` |
| `created_at` | TIMESTAMPTZ | sí | `NOW()` | — |
| `updated_at` | TIMESTAMPTZ | sí | `NOW()` | — |

**Policies:**

| Policy | Cmd | USING | WITH CHECK |
|--------|-----|-------|------------|
| select_document_templates | SELECT | `(SELECT auth.uid()) IS NOT NULL` | — |
| insert_document_templates | INSERT | — | `auth_user_role() = 'admin'` |
| update_document_templates | UPDATE | `auth_user_role() = 'admin'` | — |
| delete_document_templates | DELETE | `auth_user_role() = 'admin'` | — |

### `enrollments` — 🔒 RLS

> Matrícula central: Clase B y Profesional (RF-080). El tipo se deriva de course_id → courses.type

| Columna | Tipo | Null | Default | FK |
|---------|------|------|---------|----|
| `id` PK | SERIAL | NO | — | — |
| `number` UQ | TEXT | sí | — | — |
| `student_id` | INT | NO | — | → `students.id` |
| `course_id` | INT | NO | — | → `courses.id` |
| `branch_id` | INT | NO | — | → `branches.id` |
| `sence_code_id` | INT | sí | — | → `sence_codes.id` |
| `base_price` | INTEGER | sí | — | — |
| `discount` | INTEGER | sí | `0` | — |
| `total_paid` | INTEGER | sí | `0` | — |
| `pending_balance` | INTEGER | sí | — | — |
| `payment_status` | TEXT | sí | — | — |
| `status` | TEXT | sí | — | — |
| `expires_at` | TIMESTAMPTZ | sí | — | — |
| `docs_complete` | BOOLEAN | sí | `false` | — |
| `contract_accepted` | BOOLEAN | sí | `false` | — |
| `certificate_enabled` | BOOLEAN | sí | `false` | — |
| `registration_channel` | TEXT | sí | `'in_person'` | — |
| `registered_by` | INT | sí | — | → `users.id` |
| `created_at` | TIMESTAMPTZ | sí | `NOW()` | — |
| `updated_at` | TIMESTAMPTZ | sí | `NOW()` | — |
| `promotion_course_id` | INT | sí | — | → `promotion_courses.id` |
| `license_group` | TEXT | sí | — | — |
| `certificate_b_pdf_url` | TEXT | sí | — | — |
| `certificate_professional_pdf_url` | TEXT | sí | — | — |
| `license_pdf_url` | TEXT | sí | — | — |
| `license_initial_url` | TEXT | sí | — | — |
| `license_full_url` | TEXT | sí | — | — |
| `theory_cycle_id` | INT | sí | — | → `class_b_theory_cycles.id` |

**Policies:**

| Policy | Cmd | USING | WITH CHECK |
|--------|-----|-------|------------|
| select_enrollments | SELECT | `auth_user_role() = 'admin' OR ( auth_user_role() = 'secretary' AND ( branch_i…` | — |
| insert_enrollments | INSERT | — | `auth_user_role() = 'admin' OR ( auth_user_role() = 'secretary' AND ( branch_i…` |
| update_enrollments | UPDATE | `auth_user_role() = 'admin' OR ( auth_user_role() = 'secretary' AND ( branch_i…` | — |
| delete_enrollments | DELETE | `auth_user_role() = 'admin' OR ( auth_user_role() = 'secretary' AND ( branch_i…` | — |

**Índices:** `idx_enrollments_branch_date`, `idx_enrollments_expired_drafts`

### `expenses` — 🔒 RLS

> Gastos categorizados de la escuela (RF-028)

| Columna | Tipo | Null | Default | FK |
|---------|------|------|---------|----|
| `id` PK | SERIAL | NO | — | — |
| `branch_id` | INT | sí | — | → `branches.id` |
| `category` | TEXT | sí | — | — |
| `description` | TEXT | NO | — | — |
| `amount` | INTEGER | NO | — | — |
| `date` | DATE | NO | — | — |
| `receipt_url` | TEXT | sí | — | — |
| `registered_by` | INT | sí | — | → `users.id` |
| `created_at` | TIMESTAMPTZ | sí | `NOW()` | — |
| `vehicle_id` | INT | sí | — | → `vehicles.id` |

**Policies:**

| Policy | Cmd | USING | WITH CHECK |
|--------|-----|-------|------------|
| select_expenses | SELECT | `auth_user_role() = 'admin' OR (auth_user_role() = 'secretary' AND branch_visi…` | — |
| insert_expenses | INSERT | — | `auth_user_role() = 'admin' OR (auth_user_role() = 'secretary' AND branch_visi…` |
| update_expenses | UPDATE | `auth_user_role() = 'admin' OR (auth_user_role() = 'secretary' AND branch_visi…` | — |
| delete_expenses | DELETE | `auth_user_role() = 'admin' OR (auth_user_role() = 'secretary' AND branch_visi…` | — |

### `fixed_expenses` — 🔒 RLS

> Gastos fijos del administrador (arriendo, sueldos, servicios, reparaciones) para punto de equilibrio mensual. Admin-only.

| Columna | Tipo | Null | Default | FK |
|---------|------|------|---------|----|
| `id` PK | SERIAL | NO | — | — |
| `branch_id` | INT | sí | — | → `branches.id` |
| `category` | TEXT | NO | — | — |
| `description` | TEXT | NO | — | — |
| `amount` | INTEGER | NO | — | — |
| `date` | DATE | NO | — | — |
| `created_by` | INT | sí | — | → `users.id` |
| `created_at` | TIMESTAMPTZ | sí | `NOW()` | — |

**Policies:**

| Policy | Cmd | USING | WITH CHECK |
|--------|-----|-------|------------|
| select_fixed_expenses | SELECT | `auth_user_role() = 'admin'` | — |
| insert_fixed_expenses | INSERT | — | `auth_user_role() = 'admin'` |
| update_fixed_expenses | UPDATE | `auth_user_role() = 'admin'` | — |
| delete_fixed_expenses | DELETE | `auth_user_role() = 'admin'` | — |

### `instructor_advances` — 🔒 RLS

> Cuenta corriente interna de anticipos a instructores (RF-038)

| Columna | Tipo | Null | Default | FK |
|---------|------|------|---------|----|
| `id` PK | SERIAL | NO | — | — |
| `instructor_id` | INT | NO | — | → `instructors.id` |
| `date` | DATE | NO | — | — |
| `amount` | INTEGER | NO | — | — |
| `reason` | TEXT | sí | — | — |
| `description` | TEXT | sí | — | — |
| `status` | TEXT | sí | — | — |
| `deducted_on` | DATE | sí | — | — |
| `registered_by` | INT | sí | — | → `users.id` |
| `created_at` | TIMESTAMPTZ | sí | `NOW()` | — |

**Policies:**

| Policy | Cmd | USING | WITH CHECK |
|--------|-----|-------|------------|
| select_instructor_advances | SELECT | `auth_user_role() IN ('admin', 'secretary') OR (auth_user_role() = 'instructor…` | — |
| insert_instructor_advances | INSERT | — | `auth_user_role() IN ('admin', 'secretary')` |
| update_instructor_advances | UPDATE | `auth_user_role() = 'admin'` | — |
| delete_instructor_advances | DELETE | `auth_user_role() = 'admin'` | — |

### `instructor_documents` — 🔒 RLS

> Documentos del expediente del instructor (Clase B): antecedentes, HVC, credencial SEMEP, licencia, etc. (spec 0003-m)

| Columna | Tipo | Null | Default | FK |
|---------|------|------|---------|----|
| `id` PK | SERIAL | NO | — | — |
| `instructor_id` | INT | NO | — | → `instructors.id` |
| `type` | TEXT | NO | — | — |
| `file_name` | TEXT | NO | — | — |
| `storage_url` | TEXT | NO | — | — |
| `status` | TEXT | NO | `'pending'` | — |
| `uploaded_by` | INT | sí | — | → `users.id` |
| `created_at` | TIMESTAMPTZ | NO | `NOW()` | — |

**Policies:**

| Policy | Cmd | USING | WITH CHECK |
|--------|-----|-------|------------|
| delete_instructor_documents | DELETE | `auth_user_role() = 'admin'` | — |

### `instructor_monthly_hours` — 🔒 RLS

> Cálculo de horas teóricas + prácticas (×1.5) por mes por instructor (RF-047)

| Columna | Tipo | Null | Default | FK |
|---------|------|------|---------|----|
| `id` PK | SERIAL | NO | — | — |
| `instructor_id` | INT | NO | — | → `instructors.id` |
| `period` | TEXT | NO | — | — |
| `theory_hours` | NUMERIC(6,1) | sí | `0` | — |
| `practical_sessions` | INTEGER | sí | `0` | — |
| `total_equivalent` | NUMERIC(6,1) | sí | — | — |

**Policies:**

| Policy | Cmd | USING | WITH CHECK |
|--------|-----|-------|------------|
| select_instructor_monthly_hours | SELECT | `auth_user_role() = 'admin' OR (auth_user_role() = 'instructor' AND instructor…` | — |
| insert_instructor_monthly_hours | INSERT | — | `auth_user_role() = 'admin'` |
| update_instructor_monthly_hours | UPDATE | `auth_user_role() = 'admin'` | — |
| delete_instructor_monthly_hours | DELETE | `auth_user_role() = 'admin'` | — |

### `instructor_monthly_payments` — 🔒 RLS

> Liquidación mensual: base_salary − anticipos = net_payment (RF-038)

| Columna | Tipo | Null | Default | FK |
|---------|------|------|---------|----|
| `id` PK | SERIAL | NO | — | — |
| `instructor_id` | INT | NO | — | → `instructors.id` |
| `period` | TEXT | NO | — | — |
| `base_salary` | INTEGER | NO | — | — |
| `advances_deducted` | INTEGER | NO | `0` | — |
| `net_payment` | INTEGER | NO | — | — |
| `payment_status` | TEXT | sí | `'pending'` | — |
| `paid_at` | TIMESTAMPTZ | sí | — | — |
| `paid_by` | INT | sí | — | → `users.id` |
| `notes` | TEXT | sí | — | — |

**Policies:**

| Policy | Cmd | USING | WITH CHECK |
|--------|-----|-------|------------|
| select_instructor_monthly_payments | SELECT | `auth_user_role() = 'admin' OR (auth_user_role() = 'instructor' AND instructor…` | — |
| insert_instructor_monthly_payments | INSERT | — | `auth_user_role() = 'admin'` |
| update_instructor_monthly_payments | UPDATE | `auth_user_role() = 'admin'` | — |
| delete_instructor_monthly_payments | DELETE | `auth_user_role() = 'admin'` | — |

### `instructor_replacements` — 🔒 RLS

> Registro de sustituciones de instructores con motivo y clases afectadas (RF-044)

| Columna | Tipo | Null | Default | FK |
|---------|------|------|---------|----|
| `id` PK | SERIAL | NO | — | — |
| `absent_instructor_id` | INT | NO | — | → `instructors.id` |
| `replacement_instructor_id` | INT | NO | — | → `instructors.id` |
| `date` | DATE | NO | — | — |
| `reason` | TEXT | NO | — | — |
| `affected_classes` | INT[] | sí | — | — |
| `registered_by` | INT | sí | — | → `users.id` |
| `created_at` | TIMESTAMPTZ | sí | `NOW()` | — |

**Policies:**

| Policy | Cmd | USING | WITH CHECK |
|--------|-----|-------|------------|
| select_instructor_replacements | SELECT | `auth_user_role() IN ('admin', 'secretary')` | — |
| insert_instructor_replacements | INSERT | — | `auth_user_role() IN ('admin', 'secretary')` |
| update_instructor_replacements | UPDATE | `auth_user_role() = 'admin'` | — |
| delete_instructor_replacements | DELETE | `auth_user_role() = 'admin'` | — |

### `instructors` — 🔒 RLS

> Instructores de Clase B con licencia, disponibilidad y control de clases (RF-041)

| Columna | Tipo | Null | Default | FK |
|---------|------|------|---------|----|
| `id` PK | SERIAL | NO | — | — |
| `user_id` UQ | INT | NO | — | → `users.id` |
| `type` | TEXT | sí | — | — |
| `license_number` | TEXT | sí | — | — |
| `license_class` | TEXT | sí | — | — |
| `license_expiry` | DATE | sí | — | — |
| `license_status` | TEXT | sí | — | — |
| `active_classes_count` | INT | sí | `0` | — |
| `active` | BOOLEAN | sí | `true` | — |
| `registration_date` | DATE | sí | — | — |
| `both_branches` | BOOLEAN | NO | `false` | — |

**Policies:**

| Policy | Cmd | USING | WITH CHECK |
|--------|-----|-------|------------|
| insert_instructors | INSERT | — | `auth_user_role() = 'admin'` |
| update_instructors | UPDATE | `auth_user_role() = 'admin'` | — |
| delete_instructors | DELETE | `auth_user_role() = 'admin'` | — |

### `lecturer_monthly_hours` — 🔒 RLS

> Cálculo de horas teóricas y prácticas por relator profesional por mes

| Columna | Tipo | Null | Default | FK |
|---------|------|------|---------|----|
| `id` PK | SERIAL | NO | — | — |
| `lecturer_id` | INT | NO | — | → `lecturers.id` |
| `period` | TEXT | NO | — | — |
| `theory_hours` | NUMERIC(6,1) | sí | `0` | — |
| `practical_hours` | NUMERIC(6,1) | sí | `0` | — |
| `total_hours` | NUMERIC(6,1) | sí | — | — |

**Policies:**

| Policy | Cmd | USING | WITH CHECK |
|--------|-----|-------|------------|
| all_lecturer_monthly_hours | ALL | `auth_user_role() = 'admin'` | — |

### `lecturers` — 🔒 RLS

> Relatores de Clase Profesional: datos y especializaciones. Sin acceso al sistema (RF-058)

| Columna | Tipo | Null | Default | FK |
|---------|------|------|---------|----|
| `id` PK | SERIAL | NO | — | — |
| `rut` UQ | TEXT | NO | — | — |
| `first_names` | TEXT | NO | — | — |
| `paternal_last_name` | TEXT | NO | — | — |
| `maternal_last_name` | TEXT | sí | — | — |
| `email` UQ | TEXT | sí | — | — |
| `phone` | TEXT | sí | — | — |
| `specializations` | TEXT[] | sí | — | — |
| `active` | BOOLEAN | sí | `true` | — |
| `registration_date` | DATE | sí | — | — |

**Policies:**

| Policy | Cmd | USING | WITH CHECK |
|--------|-----|-------|------------|
| select_lecturers | SELECT | `auth_user_role() IN ('admin', 'secretary')` | — |
| insert_lecturers | INSERT | — | `auth_user_role() IN ('admin', 'secretary')` |
| update_lecturers | UPDATE | `auth_user_role() IN ('admin', 'secretary')` | — |
| delete_lecturers | DELETE | `auth_user_role() IN ('admin', 'secretary')` | — |

### `license_validations` — 🔒 RLS

> Convalidación simultánea de licencias profesionales: A2+A4 (madre=A2) o A5+A3 (madre=A5). '
  'Un solo registro por matrícula. El alumno se obtiene vía enrollment_id → enrollments.student_id. '
  '(RF-064, RF-065, RF-066)

| Columna | Tipo | Null | Default | FK |
|---------|------|------|---------|----|
| `id` PK | SERIAL | NO | — | — |
| `reduced_hours` | INTEGER | sí | `60` | — |
| `book2_open_date` | DATE | sí | — | — |
| `history_ref_id` | INT | sí | — | → `enrollments.id` |
| `created_at` | TIMESTAMPTZ | sí | `NOW()` | — |
| `enrollment_id` | INT | sí | — | → `enrollments.id` |
| `convalidated_license` | TEXT | sí | — | — |
| `convalidation_promotion_course_id` | INT | sí | — | → `promotion_courses.id` |

**Policies:**

| Policy | Cmd | USING | WITH CHECK |
|--------|-----|-------|------------|
| select_license_validations | SELECT | `auth_user_role() IN ('admin', 'secretary')` | — |
| insert_license_validations | INSERT | — | `auth_user_role() IN ('admin', 'secretary')` |
| update_license_validations | UPDATE | `auth_user_role() IN ('admin', 'secretary')` | — |
| delete_license_validations | DELETE | `auth_user_role() IN ('admin', 'secretary')` | — |

**Índices:** `idx_license_validations_enrollment`

### `login_attempts` — 🔒 RLS

> Historial de intentos de login para detección de fuerza bruta (RF-014)

| Columna | Tipo | Null | Default | FK |
|---------|------|------|---------|----|
| `id` PK | SERIAL | NO | — | — |
| `email` | TEXT | NO | — | — |
| `ip` | TEXT | sí | — | — |
| `successful` | BOOLEAN | sí | — | — |
| `user_id` | INT | sí | — | → `users.id` |
| `created_at` | TIMESTAMPTZ | sí | `NOW()` | — |

**Policies:**

| Policy | Cmd | USING | WITH CHECK |
|--------|-----|-------|------------|
| all_login_attempts | ALL | `auth_user_role() = 'admin'` | — |

### `maintenance_records` — 🔒 RLS

> Historial y programación de mantenciones de vehículos (RF-089)

| Columna | Tipo | Null | Default | FK |
|---------|------|------|---------|----|
| `id` PK | SERIAL | NO | — | — |
| `vehicle_id` | INT | NO | — | → `vehicles.id` |
| `type` | TEXT | sí | — | — |
| `description` | TEXT | NO | — | — |
| `scheduled_date` | DATE | sí | — | — |
| `completed_date` | DATE | sí | — | — |
| `km_at_time` | INTEGER | sí | — | — |
| `workshop` | TEXT | sí | — | — |
| `status` | TEXT | sí | — | — |
| `cost` | INTEGER | sí | — | — |
| `registered_by` | INT | sí | — | → `users.id` |
| `created_at` | TIMESTAMPTZ | sí | `NOW()` | — |

**Policies:**

| Policy | Cmd | USING | WITH CHECK |
|--------|-----|-------|------------|
| select_maintenance_records | SELECT | `auth_user_role() IN ('admin', 'secretary')` | — |
| insert_maintenance_records | INSERT | — | `auth_user_role() = 'admin'` |
| update_maintenance_records | UPDATE | `auth_user_role() = 'admin'` | — |
| delete_maintenance_records | DELETE | `auth_user_role() = 'admin'` | — |

### `notification_templates` — 🔒 RLS

> Plantillas automáticas: Zoom, cobros, alertas (RF-016, RF-017)

| Columna | Tipo | Null | Default | FK |
|---------|------|------|---------|----|
| `id` PK | SERIAL | NO | — | — |
| `name` | TEXT | NO | — | — |
| `type` | TEXT | sí | — | — |
| `subject` | TEXT | sí | — | — |
| `body` | TEXT | NO | — | — |
| `active` | BOOLEAN | sí | `true` | — |
| `created_at` | TIMESTAMPTZ | sí | `NOW()` | — |

**Policies:**

| Policy | Cmd | USING | WITH CHECK |
|--------|-----|-------|------------|
| select_notification_templates | SELECT | `auth_user_role() IN ('admin', 'secretary')` | — |
| insert_notification_templates | INSERT | — | `auth_user_role() = 'admin'` |
| update_notification_templates | UPDATE | `auth_user_role() = 'admin'` | — |
| delete_notification_templates | DELETE | `auth_user_role() = 'admin'` | — |

### `notifications` — 🔒 RLS

> Notificaciones individuales y masivas: email, WhatsApp, sistema (RF-019, RF-020)

| Columna | Tipo | Null | Default | FK |
|---------|------|------|---------|----|
| `id` PK | SERIAL | NO | — | — |
| `recipient_id` | INT | sí | — | → `users.id` |
| `type` | TEXT | sí | — | — |
| `subject` | TEXT | sí | — | — |
| `message` | TEXT | NO | — | — |
| `read` | BOOLEAN | sí | `false` | — |
| `sent_at` | TIMESTAMPTZ | sí | — | — |
| `sent_ok` | BOOLEAN | sí | `false` | — |
| `send_error` | TEXT | sí | — | — |
| `reference_type` | TEXT | sí | — | — |
| `reference_id` | INT | sí | — | — |
| `created_at` | TIMESTAMPTZ | sí | `NOW()` | — |

**Policies:**

| Policy | Cmd | USING | WITH CHECK |
|--------|-----|-------|------------|
| select_notifications | SELECT | `auth_user_role() = 'admin' OR recipient_id = auth_user_id()` | — |
| update_notifications | UPDATE | `auth_user_role() = 'admin' OR recipient_id = auth_user_id()` | — |
| delete_notifications | DELETE | `auth_user_role() = 'admin'` | — |
| insert_notifications | INSERT | — | `auth_user_role() IN ('admin', 'secretary')` |

**Índices:** `idx_unread_notifications`

### `payment_attempts` — 🔒 RLS

| Columna | Tipo | Null | Default | FK |
|---------|------|------|---------|----|
| `id` PK | SERIAL | NO | — | — |
| `session_token` UQ | TEXT | NO | — | — |
| `status` | TEXT | NO | `'pending'` | — |
| `draft_snapshot` | JSONB | NO | `'{}'` | — |
| `enrollment_id` | INTEGER | sí | — | → `enrollments.id` |
| `transbank_token` | TEXT | sí | — | — |
| `created_at` | TIMESTAMPTZ | NO | `now()` | — |
| `expires_at` | TIMESTAMPTZ | NO | `(now()` | — |

**Índices:** `idx_payment_attempts_session`, `idx_payment_attempts_transbank`

### `payment_denominations` — 🔒 RLS

> Desglose de billetes y monedas por transacción en efectivo

| Columna | Tipo | Null | Default | FK |
|---------|------|------|---------|----|
| `id` PK | SERIAL | NO | — | — |
| `payment_id` | INT | NO | — | → `payments.id` |
| `denomination` | INTEGER | NO | — | — |
| `quantity` | SMALLINT | NO | — | — |
| `created_at` | TIMESTAMPTZ | sí | `NOW()` | — |

**Policies:**

| Policy | Cmd | USING | WITH CHECK |
|--------|-----|-------|------------|
| select_payment_denominations | SELECT | `auth_user_role() IN ('admin', 'secretary')` | — |
| insert_payment_denominations | INSERT | — | `auth_user_role() IN ('admin', 'secretary')` |
| update_payment_denominations | UPDATE | `auth_user_role() = 'admin'` | — |
| delete_payment_denominations | DELETE | `auth_user_role() = 'admin'` | — |

### `payments` — 🔒 RLS

> Pagos por matrícula y servicios: efectivo, voucher, transferencia, tarjeta (RF-026, RF-027)

| Columna | Tipo | Null | Default | FK |
|---------|------|------|---------|----|
| `id` PK | SERIAL | NO | — | — |
| `enrollment_id` | INT | NO | — | → `enrollments.id` |
| `type` | TEXT | sí | — | — |
| `document_number` | TEXT | sí | — | — |
| `total_amount` | INTEGER | NO | — | — |
| `cash_amount` | INTEGER | sí | `0` | — |
| `transfer_amount` | INTEGER | sí | `0` | — |
| `card_amount` | INTEGER | sí | `0` | — |
| `voucher_amount` | INTEGER | sí | `0` | — |
| `status` | TEXT | sí | — | — |
| `payment_date` | DATE | sí | — | — |
| `receipt_url` | TEXT | sí | — | — |
| `requires_receipt` | BOOLEAN | sí | `true` | — |
| `receipt_id` | INT | sí | — | → `sii_receipts.id` |
| `registered_by` | INT | sí | — | → `users.id` |
| `created_at` | TIMESTAMPTZ | sí | `NOW()` | — |

**Policies:**

| Policy | Cmd | USING | WITH CHECK |
|--------|-----|-------|------------|
| select_payments | SELECT | `auth_user_role() IN ('admin', 'secretary') OR (auth_user_role() = 'student' A…` | — |
| insert_payments | INSERT | — | `auth_user_role() IN ('admin', 'secretary')` |
| update_payments | UPDATE | `auth_user_role() IN ('admin', 'secretary')` | — |
| delete_payments | DELETE | `auth_user_role() = 'admin'` | — |

### `pricing_seasons` — 🔒 RLS

> Temporadas de precios especiales (RF-110)

| Columna | Tipo | Null | Default | FK |
|---------|------|------|---------|----|
| `id` PK | SERIAL | NO | — | — |
| `name` | TEXT | sí | — | — |
| `price_class_b` | INTEGER | sí | — | — |
| `price_a2` | INTEGER | sí | — | — |
| `start_date` | DATE | sí | — | — |
| `end_date` | DATE | sí | — | — |
| `active` | BOOLEAN | sí | `false` | — |
| `created_by` | INT | sí | — | → `users.id` |
| `created_at` | TIMESTAMPTZ | sí | `NOW()` | — |

**Policies:**

| Policy | Cmd | USING | WITH CHECK |
|--------|-----|-------|------------|
| all_pricing_seasons | ALL | `auth_user_role() = 'admin'` | — |

### `professional_final_records` — 🔒 RLS

> Resultado final Aprobado/Reprobado del alumno en promoción profesional (RF-074)

| Columna | Tipo | Null | Default | FK |
|---------|------|------|---------|----|
| `id` PK | SERIAL | NO | — | — |
| `enrollment_id` UQ | INT | NO | — | → `enrollments.id` |
| `result` | TEXT | NO | — | — |
| `final_grade` | NUMERIC(3,1) | sí | — | — |
| `practical_exam_passed` | BOOLEAN | sí | — | — |
| `theory_attendance_pct` | NUMERIC(5,2) | sí | — | — |
| `practical_attendance_pct` | NUMERIC(5,2) | sí | — | — |
| `notes` | TEXT | sí | — | — |
| `record_date` | DATE | NO | — | — |
| `registered_by` | INT | sí | — | → `users.id` |
| `created_at` | TIMESTAMPTZ | sí | `NOW()` | — |

**Policies:**

| Policy | Cmd | USING | WITH CHECK |
|--------|-----|-------|------------|
| select_prof_final_records | SELECT | `auth_user_role() IN ('admin', 'secretary') OR (auth_user_role() = 'student' A…` | — |
| insert_prof_final_records | INSERT | — | `auth_user_role() IN ('admin', 'secretary')` |
| update_prof_final_records | UPDATE | `auth_user_role() IN ('admin', 'secretary')` | — |
| delete_prof_final_records | DELETE | `auth_user_role() IN ('admin', 'secretary')` | — |

### `professional_module_grades` — 🔒 RLS

> Notas por módulo técnico profesional, escala MTT 10–100, mínimo aprobación 75 (RF-072). '
  '7 módulos por curso; módulo 5 varía según license_class (A2/A3 = Pasajeros, A4/A5 = Carga).

| Columna | Tipo | Null | Default | FK |
|---------|------|------|---------|----|
| `id` PK | SERIAL | NO | — | — |
| `enrollment_id` | INT | NO | — | → `enrollments.id` |
| `module` | TEXT | NO | — | — |
| `grade` | NUMERIC(5,1) | sí | — | — |
| `passed` | BOOLEAN | sí | — | — |
| `template_id` | INT | sí | — | — |
| `recorded_by` | INT | sí | — | → `users.id` |
| `created_at` | TIMESTAMPTZ | sí | `NOW()` | — |
| `updated_at` | TIMESTAMPTZ | sí | `NOW()` | — |
| `module_number` | SMALLINT | sí | — | — |
| `status` | TEXT | NO | `'draft'` | — |

**Policies:**

| Policy | Cmd | USING | WITH CHECK |
|--------|-----|-------|------------|
| select_prof_module_grades | SELECT | `auth_user_role() IN ('admin', 'secretary') OR (auth_user_role() = 'student' A…` | — |
| insert_prof_module_grades | INSERT | — | `auth_user_role() IN ('admin', 'secretary')` |
| update_prof_module_grades | UPDATE | `auth_user_role() IN ('admin', 'secretary')` | — |
| delete_prof_module_grades | DELETE | `auth_user_role() IN ('admin', 'secretary')` | — |

**Índices:** `idx_prof_module_grades_enrollment`

### `professional_practice_attendance` — 🔒 RLS

> Asistencia a bloques prácticos profesionales con porcentaje (RF-068)

| Columna | Tipo | Null | Default | FK |
|---------|------|------|---------|----|
| `id` PK | SERIAL | NO | — | — |
| `session_id` | INT | NO | — | → `professional_practice_sessions.id` |
| `enrollment_id` | INT | NO | — | → `enrollments.id` |
| `status` | TEXT | sí | — | — |
| `block_percentage` | NUMERIC(5,2) | sí | `100.0` | — |
| `justification` | TEXT | sí | — | — |
| `evidence_id` | INT | sí | — | → `absence_evidence.id` |
| `recorded_by` | INT | sí | — | → `users.id` |
| `recorded_at` | TIMESTAMPTZ | sí | `NOW()` | — |

**Policies:**

| Policy | Cmd | USING | WITH CHECK |
|--------|-----|-------|------------|
| insert_prof_practice_attendance | INSERT | — | `auth_user_role() IN ('admin', 'secretary')` |
| update_prof_practice_attendance | UPDATE | `auth_user_role() IN ('admin', 'secretary')` | — |
| delete_prof_practice_attendance | DELETE | `auth_user_role() IN ('admin', 'secretary')` | — |
| select_prof_practice_attendance | SELECT | `auth_user_role() IN ('admin', 'secretary') OR ( auth_user_role() = 'student' …` | — |

**Índices:** `idx_professional_practice_attendance_enrollment`

### `professional_practice_sessions` — 🔒 RLS

> Sesiones prácticas de campo por curso dentro de una promoción profesional (RF-068)

| Columna | Tipo | Null | Default | FK |
|---------|------|------|---------|----|
| `id` PK | SERIAL | NO | — | — |
| `promotion_course_id` | INT | NO | — | → `promotion_courses.id` |
| `date` | DATE | NO | — | — |
| `start_time` | TIME | sí | — | — |
| `end_time` | TIME | sí | — | — |
| `status` | TEXT | sí | — | — |
| `notes` | TEXT | sí | — | — |
| `registered_by` | INT | sí | — | → `users.id` |
| `created_at` | TIMESTAMPTZ | sí | `NOW()` | — |

**Policies:**

| Policy | Cmd | USING | WITH CHECK |
|--------|-----|-------|------------|
| select_prof_practice_sessions | SELECT | `auth_user_role() IN ('admin', 'secretary') OR (auth_user_role() = 'student' A…` | — |
| insert_prof_practice_sessions | INSERT | — | `auth_user_role() IN ('admin', 'secretary')` |
| update_prof_practice_sessions | UPDATE | `auth_user_role() IN ('admin', 'secretary')` | — |
| delete_prof_practice_sessions | DELETE | `auth_user_role() IN ('admin', 'secretary')` | — |

**Índices:** `idx_professional_sessions_course`

### `professional_pre_registrations` — 🔒 RLS

> Pre-inscripción Clase Profesional con test psicológico y expiración automática

| Columna | Tipo | Null | Default | FK |
|---------|------|------|---------|----|
| `id` PK | SERIAL | NO | — | — |
| `temp_user_id` UQ | INT | NO | — | → `users.id` |
| `desired_course_class` | TEXT | sí | — | — |
| `psych_test_status` | TEXT | sí | `'not_started'` | — |
| `psych_test_result` | TEXT | sí | — | — |
| `registered_at` | TIMESTAMPTZ | NO | `NOW()` | — |
| `expires_at` | TIMESTAMPTZ | NO | — | — |
| `status` | TEXT | sí | `'pending_review'` | — |
| `converted_enrollment_id` | INT | sí | — | → `enrollments.id` |
| `psych_test_answers` | JSONB | sí | — | — |
| `psych_test_completed_at` | TIMESTAMPTZ | sí | — | — |
| `branch_id` | INT | sí | — | → `branches.id` |
| `requested_license_class` | TEXT | sí | — | — |
| `convalidates_simultaneously` | BOOLEAN | NO | `false` | — |
| `registration_channel` | TEXT | NO | `'presencial'` | — |
| `notes` | TEXT | sí | — | — |
| `psych_evaluated_by` | INT | sí | — | → `users.id` |
| `psych_evaluated_at` | TIMESTAMPTZ | sí | — | — |
| `psych_rejection_reason` | TEXT | sí | — | — |
| `birth_date` | DATE | sí | — | — |
| `gender` | CHAR(1) | sí | — | — |
| `address` | TEXT | sí | — | — |

**Policies:**

| Policy | Cmd | USING | WITH CHECK |
|--------|-----|-------|------------|
| select_pre_registrations | SELECT | `auth_user_role() IN ('admin', 'secretary')` | — |
| insert_pre_registrations | INSERT | — | `auth_user_role() IN ('admin', 'secretary')` |
| update_pre_registrations | UPDATE | `auth_user_role() IN ('admin', 'secretary')` | — |
| delete_pre_registrations | DELETE | `auth_user_role() IN ('admin', 'secretary')` | — |

### `professional_promotions` — 🔒 RLS

> Período de 30 días que agrupa hasta 4 cursos profesionales en paralelo (RF-059)

| Columna | Tipo | Null | Default | FK |
|---------|------|------|---------|----|
| `id` PK | SERIAL | NO | — | — |
| `code` UQ | TEXT | sí | — | — |
| `name` | TEXT | sí | — | — |
| `start_date` | DATE | NO | — | — |
| `end_date` | DATE | sí | — | — |
| `max_students` | SMALLINT | sí | `100` | — |
| `status` | TEXT | sí | — | — |
| `current_day` | SMALLINT | sí | `0` | — |
| `branch_id` | INT | sí | — | → `branches.id` |
| `created_at` | TIMESTAMPTZ | sí | `NOW()` | — |
| `updated_at` | TIMESTAMPTZ | NO | `now()` | — |

**Policies:**

| Policy | Cmd | USING | WITH CHECK |
|--------|-----|-------|------------|
| select_professional_promotions | SELECT | `auth_user_role() IN ('admin', 'secretary', 'student')` | — |
| insert_professional_promotions | INSERT | — | `auth_user_role() IN ('admin', 'secretary')` |
| update_professional_promotions | UPDATE | `auth_user_role() IN ('admin', 'secretary')` | — |
| delete_professional_promotions | DELETE | `auth_user_role() IN ('admin', 'secretary')` | — |

### `professional_theory_attendance` — 🔒 RLS

> Asistencia a clases teóricas Zoom profesionales, marcado manual (RF-078)

| Columna | Tipo | Null | Default | FK |
|---------|------|------|---------|----|
| `id` PK | SERIAL | NO | — | — |
| `theory_session_prof_id` | INT | NO | — | → `professional_theory_sessions.id` |
| `enrollment_id` | INT | NO | — | → `enrollments.id` |
| `status` | TEXT | sí | — | — |
| `justification` | TEXT | sí | — | — |
| `evidence_id` | INT | sí | — | → `absence_evidence.id` |
| `recorded_by` | INT | sí | — | → `users.id` |
| `recorded_at` | TIMESTAMPTZ | sí | `NOW()` | — |

**Policies:**

| Policy | Cmd | USING | WITH CHECK |
|--------|-----|-------|------------|
| insert_prof_theory_attendance | INSERT | — | `auth_user_role() IN ('admin', 'secretary')` |
| update_prof_theory_attendance | UPDATE | `auth_user_role() IN ('admin', 'secretary')` | — |
| delete_prof_theory_attendance | DELETE | `auth_user_role() IN ('admin', 'secretary')` | — |
| select_prof_theory_attendance | SELECT | `auth_user_role() IN ('admin', 'secretary') OR ( auth_user_role() = 'student' …` | — |

**Índices:** `idx_professional_theory_attendance_enrollment`

### `professional_theory_sessions` — 🔒 RLS

> Sesiones teóricas Zoom por curso dentro de una promoción profesional (RF-016, RF-078)

| Columna | Tipo | Null | Default | FK |
|---------|------|------|---------|----|
| `id` PK | SERIAL | NO | — | — |
| `promotion_course_id` | INT | NO | — | → `promotion_courses.id` |
| `date` | DATE | NO | — | — |
| `start_time` | TIME | sí | — | — |
| `end_time` | TIME | sí | — | — |
| `status` | TEXT | sí | — | — |
| `zoom_link` | TEXT | sí | — | — |
| `notes` | TEXT | sí | — | — |
| `registered_by` | INT | sí | — | → `users.id` |
| `created_at` | TIMESTAMPTZ | sí | `NOW()` | — |

**Policies:**

| Policy | Cmd | USING | WITH CHECK |
|--------|-----|-------|------------|
| select_prof_theory_sessions | SELECT | `auth_user_role() IN ('admin', 'secretary', 'student')` | — |
| insert_prof_theory_sessions | INSERT | — | `auth_user_role() IN ('admin', 'secretary')` |
| update_prof_theory_sessions | UPDATE | `auth_user_role() IN ('admin', 'secretary')` | — |
| delete_prof_theory_sessions | DELETE | `auth_user_role() IN ('admin', 'secretary')` | — |

**Índices:** `idx_professional_theory_sessions_course`

### `professional_weekly_signatures` — 🔒 RLS

> Registro de firma semanal presencial de alumnos de Clase Profesional. '
  'Una fila por alumno × semana, registrada por secretaría al cierre de la semana. '
  'week_start_date es siempre el lunes de la semana correspondiente.

| Columna | Tipo | Null | Default | FK |
|---------|------|------|---------|----|
| `id` PK | SERIAL | NO | — | — |
| `promotion_course_id` | INT | NO | — | → `promotion_courses.id` |
| `enrollment_id` | INT | NO | — | → `enrollments.id` |
| `week_start_date` | DATE | NO | — | — |
| `signed_at` | TIMESTAMPTZ | NO | `now()` | — |
| `recorded_by` | INT | NO | — | → `users.id` |
| `notes` | TEXT | sí | — | — |

### `promotion_course_lecturers` — 🔒 RLS

> Relación N:M entre cursos de promoción y relatores. Un curso puede tener '
  'múltiples relatores con rol opcional (theory|practice|both).

| Columna | Tipo | Null | Default | FK |
|---------|------|------|---------|----|
| `id` PK | SERIAL | NO | — | — |
| `promotion_course_id` | INT | NO | — | → `promotion_courses.id` |
| `lecturer_id` | INT | NO | — | → `lecturers.id` |
| `role` | TEXT | sí | — | — |
| `created_at` | TIMESTAMPTZ | sí | `NOW()` | — |

**Policies:**

| Policy | Cmd | USING | WITH CHECK |
|--------|-----|-------|------------|
| select_promotion_course_lecturers | SELECT | `true` | — |

**Índices:** `idx_pcl_lecturer`, `idx_pcl_promotion_course`

### `promotion_courses` — 🔒 RLS

> Curso específico (A2/A3/A4/A5) dentro de una promoción, con relator y cupo de 25 (RF-059)

| Columna | Tipo | Null | Default | FK |
|---------|------|------|---------|----|
| `id` PK | SERIAL | NO | — | — |
| `promotion_id` | INT | NO | — | → `professional_promotions.id` |
| `course_id` | INT | NO | — | → `courses.id` |
| `max_students` | SMALLINT | sí | `25` | — |
| `status` | TEXT | sí | — | — |
| `created_at` | TIMESTAMPTZ | sí | `NOW()` | — |
| `code` | TEXT | sí | — | — |

**Policies:**

| Policy | Cmd | USING | WITH CHECK |
|--------|-----|-------|------------|
| select_promotion_courses | SELECT | `auth_user_role() IN ('admin', 'secretary', 'student')` | — |
| insert_promotion_courses | INSERT | — | `auth_user_role() IN ('admin', 'secretary')` |
| update_promotion_courses | UPDATE | `auth_user_role() IN ('admin', 'secretary')` | — |
| delete_promotion_courses | DELETE | `auth_user_role() IN ('admin', 'secretary')` | — |

**Índices:** `idx_promotion_courses_promotion`

### `public_enrollment_throttle` — 🔒 RLS

| Columna | Tipo | Null | Default | FK |
|---------|------|------|---------|----|
| `id` PK | BIGSERIAL | NO | — | — |
| `ip` | TEXT | NO | — | — |
| `action` | TEXT | NO | — | — |
| `created_at` | TIMESTAMPTZ | NO | `now()` | — |

**Índices:** `idx_pe_throttle_lookup`

### `roles` — 🔒 RLS

> Catálogo de roles del sistema con permisos granulares (RF-005)

| Columna | Tipo | Null | Default | FK |
|---------|------|------|---------|----|
| `id` PK | SERIAL | NO | — | — |
| `name` UQ | TEXT | NO | — | — |
| `description` | TEXT | sí | — | — |
| `created_at` | TIMESTAMPTZ | sí | `NOW()` | — |

**Policies:**

| Policy | Cmd | USING | WITH CHECK |
|--------|-----|-------|------------|
| select_roles | SELECT | `(SELECT auth.uid()) IS NOT NULL` | — |
| insert_roles | INSERT | — | `auth_user_role() = 'admin'` |
| update_roles | UPDATE | `auth_user_role() = 'admin'` | — |
| delete_roles | DELETE | `auth_user_role() = 'admin'` | — |

### `route_incidents` — 🔒 RLS

> Incidentes asociados a vehículo e instructor durante Clase B (RF-111)

| Columna | Tipo | Null | Default | FK |
|---------|------|------|---------|----|
| `id` PK | SERIAL | NO | — | — |
| `vehicle_id` | INT | NO | — | → `vehicles.id` |
| `instructor_id` | INT | NO | — | → `instructors.id` |
| `class_b_session_id` | INT | sí | — | → `class_b_sessions.id` |
| `occurred_at` | TIMESTAMPTZ | sí | — | — |
| `description` | TEXT | NO | — | — |
| `type` | TEXT | sí | — | — |
| `evidence_url` | TEXT | sí | — | — |
| `registered_by` | INT | sí | — | → `users.id` |
| `created_at` | TIMESTAMPTZ | sí | `NOW()` | — |

**Policies:**

| Policy | Cmd | USING | WITH CHECK |
|--------|-----|-------|------------|
| select_route_incidents | SELECT | `auth_user_role() IN ('admin', 'secretary') OR (auth_user_role() = 'instructor…` | — |
| insert_route_incidents | INSERT | — | `auth_user_role() IN ('admin', 'secretary') OR (auth_user_role() = 'instructor…` |
| update_route_incidents | UPDATE | `auth_user_role() = 'admin'` | — |
| delete_route_incidents | DELETE | `auth_user_role() = 'admin'` | — |

### `school_documents` — 🔒 RLS

> Documentos institucionales: facturas folios, resoluciones MTT, decretos. Solo Admin elimina.

| Columna | Tipo | Null | Default | FK |
|---------|------|------|---------|----|
| `id` PK | SERIAL | NO | — | — |
| `type` | TEXT | NO | — | — |
| `file_name` | TEXT | NO | — | — |
| `storage_url` | TEXT | NO | — | — |
| `description` | TEXT | sí | — | — |
| `branch_id` | INT | sí | — | → `branches.id` |
| `uploaded_by` | INT | sí | — | → `users.id` |
| `created_at` | TIMESTAMPTZ | sí | `NOW()` | — |

**Policies:**

| Policy | Cmd | USING | WITH CHECK |
|--------|-----|-------|------------|
| select_school_documents | SELECT | `auth_user_role() IN ('admin', 'secretary')` | — |
| insert_school_documents | INSERT | — | `auth_user_role() IN ('admin', 'secretary')` |
| update_school_documents | UPDATE | `auth_user_role() = 'admin'` | — |
| delete_school_documents | DELETE | `auth_user_role() = 'admin'` | — |

### `school_schedules` — 🔒 RLS

> Horarios de operación por sede y día de semana (RF-095)

| Columna | Tipo | Null | Default | FK |
|---------|------|------|---------|----|
| `id` PK | SERIAL | NO | — | — |
| `branch_id` | INT | sí | — | → `branches.id` |
| `day_of_week` | SMALLINT | sí | — | — |
| `opening_time` | TIME | sí | — | — |
| `closing_time` | TIME | sí | — | — |
| `active` | BOOLEAN | sí | `true` | — |

**Policies:**

| Policy | Cmd | USING | WITH CHECK |
|--------|-----|-------|------------|
| select_school_schedules | SELECT | `(SELECT auth.uid()) IS NOT NULL` | — |
| insert_school_schedules | INSERT | — | `auth_user_role() = 'admin'` |
| update_school_schedules | UPDATE | `auth_user_role() = 'admin'` | — |
| delete_school_schedules | DELETE | `auth_user_role() = 'admin'` | — |

### `sence_codes` — 🔒 RLS

> Códigos SENCE para cursos con franquicia tributaria

| Columna | Tipo | Null | Default | FK |
|---------|------|------|---------|----|
| `id` PK | SERIAL | NO | — | — |
| `code` UQ | TEXT | NO | — | — |
| `description` | TEXT | sí | — | — |
| `course_id` | INT | sí | — | → `courses.id` |
| `valid` | BOOLEAN | sí | `true` | — |
| `start_date` | DATE | sí | — | — |
| `end_date` | DATE | sí | — | — |

**Policies:**

| Policy | Cmd | USING | WITH CHECK |
|--------|-----|-------|------------|
| select_sence_codes | SELECT | `auth_user_role() IN ('admin', 'secretary')` | — |
| insert_sence_codes | INSERT | — | `auth_user_role() = 'admin'` |
| update_sence_codes | UPDATE | `auth_user_role() = 'admin'` | — |
| delete_sence_codes | DELETE | `auth_user_role() = 'admin'` | — |

### `service_catalog` — 🔒 RLS

> Catálogo dinámico de servicios especiales con precio configurable (RF-034)

| Columna | Tipo | Null | Default | FK |
|---------|------|------|---------|----|
| `id` PK | SERIAL | NO | — | — |
| `name` | TEXT | NO | — | — |
| `description` | TEXT | sí | — | — |
| `base_price` | INTEGER | NO | — | — |
| `active` | BOOLEAN | sí | `true` | — |
| `created_at` | TIMESTAMPTZ | sí | `NOW()` | — |

**Policies:**

| Policy | Cmd | USING | WITH CHECK |
|--------|-----|-------|------------|
| select_service_catalog | SELECT | `(SELECT auth.uid()) IS NOT NULL` | — |
| insert_service_catalog | INSERT | — | `auth_user_role() IN ('admin', 'secretary')` |
| update_service_catalog | UPDATE | `auth_user_role() IN ('admin', 'secretary')` | — |
| delete_service_catalog | DELETE | `auth_user_role() IN ('admin', 'secretary')` | — |

### `session_machinery` — 🔒 RLS

> Maquinaria propia/arrendada registrada por sesión práctica profesional (RF-073)

| Columna | Tipo | Null | Default | FK |
|---------|------|------|---------|----|
| `id` PK | SERIAL | NO | — | — |
| `session_id` | INT | NO | — | → `professional_practice_sessions.id` |
| `type` | TEXT | sí | — | — |
| `description` | TEXT | sí | — | — |
| `rental_cost` | INTEGER | sí | — | — |
| `created_at` | TIMESTAMPTZ | sí | `NOW()` | — |

**Policies:**

| Policy | Cmd | USING | WITH CHECK |
|--------|-----|-------|------------|
| select_session_machinery | SELECT | `auth_user_role() IN ('admin', 'secretary')` | — |
| insert_session_machinery | INSERT | — | `auth_user_role() IN ('admin', 'secretary')` |
| update_session_machinery | UPDATE | `auth_user_role() IN ('admin', 'secretary')` | — |
| delete_session_machinery | DELETE | `auth_user_role() IN ('admin', 'secretary')` | — |

### `sii_receipts` — 🔒 RLS

> Boletas y facturas SII con desglose por concepto para cuadratura (RF-033)

| Columna | Tipo | Null | Default | FK |
|---------|------|------|---------|----|
| `id` PK | SERIAL | NO | — | — |
| `type` | TEXT | NO | `'boleta'` | — |
| `folio` | INTEGER | NO | — | — |
| `amount` | INTEGER | NO | — | — |
| `amount_class_b` | INTEGER | NO | `0` | — |
| `amount_class_a` | INTEGER | NO | `0` | — |
| `amount_sensometry` | INTEGER | NO | `0` | — |
| `amount_other` | INTEGER | NO | `0` | — |
| `issued_at` | TIMESTAMPTZ | sí | — | — |
| `status` | TEXT | sí | — | — |
| `recipient_tax_id` | TEXT | sí | — | — |
| `recipient_name` | TEXT | sí | — | — |
| `branch_id` | INT | sí | — | → `branches.id` |
| `created_at` | TIMESTAMPTZ | sí | `NOW()` | — |

**Policies:**

| Policy | Cmd | USING | WITH CHECK |
|--------|-----|-------|------------|
| select_sii_receipts | SELECT | `auth_user_role() IN ('admin', 'secretary')` | — |
| insert_sii_receipts | INSERT | — | `auth_user_role() IN ('admin', 'secretary')` |
| update_sii_receipts | UPDATE | `auth_user_role() = 'admin'` | — |
| delete_sii_receipts | DELETE | `auth_user_role() = 'admin'` | — |

### `slot_holds` — 🔒 RLS

| Columna | Tipo | Null | Default | FK |
|---------|------|------|---------|----|
| `id` PK | SERIAL | NO | — | — |
| `session_token` | TEXT | NO | — | — |
| `instructor_id` | INTEGER | NO | — | → `instructors.id` |
| `slot_start` | TIMESTAMPTZ | NO | — | — |
| `expires_at` | TIMESTAMPTZ | NO | `(now()` | — |
| `created_at` | TIMESTAMPTZ | NO | `now()` | — |

**Índices:** `idx_slot_holds_session`, `idx_slot_holds_slot_lookup`

### `special_service_sales` — 🔒 RLS

> Venta individual de servicios especiales con metadata variable por tipo (RF-034)

| Columna | Tipo | Null | Default | FK |
|---------|------|------|---------|----|
| `id` PK | SERIAL | NO | — | — |
| `student_id` | INT | sí | — | → `students.id` |
| `service_id` | INT | **sí** (fix-024-i, migración `20260813060000`) | — | → `service_catalog.id`, `NO ACTION` (sin CASCADE) |
| `service_name` | TEXT | sí (fix-024-i) | — | — |
| `sale_date` | DATE | NO | — | — |
| `price` | INTEGER | NO | — | — |
| `metadata` | JSONB | sí | — | — |
| `registered_by` | INT | sí | — | → `users.id` |
| `created_at` | TIMESTAMPTZ | sí | `NOW()` | — |
| `is_student` | BOOLEAN | NO | `false` | — |
| `client_name` | TEXT | sí | — | — |
| `client_rut` | TEXT | sí | — | — |
| `status` | TEXT | NO | `'pending'` | — |
| `paid` | BOOLEAN | NO | `false` | — |
| `branch_id` | INT | sí | — | → `branches.id` |

> **`service_id` nullable + `service_name` (fix-024-i):** `service_catalog` no tiene
> `ON DELETE CASCADE` en esta FK. Para permitir borrar un servicio del catálogo de forma
> permanente sin perder el historial de ventas, `ServiciosEspecialesFacade.borrarServicioDefinitivo()`
> desvincula (`service_id=null`) antes de borrar el catálogo. `service_name` es un snapshot del
> nombre tomado al momento de la venta (`registrarVenta()`) — sobrevive aunque el servicio
> origen deje de existir. `mapVentaDto()` prioriza `service_name` sobre el join a
> `service_catalog.name`. Ver DG-066.

**Policies:**

| Policy | Cmd | USING | WITH CHECK |
|--------|-----|-------|------------|
| select_special_service_sales | SELECT | `auth_user_role() IN ('admin', 'secretary') OR (auth_user_role() = 'student' A…` | — |
| insert_special_service_sales | INSERT | — | `auth_user_role() IN ('admin', 'secretary')` |
| update_special_service_sales | UPDATE | `auth_user_role() IN ('admin', 'secretary')` | — |
| delete_special_service_sales | DELETE | `auth_user_role() IN ('admin', 'secretary')` | — |

**Índices:** `idx_special_service_sales_branch_id`

### `standalone_course_enrollments` — 🔒 RLS

> Inscripción individual a cursos singulares grupales (RF-035)

| Columna | Tipo | Null | Default | FK |
|---------|------|------|---------|----|
| `id` PK | SERIAL | NO | — | — |
| `standalone_course_id` | INT | NO | — | → `standalone_courses.id` |
| `student_id` | INT | NO | — | → `students.id` |
| `amount_paid` | INTEGER | NO | — | — |
| `payment_status` | TEXT | sí | — | — |
| `certificate_id` | INT | sí | — | → `certificates.certificate_id` |
| `registered_by` | INT | sí | — | → `users.id` |
| `enrolled_at` | TIMESTAMPTZ | NO | `NOW()` | — |
| `payment_method` | TEXT | sí | `'efectivo'` | — |
| `discount_amount` | INTEGER | NO | `0` | — |
| `discount_reason` | TEXT | sí | — | — |
| `paid_at` | TIMESTAMPTZ | sí | — | — |

**Policies:**

| Policy | Cmd | USING | WITH CHECK |
|--------|-----|-------|------------|
| select_standalone_course_enrollments | SELECT | `auth_user_role() IN ('admin', 'secretary')` | — |
| insert_standalone_course_enrollments | INSERT | — | `auth_user_role() IN ('admin', 'secretary')` |
| update_standalone_course_enrollments | UPDATE | `auth_user_role() IN ('admin', 'secretary')` | — |
| delete_standalone_course_enrollments | DELETE | `auth_user_role() IN ('admin', 'secretary')` | — |

### `standalone_courses` — 🔒 RLS

> Cursos singulares grupales: SENCE, Grúa, Retroexcavadora, Maquinaria (RF-035)

| Columna | Tipo | Null | Default | FK |
|---------|------|------|---------|----|
| `id` PK | SERIAL | NO | — | — |
| `name` | TEXT | NO | — | — |
| `type` | TEXT | NO | — | — |
| `billing_type` | TEXT | NO | — | — |
| `base_price` | INTEGER | NO | — | — |
| `duration_hours` | INTEGER | NO | — | — |
| `max_students` | SMALLINT | NO | — | — |
| `start_date` | DATE | NO | — | — |
| `end_date` | DATE | sí | — | — |
| `status` | TEXT | sí | — | — |
| `branch_id` | INT | NO | — | → `branches.id` |
| `registered_by` | INT | sí | — | → `users.id` |
| `created_at` | TIMESTAMPTZ | sí | `NOW()` | — |
| `updated_at` | TIMESTAMPTZ | sí | `NOW()` | — |

**Policies:**

| Policy | Cmd | USING | WITH CHECK |
|--------|-----|-------|------------|
| select_standalone_courses | SELECT | `auth_user_role() IN ('admin', 'secretary')` | — |
| insert_standalone_courses | INSERT | — | `auth_user_role() IN ('admin', 'secretary')` |
| update_standalone_courses | UPDATE | `auth_user_role() IN ('admin', 'secretary')` | — |
| delete_standalone_courses | DELETE | `auth_user_role() IN ('admin', 'secretary')` | — |

### `student_documents` — 🔒 RLS

> Documentos del expediente digital del alumno: foto, cédula, HVC, cert. médico (RF-082)

| Columna | Tipo | Null | Default | FK |
|---------|------|------|---------|----|
| `id` PK | SERIAL | NO | — | — |
| `enrollment_id` | INT | NO | — | → `enrollments.id` |
| `type` | TEXT | sí | — | — |
| `file_name` | TEXT | NO | — | — |
| `storage_url` | TEXT | NO | — | — |
| `status` | TEXT | sí | — | — |
| `document_issue_date` | DATE | sí | — | — |
| `notes` | TEXT | sí | — | — |
| `uploaded_at` | TIMESTAMPTZ | sí | `NOW()` | — |
| `reviewed_by` | INT | sí | — | → `users.id` |
| `reviewed_at` | TIMESTAMPTZ | sí | — | — |

**Policies:**

| Policy | Cmd | USING | WITH CHECK |
|--------|-----|-------|------------|
| insert_student_documents | INSERT | — | `auth_user_role() IN ('admin', 'secretary') OR (auth_user_role() = 'student' A…` |
| delete_student_documents | DELETE | `auth_user_role() = 'admin' OR ( auth_user_role() = 'secretary' AND enrollment…` | — |
| update_student_documents | UPDATE | `auth_user_role() = 'admin' OR ( auth_user_role() = 'secretary' AND enrollment…` | — |

### `student_surveys` — 🔒 RLS

> Encuestas de satisfacción y confirmación de obtención de licencia post-egreso.

| Columna | Tipo | Null | Default | FK |
|---------|------|------|---------|----|
| `id` PK | SERIAL | NO | — | — |
| `enrollment_id` UQ | INT | NO | — | → `enrollments.id` |
| `obtained_license` | BOOLEAN | sí | `false` | — |
| `municipality` | TEXT | sí | — | — |
| `satisfaction_rating` | SMALLINT | NO | — | — |
| `comment` | TEXT | sí | — | — |
| `created_at` | TIMESTAMPTZ | sí | `NOW()` | — |

**Policies:**

| Policy | Cmd | USING | WITH CHECK |
|--------|-----|-------|------------|
| Surveys visibles para Admin y Sec | SELECT | `auth.uid() IN ( SELECT supabase_uid FROM users WHERE role_id IN (1, 2) )` | — |
| Allow authenticated read surveys | SELECT | `true` | — |

### `students` — 🔒 RLS

> Datos académicos y de licencia del alumno (RF-006, RF-082)

| Columna | Tipo | Null | Default | FK |
|---------|------|------|---------|----|
| `id` PK | SERIAL | NO | — | — |
| `user_id` UQ | INT | NO | — | → `users.id` |
| `birth_date` | DATE | NO | — | — |
| `gender` | CHAR(1) | sí | — | — |
| `address` | TEXT | sí | — | — |
| `is_minor` | BOOLEAN | sí | — | — |
| `has_notarial_auth` | BOOLEAN | sí | `false` | — |
| `current_license_class` | TEXT | sí | — | — |
| `license_obtained_date` | DATE | sí | — | — |
| `status` | TEXT | sí | — | — |
| `created_at` | TIMESTAMPTZ | sí | `NOW()` | — |

**Policies:**

| Policy | Cmd | USING | WITH CHECK |
|--------|-----|-------|------------|
| insert_students | INSERT | — | `auth_user_role() IN ('admin', 'secretary')` |
| update_students | UPDATE | `auth_user_role() IN ('admin', 'secretary')` | — |
| delete_students | DELETE | `auth_user_role() IN ('admin', 'secretary')` | — |

### `task_replies` — 🔒 RLS

> Respuestas en hilos type=question. Inmutables. Bloqueadas si task.status=completed (AC9).

| Columna | Tipo | Null | Default | FK |
|---------|------|------|---------|----|
| `id` PK | UUID | NO | `gen_random_uuid()` | — |
| `task_id` | UUID | NO | — | → `tasks.id` |
| `from_user_id` | INT | NO | — | → `users.id` |
| `body` | TEXT | NO | — | — |
| `created_at` | TIMESTAMPTZ | NO | `NOW()` | — |

**Policies:**

| Policy | Cmd | USING | WITH CHECK |
|--------|-----|-------|------------|
| task_replies_select | SELECT | `EXISTS ( SELECT 1 FROM tasks t WHERE t.id = task_id AND t.deleted_at IS NULL …` | — |
| task_replies_insert | INSERT | — | `from_user_id = auth_user_id() AND EXISTS ( SELECT 1 FROM tasks t WHERE t.id =…` |
| task_replies_delete | DELETE | `auth_user_role() = 'admin'` | — |

**Índices:** `idx_task_replies_task`

### `tasks` — 🔒 RLS

> Canal estructurado de comunicación multi-rol: admin↔secretary, secretary→instructor. '
  'Reemplaza secretary_observations. Spec 0001.

| Columna | Tipo | Null | Default | FK |
|---------|------|------|---------|----|
| `id` PK | UUID | NO | `gen_random_uuid()` | — |
| `branch_id` | INT | NO | — | → `branches.id` |
| `from_user_id` | INT | NO | — | → `users.id` |
| `from_role` | TEXT | NO | — | — |
| `to_user_id` | INT | NO | — | → `users.id` |
| `to_role` | TEXT | NO | — | — |
| `type` | TEXT | NO | — | — |
| `subject` | TEXT | NO | — | — |
| `body` | TEXT | sí | — | — |
| `status` | TEXT | NO | `'pending'` | — |
| `due_date` | TIMESTAMPTZ | sí | — | — |
| `completed_at` | TIMESTAMPTZ | sí | — | — |
| `seen_at` | TIMESTAMPTZ | sí | — | — |
| `seen_by` | INT | sí | — | → `users.id` |
| `created_at` | TIMESTAMPTZ | NO | `NOW()` | — |
| `updated_at` | TIMESTAMPTZ | NO | `NOW()` | — |
| `deleted_at` | TIMESTAMPTZ | sí | — | — |

**Policies:**

| Policy | Cmd | USING | WITH CHECK |
|--------|-----|-------|------------|
| tasks_select | SELECT | `deleted_at IS NULL AND ( (auth_user_role() = 'admin' AND branch_visible(branc…` | — |
| tasks_delete | DELETE | `auth_user_role() = 'admin' AND branch_visible(branch_id)` | — |
| tasks_insert | INSERT | — | `( auth_user_role() = 'admin' AND from_user_id = auth_user_id() AND from_role …` |

**Índices:** `idx_tasks_branch_status`, `idx_tasks_due_date`, `idx_tasks_from_user_status`, `idx_tasks_to_user_status`

### `users` — 🔒 RLS

> Todos los actores del sistema, incluyendo cuentas temporales de pre-inscripción (RF-001)

| Columna | Tipo | Null | Default | FK |
|---------|------|------|---------|----|
| `id` PK | SERIAL | NO | — | — |
| `supabase_uid` UQ | UUID | sí | — | — |
| `rut` UQ | TEXT | NO | — | — |
| `first_names` | TEXT | NO | — | — |
| `paternal_last_name` | TEXT | NO | — | — |
| `maternal_last_name` | TEXT | NO | — | — |
| `email` UQ | TEXT | NO | — | — |
| `phone` | TEXT | sí | — | — |
| `role_id` | INT | sí | — | → `roles.id` |
| `branch_id` | INT | sí | — | → `branches.id` |
| `can_access_both_branches` | BOOLEAN | sí | `false` | — |
| `active` | BOOLEAN | sí | `true` | — |
| `first_login` | BOOLEAN | sí | `true` | — |
| `created_at` | TIMESTAMPTZ | sí | `NOW()` | — |
| `updated_at` | TIMESTAMPTZ | sí | `NOW()` | — |

**Policies:**

| Policy | Cmd | USING | WITH CHECK |
|--------|-----|-------|------------|
| delete_users | DELETE | `auth_user_role() = 'admin'` | — |
| insert_users | INSERT | — | `auth_user_role() = 'admin' OR ( auth_user_role() = 'secretary' AND branch_vis…` |
| update_users | UPDATE | `auth_user_role() = 'admin' OR ( auth_user_role() = 'secretary' AND branch_vis…` | — |
| select_users | SELECT | `auth_user_role() = 'admin' OR auth_user_role() = 'secretary' OR (auth_user_ro…` | — |
| select_users_via_class_relationship | SELECT | `auth_user_role() = 'instructor' AND public.auth_instructor_can_view_student_u…` | — |

### `vehicle_assignments` — 🔒 RLS

> Historial de asignación instructor ↔ vehículo (RF-042, RF-045)

| Columna | Tipo | Null | Default | FK |
|---------|------|------|---------|----|
| `id` PK | SERIAL | NO | — | — |
| `instructor_id` | INT | NO | — | → `instructors.id` |
| `vehicle_id` | INT | NO | — | → `vehicles.vehicle_id` |
| `start_date` | DATE | NO | — | — |
| `end_date` | DATE | sí | — | — |
| `assigned_by` | INT | sí | — | → `users.id` |
| `reason` | TEXT | sí | — | — |
| `created_at` | TIMESTAMPTZ | sí | `NOW()` | — |

**Policies:**

| Policy | Cmd | USING | WITH CHECK |
|--------|-----|-------|------------|
| select_vehicle_assignments | SELECT | `auth_user_role() IN ('admin', 'secretary') OR (auth_user_role() = 'instructor…` | — |
| insert_vehicle_assignments | INSERT | — | `auth_user_role() = 'admin'` |
| update_vehicle_assignments | UPDATE | `auth_user_role() = 'admin'` | — |
| delete_vehicle_assignments | DELETE | `auth_user_role() = 'admin'` | — |

**Índices:** `idx_active_vehicle_assignment`, `idx_one_active_vehicle_per_instructor`

### `vehicle_documents` — 🔒 RLS

> SOAP, Rev. Técnica, Permiso Circulación, Seguro de cada vehículo (RF-021)

| Columna | Tipo | Null | Default | FK |
|---------|------|------|---------|----|
| `id` PK | SERIAL | NO | — | — |
| `vehicle_id` | INT | NO | — | → `vehicles.id` |
| `type` | TEXT | sí | — | — |
| `issue_date` | DATE | sí | — | — |
| `expiry_date` | DATE | NO | — | — |
| `status` | TEXT | sí | — | — |
| `file_url` | TEXT | sí | — | — |
| `created_at` | TIMESTAMPTZ | sí | `NOW()` | — |

**Policies:**

| Policy | Cmd | USING | WITH CHECK |
|--------|-----|-------|------------|
| select_vehicle_documents | SELECT | `auth_user_role() IN ('admin', 'secretary', 'instructor')` | — |
| insert_vehicle_documents | INSERT | — | `auth_user_role() = 'admin'` |
| update_vehicle_documents | UPDATE | `auth_user_role() = 'admin'` | — |
| delete_vehicle_documents | DELETE | `auth_user_role() = 'admin'` | — |

**Índices:** `idx_vehicle_docs_expiry`

**Constraints:** `vehicle_documents_vehicle_id_type_key` — `UNIQUE(vehicle_id, type)` (`20260811120000`, fix-153-m). Requerida por `FlotaFacade.upsertVehicleDocument()`, que hace `.upsert(..., { onConflict: 'vehicle_id,type' })` — sin esta constraint el upsert fallaba siempre (no había target de ON CONFLICT válido).

### `vehicles` — 🔒 RLS

> Flota de vehículos con patente, estado y kilometraje (RF-087)

| Columna | Tipo | Null | Default | FK |
|---------|------|------|---------|----|
| `id` PK | SERIAL | NO | — | — |
| `license_plate` UQ | TEXT | NO | — | — |
| `brand` | TEXT | NO | — | — |
| `model` | TEXT | NO | — | — |
| `year` | SMALLINT | NO | — | — |
| `body_type` | TEXT | sí | — | — |
| `transmission` | TEXT | sí | — | — |
| `branch_id` | INT | sí | — | → `branches.id` |
| `status` | TEXT | sí | — | — |
| `current_km` | INTEGER | sí | `0` | — |
| `last_inspection` | DATE | sí | — | — |
| `last_maintenance` | DATE | sí | — | — |
| `created_at` | TIMESTAMPTZ | sí | `NOW()` | — |
| `both_branches` | BOOLEAN | NO | `false` | — |

**Policies:**

| Policy | Cmd | USING | WITH CHECK |
|--------|-----|-------|------------|
| select_vehicles | SELECT | `auth_user_role() IN ('admin', 'secretary', 'instructor')` | — |
| delete_vehicles | DELETE | `auth_user_role() = 'admin'` | — |
| insert_vehicles | INSERT | — | `auth_user_role() = 'admin' OR (auth_user_role() = 'secretary' AND branch_id =…` |
| update_vehicles | UPDATE | `auth_user_role() = 'admin' OR (auth_user_role() = 'secretary' AND branch_id =…` | — |

### `website_config` — 🔒 RLS

| Columna | Tipo | Null | Default | FK |
|---------|------|------|---------|----|
| `id` PK | SERIAL | NO | — | — |
| `branch_id` UQ | INT | NO | — | → `branches.id` |
| `config` | JSONB | NO | — | — |
| `created_at` | TIMESTAMPTZ | NO | `now()` | — |
| `updated_at` | TIMESTAMPTZ | NO | `now()` | — |

**Policies:**

| Policy | Cmd | USING | WITH CHECK |
|--------|-----|-------|------------|
| select_website_config | SELECT | `true` | — |
| insert_website_config | INSERT | — | `auth_user_role() = 'admin' OR (auth_user_role() = 'secretary' AND branch_visi…` |
| update_website_config | UPDATE | `auth_user_role() = 'admin' OR (auth_user_role() = 'secretary' AND branch_visi…` | — |
| delete_website_config | DELETE | `auth_user_role() = 'admin' OR (auth_user_role() = 'secretary' AND branch_visi…` | — |

## Vistas

| Vista | Definida en |
|-------|-------------|
| `v_class_b_schedule_availability` | `20260730100000_instructors_vehicles_both_branches.sql` |
| `v_dms_student_documents` | `20260404120000_academic_alter_remove_redundant_student_id.sql` |
| `v_professional_attendance` | `20260404120000_academic_alter_remove_redundant_student_id.sql` |
| `v_student_progress_b` | `20260630000000_class_b_theory_cycles.sql` |

## Funciones (helpers RLS y lógica de BD)

| Función | Argumentos |
|---------|-----------|
| `apply_class_b_absence_penalty` | `(p_enrollment_id INT)` |
| `assign_theory_cycle` | `()` |
| `audit_format_evaluation_checklist` | `(p_value TEXT)` |
| `audit_format_timestamp_value` | `(p_value TEXT)` |
| `audit_humanize_column` | `(p_key TEXT)` |
| `audit_humanize_enum_value` | `(p_value TEXT)` |
| `audit_resolve_display_value` | `(p_column TEXT, p_value TEXT)` |
| `auth_can_access_both_branches` | `()` |
| `auth_can_enroll_course_type` | `(p_course_id INT)` |
| `auth_instructor_can_view_student_user` | `(target_user_id integer)` |
| `auth_instructor_id` | `()` |
| `auth_student_id` | `()` |
| `auth_user_branch_id` | `()` |
| `auth_user_id` | `()` |
| `auth_user_role` | `()` |
| `auto_transition_promotion_status` | `()` |
| `auto_transition_standalone_course_status` | `()` |
| `auto_transition_theory_cycle_status` | `()` |
| `branch_visible` | `(p_branch_id INT)` |
| `calculate_vehicle_document_status` | `()` |
| `cascade_promotion_status_to_courses` | `()` |
| `check_payment_within_pending_balance` | `()` |
| `check_standalone_course_capacity` | `()` |
| `cleanup_expired_drafts` | `()` |
| `cleanup_expired_public_enrollment` | `()` |
| `cleanup_public_enrollment_throttle` | `()` |
| `confirm_enrollment_with_payment` | `(p_enrollment_id INTEGER, p_payment_method TEXT, p_total_amount INTEGER, p_discount_id INTEGER DEFAULT NULL, p_discount_amount INTEGER DEFAULT 0, p_registered_by INTEGER DEFAULT NULL, p_is_deposit BOOLEAN DEFAULT FALSE)` |
| `decrement_batch_folio` | `()` |
| `ensure_theory_cycle` | `(p_branch_id INT, p_ref_date DATE)` |
| `generate_license_alert` | `()` |
| `generate_sessions_from_promotion` | `()` |
| `get_next_enrollment_number` | `(p_course_id INT)` |
| `get_student_payment_status` | `(p_supabase_uid TEXT)` |
| `instructor_enrollment_ids` | `()` |
| `log_change` | `()` |
| `mark_end_of_day_class_b_absences` | `()` |
| `notify_class_b_completed` | `()` |
| `notify_deposit_reminder` | `()` |
| `notify_task_completed` | `()` |
| `notify_task_reply` | `()` |
| `notify_vehicle_document_expiry` | `()` |
| `prevent_concurrent_in_progress_class_b_sessions` | `()` |
| `prevent_courses_delete_when_in_website_config` | `()` |
| `prevent_double_booking_class_b_sessions` | `()` |
| `recalc_instructor_monthly_hours` | `(p_instructor_id INT, p_period TEXT)` |
| `recalculate_enrollment_balance` | `()` |
| `set_enrollment_license_group` | `()` |
| `soft_delete_task` | `(p_task_id UUID)` |
| `tasks_set_updated_at` | `()` |
| `trg_class_b_sessions_update_monthly_hours` | `()` |
| `trg_draft_to_pending_validation_fn` | `()` |
| `trg_enrollment_validation_fn` | `()` |
| `update_class_book_to_in_review` | `()` |
| `update_professional_attendance_flag` | `()` |
| `user_complete_first_login` | `()` |
| `validate_website_config_courses_fk` | `()` |
| `verify_class_b_certificate_enablement` | `()` |
| `verify_class_b_dropout_rule` | `()` |
| `verify_professional_certificate_enablement` | `()` |

## ⚠ Sentencias no parseadas (AC7 — revisar a mano)

- sentencia no entendida en 20260722000000_backfill_promotion_codes.sql: "WITH ordered AS ( SELECT id, ROW_NUMBER() OVER (ORDER BY start_date, id) AS r"


<!-- AUTO-GENERATED:END -->

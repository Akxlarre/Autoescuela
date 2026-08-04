# Fix: Detalle de auditoría poco útil (fallback "id=X" + sin vista de detalle completo)
> id: fix-097-m-auditoria-detalle-enriquecido
> refs: —
> status: done
> closed: 2026-08-01
> created: 2026-08-01

## Root Cause

El trigger `log_change()` (migración `20260614201000_enrich_audit_log_trigger.sql`) solo
resuelve un `entity_label` legible para un subconjunto de tablas (`enrollments`, `payments`,
`standalone_course_enrollments`, `special_service_sales`, `class_b_sessions`, `users`,
`students`, `professional_pre_registrations`). Cualquier otra tabla con trigger activo
(`student_documents`, `vehicle_documents`, `maintenance_records`, `class_b_theory_sessions`,
`professional_theory_sessions`, `professional_practice_sessions`,
`professional_module_grades`, `class_book`, `vehicles` en INSERT/DELETE, `certificates`) cae
al `ELSE` genérico y produce `"Creado: id=97"` — sin valor para quien audita.

Además, la columna "Detalles" de la tabla trunca el diff a una sola línea (`detalle` puede
superar 480 caracteres en `UPDATE`s con muchos campos modificados) y no hay forma de ver el
registro completo sin ir a la BD directamente.

## ACs Afectados

Ninguno — fix autónomo (mejora de auditoría reportada por el dueño, no ligada a una spec).

- AC-1: Todas las tablas con trigger activo que caían al fallback genérico (`student_documents`,
  `vehicle_documents`, `maintenance_records`, `certificates`, `vehicles`,
  `class_b_theory_sessions`, `promotion_courses`, `class_book`,
  `professional_theory_sessions`, `professional_practice_sessions`,
  `professional_module_grades`) resuelven un `entity_label` legible en vez de `id=X`.
- AC-2: Cada fila de la tabla de auditoría es clickeable y abre un drawer con el detalle
  completo (módulo, usuario, acción, fecha, sede, IP y el `detalle` sin truncar).
- AC-3: El resto de filas/columnas de la tabla no cambian de comportamiento (mismo
  paginado, mismos filtros).

## Cambio

- **Archivo:** `supabase/migrations/20260801120000_audit_log_enrich_missing_entities.sql`
  **Qué cambia:** `CREATE OR REPLACE FUNCTION log_change()` agrega una rama `ELSIF` por cada
  tabla listada en AC-1 (dejando intactas las ramas existentes y el resto de la función).
- **Archivo:** `src/app/features/admin/auditoria/audit-log-detail-drawer.component.ts` (nuevo)
  **Qué cambia:** Dumb component que muestra el detalle completo de un `AuditLogRow` dentro
  del host global de drawers.
- **Archivo:** `src/app/features/admin/auditoria/admin-auditoria.component.ts`
  **Qué cambia:** cada fila pasa a ser un `<button>` clickeable que abre el drawer con el log
  seleccionado.

## Test de Regresión

- `src/app/features/admin/auditoria/admin-auditoria.component.spec.ts > abre el drawer de detalle al hacer click en una fila` ✓

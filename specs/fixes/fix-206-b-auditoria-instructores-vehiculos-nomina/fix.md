# Fix: Cambios en instructores, asignación de vehículos y valor hora no quedan en la auditoría
> id: fix-206-b-auditoria-instructores-vehiculos-nomina
> refs: ASG-i-034 (sospecha S18, confirmada en fix-197-b) — decisión del owner 2026-10-07: auditar todo
> status: in_progress
> created: 2026-10-07

## Root Cause
[Confirmado contra producción el 2026-10-07.] `log_change()` está enganchada a 20 tablas, pero no a
`instructors`, `vehicle_assignments` ni `branch_payroll_config`. Desactivar un instructor, cambiarle
la licencia, asignarle o quitarle un vehículo o cambiar el valor hora de una sede (que mueve las
liquidaciones) no deja rastro en Auditoría ni en la actividad reciente. Solo queda lo que se toca en
`users` (nombre, correo).

## ACs Afectados
Ninguno de una spec previa. ACs propios:
- **F1:** INSERT/UPDATE/DELETE en las 3 tablas se registran en `audit_log` con sede y un texto legible
  ("Instructor Nombre Apellido", "Vehículo ABCD12 - Nombre Apellido", "Valor hora instructores - Sede").
- **F2:** el diff usa etiquetas en español (`both_branches` → "Ambas sedes", `amount_per_hour` →
  "Valor por hora"); `updated_by` no se lista como cambio (ninguna tabla ya auditada lo tiene; el autor
  ya va en `user_id`).
- **F3:** `branch_payroll_config` no tiene `id`: `entity_id` = `branch_id`.
- **F4:** Auditoría y la actividad reciente muestran módulo/nombre para las 3 entidades.
- **F5:** sin cambios para las 20 tablas ya auditadas.

## Cambio
- `supabase/migrations/20261007150000_fix206_audit_instructors_vehicle_assignments_payroll.sql` —
  `log_change()` (copia de producción + 3 ramas + `updated_by` en `v_skip_fields`),
  `audit_humanize_column()` (+2 claves) y los 3 triggers.
- `supabase/tests/audit/fix-206-b-auditoria-instructores.sql` — prueba en transacción con ROLLBACK.
- `src/app/core/models/ui/audit-log-row.model.ts` y `src/app/core/facades/dashboard.facade.ts` —
  nombres de las 3 entidades.

## Test de Regresión
- `supabase/tests/audit/fix-206-b-auditoria-instructores.sql` contra producción (todo dentro de un
  `BEGIN … ROLLBACK`, no deja datos).
- `npx vitest run src/app/core/facades/auditoria.facade.spec.ts src/app/core/facades/dashboard.facade.spec.ts`

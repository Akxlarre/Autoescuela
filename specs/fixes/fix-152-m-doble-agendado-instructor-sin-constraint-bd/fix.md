# Fix: Doble-agendado del mismo instructor sin constraint atómica en BD
> id: fix-152-m-doble-agendado-instructor-sin-constraint-bd
> refs: docs/UAT-PLAN.md — Paquete 3, caso "Intentar doble-agendar el mismo instructor en el mismo horario → debe ser imposible"
> status: done
> closed: 2026-08-11
> created: 2026-08-11

## Root Cause
No existe `UNIQUE`/`EXCLUDE` constraint en `class_b_sessions` sobre `(instructor_id, scheduled_at)`
(el único índice relacionado, `20260301000003_03_academy_class_b.sql:255-257`, es un índice normal,
no una restricción de integridad). La única protección hoy es que la vista
`v_class_b_schedule_availability` (`20260307130000_fix_schedule_availability_tz_and_constraints.sql:104-126`)
excluye slots ocupados **al leer**, y `AdminAlumnoDetalleFacade.reprogramarClase()`
(`admin-alumno-detalle.facade.ts:1320-1358`) hace `INSERT`/`UPDATE` directo sin re-validar el
conflicto de forma atómica en el momento de escribir.

Contraste: el caso de "clase en curso" (exclusión mutua) sí tiene un trigger de BD explícito
(`trg_prevent_concurrent_in_progress`, `20260804120000_class_b_sessions_exclusion_mutua_instructor.sql`).
Aquí no existe el equivalente para el estado `scheduled` — dos secretarias agendando el mismo slot
casi simultáneamente (o un insert manual/vía API que se salte la vista) pueden generar una colisión
real de instructor en dos clases al mismo tiempo.

## ACs Afectados
Ninguno — fix autónomo, hallazgo de auditoría UAT (Paquete 3), no ligado a una spec de negocio previa.

## Cambio
- **Archivo:** nueva migración SQL en `supabase/migrations/`
- **Qué cambia:** agregar una constraint (o trigger equivalente al de exclusión mutua de
  `in_progress`) sobre `class_b_sessions` que impida dos filas con el mismo `instructor_id` y
  `scheduled_at` (o rango solapado, si la duración de clase varía) en estados activos
  (`scheduled`/`in_progress`), a nivel de BD — no solo a nivel de vista de lectura.

## Test de Regresión
- Verificado manualmente contra la BD remota (`supabase db query --linked`, dentro de una
  transacción `BEGIN ... ROLLBACK` que instala función+trigger, corre los casos y revierte todo
  sin dejar datos de prueba):
  1. Insert base `instructor_id=X`, `scheduled_at='2099-01-01 10:00'`, `duration_min=45`,
     `status='scheduled'` → OK.
  2. Insert solapado (mismo instructor, `10:20`, dentro del rango `10:00–10:45`) → **rechazado**
     con `SQLSTATE P0001` ("El instructor ya tiene una clase agendada que se solapa con este
     horario.").
  3. Insert no solapado (mismo instructor, `12:00`, 2h después) → permitido.
  4. Insert `status='cancelled'` superpuesto con el bloque 10:00–10:45 → permitido (los
     cancelados no bloquean, igual que la vista de disponibilidad).
- No se agregó test automatizado en el repo porque no existe suite de integración contra Supabase
  real (mismo criterio que `trg_prevent_concurrent_in_progress`, verificado igual por SQL manual
  en `specs/specs/0001-i-ciclo-vida-clase-exclusion-cierre/acceptance.md`).
- **Pendiente de deploy:** la migración `20260811110000_fix152_class_b_sessions_prevent_double_booking.sql`
  está creada pero no pusheada a remoto (`npx supabase db push`) — igual que otras migraciones ya
  pendientes en el repo (`20260808120000` en adelante). Requiere confirmación del usuario antes de
  hacer push porque afecta la BD compartida.

# Fix: la secretaria no puede mandar tareas a un instructor "ambas sedes" de la otra sede
> id: fix-233-b-tareas-instructor-ambas-sedes
> refs: ASG-i-035 (checklist 035, S12 · B06) · fix-030-i
> status: done
> created: 2026-10-20

## Root Cause
Confirmado en la BD: la policy `tasks_insert` (migración `20260522000002`) exige, para una tarea
secretaria → instructor, que `tasks.branch_id` (la sede de la secretaria) sea la sede del instructor
(`users.branch_id`). No considera `instructors.both_branches`. El selector de destinatarios
(`TasksFacade.loadRecipients`, fix-030-i) sí ofrece a los instructores "ambas sedes" de la otra sede,
así que la tarea se rechazaba con 403 "Error al crear la tarea". Latente: hoy no hay instructores
activos con "ambas sedes".

Decisión del owner (2026-10-20): permitirlo en la BD — un instructor que trabaja en ambas sedes
recibe tareas de la secretaria de cualquiera de las dos.

## ACs Afectados
- 0001-b (tareas multi-rol) / fix-030-i: el picker ofrece solo destinatarios que la BD acepta.

## Cambio
- Migración `supabase/migrations/20261020120000_fix233_tasks_insert_instructor_ambas_sedes.sql`:
  recrea `tasks_insert` igual que antes + la secretaria acepta un instructor con `both_branches`
  aunque sea de la otra sede. Sin función nueva (la secretaria ya puede leer esos instructores).
- Test `supabase/tests/tareas/fix-233-b-tarea-instructor-ambas-sedes.sql`.

## Test de Regresión
- `supabase/tests/tareas/fix-233-b-tarea-instructor-ambas-sedes.sql` (impersona a la secretaria en un
  sub-bloque que aborta): instructor otra sede con "ambas" → se crea; sin "ambas" → 42501; misma sede → se crea.

## Verificación
- Antes de la migración el test falla en el caso esperado ("ambas sedes" → 42501).
- Aplicada en producción y registrada en `schema_migrations` (2026-10-20).
- Después: 3/3. Sin residuos (0 tareas E2E-fix233, 0 instructores con `both_branches`).
- `lint:arch` sin errores.

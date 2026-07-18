# Fix: Admin no aparece en selector de destinatarios de secretaria
> id: fix-001-b-admin-no-aparece-en-selector-de-secretaria
> refs: 0002-instructor-tareas-vista-por-tipo
> status: done
> created: 2026-05-22
> closed: 2026-05-22

## Root Cause

`loadRecipients()` aplicaba `.eq('branch_id', secretaryBranchId)` incondicionalmente
cuando `branchId !== null`. Como la secretaria siempre tiene un `branchId` no-nulo,
el filtro excluía a nivel PostgREST a los usuarios admin cuyo `branch_id` es distinto
o nulo — antes de que la política RLS (migración 004) pudiera hacerlos visibles.

## ACs Afectados

- AC6 (spec 0002): el selector de destinatarios de la secretaria debe incluir al admin
  para poder enviarle comunicaciones. El fix restaura esta visibilidad.

## Cambio

- **Archivo:** `src/app/core/facades/tasks.facade.ts` (línea 338)
- **Qué cambia:** El branch filter en `loadRecipients` ahora solo se aplica cuando
  `fromRole === 'admin'`. Para la secretaria, RLS ya maneja el scope correcto.

## Test de Regresión

- `src/app/core/facades/tasks.facade.spec.ts > TasksFacade > createTask() > AC1: returns true on success` ✓
- `src/app/core/facades/tasks.facade.spec.ts > TasksFacade > createTask() > AC1: calls createNotification after successful insert` ✓
- `src/app/core/facades/tasks.facade.spec.ts > TasksFacade > createTask() > returns false and calls toast.error on insert error` ✓

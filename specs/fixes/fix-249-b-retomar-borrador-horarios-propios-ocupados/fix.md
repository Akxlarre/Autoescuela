# Fix: al retomar un borrador con clases reservadas, sus horarios aparecen "ocupados" en el paso 2 (S15, H18)
> id: fix-249-b
> refs: fix-186-b
> status: done
> closed: 2026-11-10
> created: 2026-11-10

## Root Cause
`EnrollmentFacade.resumeDraft` repone los horarios elegidos (`_selectedSlotIds`) desde las
`class_b_sessions` 'reserved' del borrador, pero no los marca como propios
(`_ownReservedSlotIds`, que solo llena `saveAssignment`). La vista de disponibilidad ve esas
reservas como ocupadas, y `buildScheduleGrid` solo las vuelve 'available' si son propias. Al
retomar, las 12 clases se ven elegidas pero grises y deshabilitadas: se puede seguir con ellas,
pero no cambiar ninguna (quitar una la pierde para siempre). Sospecha S15 de `fix-058-i`.
Confirmado en `e2e/matricula-paso2.spec.ts` (H18): 12 de 12 horarios propios "ocupados".

## ACs Afectados
- 026-agenda-triple-match H18: al retomar un borrador, el instructor y los horarios quedan
  restaurados y siguen siendo propios (elegibles), como al volver del paso 3 (H17).

## Cambio
- **Archivo:** `src/app/core/facades/enrollment.facade.ts`
- **Qué cambia:** `resumeDraft` también marca como propios los horarios que repone.

## Test de Regresión
- `src/app/core/facades/enrollment.facade.spec.ts > resumeDraft — horarios reservados propios (fix-249-b)` ✓
- `e2e/matricula-paso2.spec.ts > H17 + H18 + H20` ✓

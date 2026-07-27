# Fix: Clases B vuelven "ocupadas" al volver al paso 2 del wizard de matrícula
> id: fix-082-m-clases-b-vuelven-ocupadas-al-volver-paso2
> refs: —
> status: done
> closed: 2026-07-27
> created: 2026-07-27

## Root Cause
Al confirmar el paso 2 (selección de 12 clases prácticas), `EnrollmentFacade.saveAssignment()`
persiste de inmediato las sesiones elegidas en `class_b_sessions` con `status: 'reserved'`,
ligadas al `enrollment_id` del propio draft (`enrollment.facade.ts:1012-1022`).

Ese INSERT dispara el canal Realtime `schedule-instructor-{id}` (suscrito en
`subscribeToScheduleChanges`, `enrollment.facade.ts:1783-1799`), que llama a
`handleScheduleChange()` (`enrollment.facade.ts:1805-1832`). Este método re-consulta
`v_class_b_schedule_availability` — vista que marca un slot `occupied` si existe **cualquier**
sesión no cancelada de un enrollment no expirado que se solape (`20260513000001_class_b_schedule_exact_slots.sql:121-149`),
**sin excluir el propio `enrollment_id` del draft actual**. Como resultado, las 12 clases que el
alumno acaba de reservar para sí mismo vuelven marcadas `occupied` en la nueva grilla.

`handleScheduleChange` entonces auto-deselecciona (purga) de `_selectedSlotIds` cualquier slot
cuyo `status` ya no sea `available` (`enrollment.facade.ts:1823-1829`), sin distinguir "ocupado
por mí en este mismo flujo" de "ocupado por otro alumno". Al volver al paso 2, `schedule-grid.logic.ts`
(`isSlotSelectable`/`toggleSlotIds`) corta apenas ve `slot.status === 'occupied'`, deshabilitando
esos slots y mostrándolos como si fueran de otro alumno.

## ACs Afectados
Ninguno — fix autónomo (bug de UX en flujo de matrícula Clase B, reproducible en admin y secretaria
porque ambos usan el mismo `SecretariaMatriculaComponent`/`EnrollmentFacade` compartido).

## Cambio
- **Archivo:** `src/app/core/facades/enrollment.facade.ts`
  - **Qué cambia:** nuevo signal privado `_ownReservedSlotIds` que se llena en `saveAssignment()`
    con los `slotId` (timestamps) recién persistidos como `class_b_sessions.status='reserved'`
    para el draft actual, y se limpia en `reset()` y al recargar la grilla sin `preserveSlots`
    (cambio de instructor). `buildScheduleGrid()` recibe un set opcional `ownSlotIds` y fuerza
    `status: 'available'` para esos slots aunque la vista los reporte `occupied`.
    `handleScheduleChange()` (realtime) y `loadScheduleGrid()` pasan `_ownReservedSlotIds()` al
    reconstruir la grilla. Se optó deliberadamente por **no** reusar `_selectedSlotIds` (la
    selección en memoria, aún no persistida) para no enmascarar el caso legítimo de que otro
    alumno tome un slot que este usuario tiene seleccionado pero todavía no ha guardado — ese
    caso debe seguir auto-deseleccionándose (test ya existente
    `should auto-deselect slots that become occupied after realtime update`).

## Test de Regresión
- `src/app/core/facades/enrollment.facade.spec.ts > EnrollmentFacade > Realtime Schedule Subscription > should NOT auto-deselect slots that the current draft itself just reserved via saveAssignment` ✓
- Verificado que no rompe el caso legítimo: `should auto-deselect slots that become occupied after realtime update` sigue en verde.
- `npm run test:ci` sobre `enrollment.facade.spec.ts`: 56/56 tests OK.

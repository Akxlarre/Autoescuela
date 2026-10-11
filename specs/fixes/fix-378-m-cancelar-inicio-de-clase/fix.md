# Fix: una clase iniciada por error no se puede volver atrás
> id: fix-378-m-cancelar-inicio-de-clase
> refs: fix-366-m-testing-asistencia-clase-b (E08) · ASG-i-027
> status: done
> closed: 2026-10-11
> created: 2026-10-11

## Síntoma

Bloque 2 de `fix-366-m`, E08: una clase "En curso" solo ofrece "Finalizar". Si se inició por
error (el alumno nunca llegó), la única salida es finalizarla, que la registra como presente.

## Root Cause

No existe la acción.

## Fix

**Decisión de Matías (2026-10-11):** no se agrega "Ausente" a una clase en curso. En el drawer de
Finalizar (el mismo desde Asistencia y desde "Clases Actuales"), botón **"Cancelar inicio"** con
confirmación: la clase vuelve a `scheduled` → "Pendiente", borrando `start_time` y `km_start`.
Desde ahí se puede marcar ausente o iniciar de nuevo.

`AsistenciaClaseBFacade.cancelStart(sessionId)`: solo actúa si la clase sigue `in_progress`.

## Acceptance Criteria

- [x] AC1 — "Cancelar inicio" deja la clase "Pendiente", sin hora ni km de inicio.
- [x] AC2 — Funciona desde Asistencia y desde "Clases Actuales".
- [x] AC3 — Después se puede marcar ausente (si ya pasó la hora) o iniciar de nuevo.

## Regression Test

`asistencia-clase-b.facade.spec.ts` → `cancelStart`. Verificación en navegador.

## Verificación (2026-10-11)

Dashboard: la clase colgada de ayer (E2E-AsisColgada, "Cierre atrasado") → drawer de Finalizar →
"¿Se inició por error? Cancelar inicio" → modal con el nombre → "Inicio cancelado — La clase quedó
pendiente."; el drawer se cierra y la clase sale de "Clases Actuales" (ya no está en curso). Tests:
update `{ status: 'scheduled', start_time: null, km_start: null }` solo si sigue `in_progress`;
0 filas → error.

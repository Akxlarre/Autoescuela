# Fix: "Reactivar horario" dice qué clase choca cuando un horario ya está ocupado
> id: fix-245-b-reactivar-horario-dice-que-clase-choca
> refs: ASG-i-026 (fix-186-b, grupo 2: caso N03)
> status: done
> created: 2026-11-09
> closed: 2026-11-09

## Root Cause
`AsistenciaClaseBFacade.reactivateSchedule()` vuelve a agendar todas las clases futuras canceladas
de un alumno con un solo UPDATE y deja que los triggers de doble agendamiento (instructor, alumno,
vehículo) rechacen si alguna choca. El todo-o-nada es correcto, pero el aviso es el texto genérico
del trigger ("El instructor ya tiene una clase agendada que se solapa con este horario."): no dice
**cuál** clase choca ni qué hacer. Además el rechazo llega **después** de que la secretaria
confirmó el modal.

## ACs Afectados
Ninguno de una spec — caso del checklist `specs/testing-piloto/026-agenda-triple-match.md`:
- **N03:** si otro alumno ya tomó uno de esos horarios, el aviso dice qué clase choca (número,
  día y hora) y con qué (instructor, vehículo o el propio alumno), no se reactiva ninguna y
  orienta a "Reagendar Clases". El chequeo ocurre **antes** de pedir confirmación.

## Cambio
- `src/app/core/utils/reactivation-conflicts.utils.ts` (nuevo) — función pura
  `findReactivationConflicts(candidatas, ocupadas)` (mismo solape que los triggers:
  `duration_min` con 45 por defecto) y `reactivationConflictMessage(conflictos)`.
- `src/app/core/facades/asistencia-clase-b.facade.ts` — `reactivateSchedule()` trae las clases
  activas del mismo instructor/vehículo/matrícula en el rango, y si hay choques avisa sin abrir
  el modal ni escribir. El rechazo del trigger se mantiene como red de seguridad (carrera).

## Test de Regresión
- `reactivation-conflicts.utils.spec.ts` — solape por instructor, vehículo y alumno; bordes que
  se tocan no chocan; mensaje con número, día y hora.
- `asistencia-clase-b.facade.spec.ts` — con un choque: no confirma, no escribe, toast con el
  mensaje.
- `e2e/agenda-5.spec.ts` (N03) — el aviso nombra la clase que choca.

## Resultado (2026-11-09)
- Unit: `reactivation-conflicts.utils.spec.ts` (11, en verde en UTC, Asia/Tokyo y
  America/Santiago) y 2 nuevos en `asistencia-clase-b.facade.spec.ts`. `npm run test:ci`: 307
  archivos en verde.
- e2e N03 en verde: el aviso dice "Clase 3", su hora y "el instructor ya tiene otra clase", no
  menciona la clase 4 (que no choca), orienta a "Reagendar Clases" y el modal no se abre. Ninguna
  clase vuelve. Sin datos E2E remanentes (verificado por SQL).
- `npm run lint:arch`: 0 errores.

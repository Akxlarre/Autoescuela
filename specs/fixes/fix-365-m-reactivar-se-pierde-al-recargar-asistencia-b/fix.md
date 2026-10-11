# Fix: el botón "Reactivar" se pierde al recargar Asistencia B
> id: fix-365-m-reactivar-se-pierde-al-recargar-asistencia-b
> refs: fix-364-m-acciones-masivas-clases-sin-confirmacion
> status: done
> closed: 2026-10-10
> created: 2026-10-10
> priority: P1

## Root Cause
Sospecha S9 de `specs/testing-piloto/027-asistencia-clase-b.md`, confirmada leyendo el código
mientras se probaba `fix-364-m`.

`fetchAlertas()` calcula `horarioActivo` con el estado de **la clase de la falta**
(`sessionStatus !== 'cancelled'`). Esa clase está en `no_show`, nunca en `cancelled`, así que
`horarioActivo` siempre vuelve como `true` desde la BD. "Eliminar" lo pone en `false` solo en
memoria: al recargar o volver a entrar, la alerta muestra otra vez "Eliminar" y ya no hay cómo
llegar a "Reactivar".

## ACs Afectados
Ninguno — fix autónomo. Caso del checklist del piloto que corrige: `027` H08.

## Cambio
- **Archivo:** `src/app/core/facades/asistencia-clase-b.facade.ts`
- **Qué cambia:** `fetchAlertas()` consulta las clases futuras (`scheduled` y `cancelled`) de las
  matrículas con alerta. El horario se considera eliminado cuando la matrícula tiene clases
  futuras canceladas y ninguna agendada, que es justo lo que "Reactivar" puede revertir.
- **Archivo:** `src/app/core/utils/class-b-session.utils.ts`
- **Qué cambia:** función pura `enrollmentsWithRemovedSchedule()` con esa regla.

## Test de Regresión
- `src/app/core/utils/class-b-session.utils.spec.ts > enrollmentsWithRemovedSchedule`
- `src/app/core/facades/asistencia-clase-b.facade.spec.ts > fix-365-m`
- `e2e/acciones-masivas-clases.spec.ts > H06/H09` (incluye el paso H08: recargar tras "Eliminar")

## Verificación (2026-10-10)
- `npm run test:ci`: 3815 tests en verde. `npm run lint:arch`: sin errores.
- E2E en verde en navegador real con un alumno `E2E-` propio: tras "Eliminar" y recargar, la
  alerta sigue ofreciendo "Reactivar".

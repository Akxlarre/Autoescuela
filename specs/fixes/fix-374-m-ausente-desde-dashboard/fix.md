# Fix: desde "Clases Actuales" del Dashboard no se puede registrar una inasistencia
> id: fix-374-m-ausente-desde-dashboard
> refs: fix-366-m-testing-asistencia-clase-b (P01) · ASG-i-027
> status: done
> closed: 2026-10-11
> created: 2026-10-11

## Síntoma

Bloque 2 de `fix-366-m`, P01: una clase vencida sin iniciar dice "Debía iniciar hace 1 h" en
"Clases Actuales", y al tocarla solo se ofrece "Comenzar Clase". La secretaria, que trabaja
desde el Dashboard, no puede registrar la falta sin ir a Asistencia; si no va, la marca el cron.

## Root Cause

El drawer de Iniciar (`AdminIniciarClaseDrawerComponent`) solo inicia. Además
`AsistenciaClaseBFacade.markAttendance()` busca la clase en la tabla del día de Asistencia: desde
el Dashboard esa tabla puede no estar cargada y la llamada no hace nada.

## Fix

**Decisión de Matías (2026-10-11):** sí, la secretaria puede marcar "Ausente" desde el Dashboard.

- El drawer de Iniciar suma un botón secundario **"Marcar ausente"** (con el modal de
  confirmación de Asistencia) cuando la hora de la clase ya pasó. El drawer es el mismo desde el
  Dashboard y desde Asistencia.
- `markAttendance()` resuelve la clase por id: tabla del día, la práctica seleccionada o la BD.
- Tras marcar, se refresca "Clases Actuales" y se cierra el drawer.

## Acceptance Criteria

- [x] AC1 — Desde "Clases Actuales", una clase vencida sin iniciar se puede marcar ausente; queda
      "No asistió" y aplica la regla de penalización igual que desde Asistencia.
- [x] AC2 — Antes de la hora el botón no aparece.
- [x] AC3 — `markAttendance()` funciona aunque la tabla del día no tenga la clase.

## Regression Test

`asistencia-clase-b.facade.spec.ts` (markAttendance sin la fila en la tabla) y
`admin-iniciar-clase-drawer.component.spec.ts` (visibilidad del botón). Verificación en navegador.

## Verificación (2026-10-11)

Secretaria A en el Dashboard: la clase de las 13:30 "Por iniciar · Debía iniciar hace 3 h" abre el
drawer de Iniciar con "¿El alumno no llegó? Marcar ausente"; tras confirmar, toast "Asistencia
marcada como Ausente", el drawer se cierra y "Clases Actuales" la muestra "No asistió". La clase de
las 21:30 (futura) no ofrece el botón (`canMarkAbsent`, test). `markAttendance` resuelve la clase
desde la BD cuando no está en la tabla del día (test). Consola sin errores.

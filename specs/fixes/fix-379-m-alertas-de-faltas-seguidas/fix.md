# Fix: el rail de alertas trata cualquier par de faltas como si fueran seguidas
> id: fix-379-m-alertas-de-faltas-seguidas
> refs: fix-366-m-testing-asistencia-clase-b (H02/S8, P05, G05, G06) · ASG-i-027 · RF-053
> status: done
> closed: 2026-10-12
> created: 2026-10-12

## Síntoma

Bloque 3 de `fix-366-m`:
- **S8 / P05:** un alumno con faltas en las clases 2 y 5 (no seguidas) aparece en rojo con
  "Eliminar" y el tooltip "2 inasistencias consecutivas", igual que uno penalizado. El Dashboard
  sí cuenta solo faltas seguidas, así que las dos pantallas no coinciden.
- **H02:** "últ. 12-10" es la fecha en que se registró la falta, no la de la clase (09-10).
- **G06:** al justificar una falta el rail sigue mostrando "2 faltas" hasta recargar.
- **G05 (decisión de Matías, 2026-10-12):** justificar una falta que causó la penalización no
  devuelve las clases; hay que avisar que se reagendan desde la ficha.

## Root Cause

- `AsistenciaClaseBFacade.fetchAlertas()` marca `danger` con `dates.length >= 2`, cuente o no
  faltas seguidas, y toma la fecha de `recorded_at`.
- `justifyAbsence()` actualiza solo la fila de la tabla, no las alertas.
- `justifyAbsence()` y `AdminAlumnoDetalleFacade.justificarInasistenciaClaseB()` no miran si la
  falta ya había cancelado clases. El de la ficha tampoco filtra `archived_at` ni exige filas.

## Fix

- `fetchAlertas()` trae `class_number` y usa `enrollmentsWithConsecutiveAbsences()` (la misma regla
  que el Dashboard y que la RPC) para el nivel `danger`. El conteo sigue siendo de faltas vigentes.
  La última falta es la fecha de la clase (`scheduled_at`) más reciente.
- Tooltip: rojo = "2 inasistencias seguidas…"; amarillo con 2+ faltas = no seguidas.
- `justifyAbsence()` refresca las alertas y, si después de la falta se cancelaron clases de la
  matrícula, avisa que siguen canceladas y se reagendan desde la ficha. Lo mismo en la ficha
  (`justificarInasistenciaClaseB`), que además pasa a filtrar `archived_at` y exigir filas.

## Acceptance Criteria

- [x] AC1 — Faltas no seguidas (2 y 5): alerta amarilla "2 faltas", sin "Eliminar". Faltas seguidas:
      roja, como hoy.
- [x] AC2 — "últ." muestra la fecha de la clase de la última falta.
- [x] AC3 — Al justificar, la alerta se recalcula sin recargar.
- [x] AC4 — Justificar una falta que ya canceló clases avisa que siguen canceladas (Asistencia y ficha).

## Regression Test

`asistencia-clase-b.facade.spec.ts` (alertas, justificar) y `admin-alumno-detalle.facade.spec.ts`
(justificar desde la ficha). Verificación en navegador con `E2E-AsisNoConsec` y `E2E-AsisPenalizado`.

## Verificación (2026-10-12)

- `asistencia-clase-b.facade.spec.ts` 58/58 y `admin-alumno-detalle.facade.spec.ts` 89/89.
- Asistencia: `E2E-AsisNoConsec` (faltas 2 y 5) queda amarillo "2 faltas · últ. 08-10" con
  "Recordar"; las faltas seguidas de la base (p. ej. Camila Andrea Reyes) siguen rojas con
  "Eliminar". Las fechas son las de la clase (`E2E-AsisColgada` pasó de 11-10 a 10-10).
- Ficha de `E2E-AsisPenalizado`: justificar la falta 3 → "Inasistencia justificada
  correctamente." + "Las clases canceladas no vuelven solas — 8 clase(s)…".- `asistencia-clase-b-content.component.spec.ts` 26/26: el tooltip de 1 falta conserva su texto (fix-048) y el de 2+ faltas no seguidas no dice "consecutivas" ni "Política".

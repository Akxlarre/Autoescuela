# Fix: la ficha fecha las faltas por cuándo se registraron y el Dashboard no distingue las justificadas
> id: fix-381-m-fecha-y-etiqueta-de-inasistencias
> refs: fix-366-m-testing-asistencia-clase-b (J01, P03) · ASG-i-027
> status: done
> closed: 2026-10-12
> created: 2026-10-12

## Síntoma

Bloque 3 de `fix-366-m`:
- **J01:** el panel "Inasistencias Registradas" de la ficha muestra "12 oct 2026" para faltas de
  clases del 7 y del 9 de octubre: es el día en que se registró la falta, no el de la clase.
- **P03:** "Clases Actuales" del Dashboard dice "No Asistió" para una falta justificada, mientras
  Asistencia dice "Justificada".

## Root Cause

- `AdminAlumnoDetalleFacade.mapInasistenciaClaseB()` usa `recorded_at ?? scheduled_at`.
- `DashboardFacade.mapPracticaRow()` no lee la asistencia de la clase; el panel solo mira
  `status = 'no_show'`.

## Fix

- La ficha usa `scheduled_at` (la fecha de la clase) y cae a `recorded_at` solo si falta.
- El Dashboard trae `class_b_practice_attendance(status, archived_at)` y marca `excused` cuando la
  asistencia vigente está justificada. El panel muestra "Justificada" en vez de "No Asistió".

## Acceptance Criteria

- [x] AC1 — En la ficha, cada falta lleva la fecha de su clase.
- [x] AC2 — En "Clases Actuales" una falta justificada dice "Justificada".

## Regression Test

`admin-alumno-detalle.facade.spec.ts`, `dashboard.facade.spec.ts` y
`live-classes-panel.component.spec.ts`.

## Verificación (2026-10-12)

- `admin-alumno-detalle.facade.spec.ts`, `dashboard.facade.spec.ts` y
  `live-classes-panel.component.spec.ts`: 133/133.
- Ficha de `E2E-AsisPenalizado`: las faltas dicen "09 oct 2026" (clase 4) y "07 oct 2026"
  (clase 3); antes, "12 oct 2026" las dos.
- AC2 por test (en el Dashboard de hoy no hay una falta justificada para mirar).
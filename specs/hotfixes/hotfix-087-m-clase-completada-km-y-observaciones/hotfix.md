# Hotfix: Detalle de clase completada muestra kilometraje inicio/fin y observaciones
> id: hotfix-087-m-clase-completada-km-y-observaciones
> refs: —
> status: done
> closed: 2026-08-21
> created: 2026-08-21

## Problema
El drawer de detalle de un slot de agenda (`agenda-slot-detail-drawer.component.ts`), usado desde
el panel de clases actuales del dashboard, solo muestra estado, horario, instructor, vehículo y
alumno. Para una clase ya `completed` falta información ya registrada en `class_b_sessions`
(`km_start`, `km_end`, `notes`) que sería útil ver sin salir del drawer.

## Cambios
- **Archivo:** `src/app/core/models/ui/agenda.model.ts` — agrega `kmStart`, `kmEnd`, `notes`
  opcionales a `AgendaSlot`.
- **Archivo:** `src/app/core/facades/agenda.facade.ts` — agrega `km_start, km_end, notes` al select
  de `fetchSessions()`, al tipo `RawSession` y al mapeo en `buildWeekData()`.
- **Archivo:** `src/app/features/agenda/agenda-slot-detail-drawer.component.ts` — agrega sección
  "Kilometraje" (inicio, fin, distancia recorrida) y "Observaciones del instructor", visibles solo
  cuando `status === 'completed'` y los datos existen.
- **Archivo:** `src/app/core/models/ui/dashboard.model.ts` — agrega `kmEnd`, `notes` a
  `LiveClassModel` (ya tenía `kmStart`).
- **Archivo:** `src/app/core/facades/dashboard.facade.ts` — agrega `km_end, notes` a
  `PRACTICA_SELECT` y al mapeo en `mapPracticaRow()`.
- **Archivos:** `src/app/features/dashboard/dashboard.component.ts`,
  `src/app/features/secretaria/dashboard/secretaria-dashboard.component.ts`,
  `src/app/features/dashboard/daily-agenda-drawer/daily-agenda-drawer.component.ts` — los tres
  arman un `AgendaSlot` sintético a partir de `LiveClassModel` (no pasan por `AgendaFacade`) al
  abrir el drawer desde "Clases Actuales" del dashboard (admin, secretaria, y el drawer "Agenda de
  Hoy"); se les agrega `kmStart`, `kmEnd`, `notes` para que el drawer de detalle los reciba también
  por esta ruta.

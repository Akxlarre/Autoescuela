# Asignación ASG-b-070 — App-like: familia "horario" (`instructor` + `alumno`)

> **status:** completada
> **owner:** b
> **tipo_sugerido:** fix
> **priority:** P2
> **created:** 2026-08-03
> **created_by:** b
> **claimed_by:** b
> **claimed_at:** 2026-08-09
> **resulting_track:** fix-127-b-app-like-familia-horario

---

## Contexto / Objetivo

Paso 5 del rollout app-like (`indices/APP-LIKE-ROLLOUT.md`). **Corrección importante sobre la
primera pasada del audit:** ninguna de las 2 páginas usa `agenda-semanal` (ese es el calendario
operativo de staff, no aplica acá) — son implementaciones propias y distintas, de solo lectura.

### `/instructor/horario` (`InstructorHorarioComponent`)

Root `bento-grid` plano + 1 `.bento-banner` que alterna `WeeklyScheduleGridComponent` (desktop,
ya `card flex flex-col h-full` con body `flex-1 overflow-x-auto` y header `sticky` — YA está
listo para recibir `bento-fill`) / `DailyScheduleTimelineComponent` (mobile, `space-y-6` plano —
correcto así, mobile no necesita fill).

Plan:
1. Root → `bento-grid--fill-screen`.
2. `.bento-banner` que envuelve ambos → `bento-fill flex flex-col h-full`.
3. Wrapper `hidden md:block` → `hidden md:flex md:flex-col md:min-h-0`.
4. `<app-weekly-schedule-grid>` necesita tratamiento "host como celda" (patrón spec 0031):
   `:host{display:flex;flex-direction:column;min-height:0}` en el componente, para que su
   `h-full` interno tenga de dónde heredar altura.

### `/alumno/horario` (`AlumnoHorarioComponent`)

Calendario de 7 días 100% hecho a mano (sin componente compartido), con hasta 4 celdas
condicionales apiladas ANTES del calendario: hero, selector de matrícula (si 2+ matrículas),
"Próxima clase" (si existe), calendario semanal (siempre), "Sin matrícula" (si aplica) — pueden
coexistir varias a la vez. Ningún modificador existente calza con "N filas auto variables + 1
fill".

Plan: reagrupar selector + próxima-clase + sin-matrícula dentro de UN wrapper `.bento-banner`
(los `@if` quedan adentro, no como celdas de grid separadas) para que sea siempre 1 sola fila
auto. El calendario semanal queda como única celda `.bento-fill` en `--fill-screen-kpi`.

## Checklist de cierre (rollout app-like — ver `indices/APP-LIKE-ROLLOUT.md` §"Edge cases estresados")

- [ ] `force-compact` verificado con drawer abierto (ambas páginas)
- [ ] `/verify` en 390×844, 1440×900 y 768 de alto (ambas páginas)
- [ ] `app-empty-state`/skeletons dentro del `.bento-fill` en wrapper `flex-1 flex items-center
      justify-center` (regla nueva en `visual-system.md` §Patrón App-like)
- [ ] Sin lógica de densidad nueva en ninguna de las 2 → sin tests nuevos obligatorios

## Referencias

- `indices/APP-LIKE-ROLLOUT.md` — filas `/instructor/horario` y `/alumno/horario`
- `src/app/shared/components/asistencia-clase-b-content/` (spec 0031) — precedente del patrón
  "host de componente como celda `.bento-fill`"

## Archivos involucrados

- `src/app/features/instructor/horario/instructor-horario.component.ts`
- `src/app/shared/components/weekly-schedule-grid/weekly-schedule-grid.component.ts`
- `src/app/features/alumno/horario/alumno-horario.component.ts`

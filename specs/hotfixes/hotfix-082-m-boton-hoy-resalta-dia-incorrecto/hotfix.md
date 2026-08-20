# Hotfix: Botón "Hoy" del horario semanal resalta un día distinto al actual
> id: hotfix-082-m-boton-hoy-resalta-dia-incorrecto
> refs: —
> status: done
> closed: 2026-08-20
> created: 2026-08-20

## Problema
En `InstructorHorarioComponent` (vista desktop del horario semanal), al presionar "Hoy"
se resalta con un celeste tenue un día distinto al actual (ej: jueves, siendo miércoles
el día real) — además del celeste fuerte que ya marca correctamente el día de hoy vía
`day.isToday`.

Causa: `resetToToday()` calcula `todayStr` con
`new Date().toISOString().split('T')[0]`, que recorta la fecha del string ISO en
**UTC**, no en hora local. Chile está detrás de UTC (UTC-3/-4): desde ~21:00 hora Chile
en adelante, la fecha UTC ya es "mañana", así que `selectedDayDate` (que pinta el
celeste tenue vía `getDayHeaderBg()`) queda apuntando al día siguiente. Es el mismo
patrón ya documentado en `indices/DOMAIN-GOTCHAS.md` DG-071 ("`toISOString().split('T')[0]`
como fecha de 'hoy' pierde el día real cerca de medianoche en Chile"), cuya regla de
aplicabilidad pide corregir el patrón sin excepción, no solo donde se manifestó.

Se encontraron 2 instancias más del mismo patrón en el mismo componente
(`changeWeek()`, `changeDay()`) que no fueron reportadas visualmente hoy pero comparten
la misma causa raíz y se corrigen junto con la reportada, usando los helpers ya
existentes `todayIso()` / `toISODate()` de `core/utils/date.utils.ts` (mismos que ya usa
el resto del proyecto para este patrón, ej. `InstructorClasesFacade.fetchTodayClasses()`
en fix-176-m).

`this.currentWeekDate = today.toISOString()` (línea con datetime completo, no solo
fecha) se deja intacta: el facade la vuelve a parsear con `new Date(...)` y getters
locales (`getDay()`, `getDate()`), así que el viaje UTC→local se revierte correctamente
ahí — el bug solo afecta a los `.split('T')[0]` que recortan el string ISO a mano sin
reconstituir el `Date`.

## Cambios
- **Archivo:** `src/app/features/instructor/horario/instructor-horario.component.ts`
  — importar `todayIso, toISODate` de `@core/utils/date.utils`.
  — `resetToToday()`: `today.toISOString().split('T')[0]` → `todayIso()`.
  — `changeWeek()`: `this.currentWeekDate.split('T')[0]` → `toISODate(new Date(this.currentWeekDate))`.
  — `changeDay()`: `dt.toISOString().split('T')[0]` → `toISODate(dt)`.

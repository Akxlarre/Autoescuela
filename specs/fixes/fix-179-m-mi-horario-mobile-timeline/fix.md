# Fix: Mi Horario — timeline mobile (duplicado, agenda libre incorrecta, tira de semana cortada)
> id: fix-179-m-mi-horario-mobile-timeline
> refs: —
> status: done
> closed: 2026-08-14
> created: 2026-08-14

## Root Cause
`DailyScheduleTimelineComponent` (mobile de `app-instructor-horario`) tiene tres defectos puntuales
en el mismo componente, encontrados juntos en la misma sesión de QA visual del dueño:

1. El "Hero Card" de próxima clase se arma con `daySchedule().nextBlock`, pero el rail de abajo
   itera `daySchedule().blocks` sin excluirlo → el mismo bloque se pinta dos veces. Además la hora
   del rail usa `text-2xs`, ilegible en mobile.
2. El estado "Agenda Libre" se muestra con `@if (nextBlock) {...} @else {empty state}` — es decir,
   se dispara cada vez que no hay una clase "próxima" (scheduled/in_progress), aunque el día tenga
   bloques reales (ej. todos `completed`). Debería depender de si `blocks.length === 0`, no de si
   hay `nextBlock`.
3. La tira de días (`Day Tab Strip`) es un simple `overflow-x-auto` sin afordancia de scroll ni
   navegación de semana — se corta visualmente en el borde del viewport y no hay forma de ir a la
   semana anterior/siguiente desde mobile (el `WeeklyScheduleGridComponent` de desktop sí tiene
   ese control, pero nunca se replicó en el timeline mobile).

## ACs Afectados
Ninguno — fix autónomo (defectos visuales reportados directo por QA manual del dueño, sin spec
formal detrás de esta vista).

## Cambio
- **Archivo:** `src/app/shared/components/daily-schedule-timeline/daily-schedule-timeline.component.ts`
  - **Qué cambia:** (1) nuevo `computed remainingBlocks` que excluye el `sessionId` del `nextBlock`
    del rail, y agranda el label de hora del rail; (2) condición del estado vacío pasa de
    `nextBlock` a `blocks.length === 0`; (3) agrega botones prev/next semana alrededor del day tab
    strip + nuevos `output()` `prevWeek`/`nextWeek`.
- **Archivo:** `src/app/features/instructor/horario/instructor-horario.component.ts`
  - **Qué cambia:** conecta `(prevWeek)="changeWeek(-1)"` y `(nextWeek)="changeWeek(1)"` en
    `<app-daily-schedule-timeline>`, igual que ya hace con `<app-weekly-schedule-grid>`.

## Test de Regresión
- `core/utils/daily-schedule-timeline.utils.spec.ts > filterRemainingBlocks > excludes the nextBlock from the rail` ✓
- `core/utils/daily-schedule-timeline.utils.spec.ts > shouldShowEmptyDayState > is false when the day has blocks even without a nextBlock (e.g. all completed)` ✓

> Nota: la lógica se extrajo a `core/utils/daily-schedule-timeline.utils.ts` (funciones puras)
> en vez de testear el componente vía TestBed — precedente en `agenda-slot.component.spec.ts`:
> el rendering de template con TestBed está roto en este repo (falta `@analogjs/vite-plugin-angular`
> y agregarlo rompe los tests de facades/services). Las funciones puras se testean sin ese problema.

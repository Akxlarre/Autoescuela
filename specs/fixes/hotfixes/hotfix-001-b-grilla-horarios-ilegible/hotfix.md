# Hotfix: Grilla de horarios ilegible en flujo público
> id: hotfix-001-b-grilla-horarios-ilegible
> status: done
> closed: 2026-06-04
> created: 2026-06-04

## Problema
`PublicScheduleComponent` renderiza TODOS los días disponibles del instructor como columnas en un único CSS grid. Con 30+ días disponibles las columnas se comprimen a ~8px y los encabezados de fecha se superponen, haciendo la grilla completamente inutilizable.

## Causa raíz
`gridColumns()` usa `scheduleGrid.week.days.length` sin filtrar por semana. El componente no tiene paginación semanal, al contrario del `app-assignment-step` del wizard admin que sí tiene `currentWeekIndex` + `prevWeek/nextWeek`.

## Cambios
- **Archivo:** `src/app/shared/components/public-enrollment-steps/public-schedule/public-schedule.component.ts` — agregar `currentWeekIndex` signal, `weeks` computed (agrupa días por lunes vía `getMondayKey()`), `currentWeekDays` + `currentWeekTimeRows` computed, controles `prevWeek/nextWeek` en el template, reset a semana 0 al cambiar instructor. Fix adicional: `slotAt()` y `currentWeekTimeRows` extraen `start = time.split('-')[0]` (timeRows = "HH:MM-HH:MM" pero `slot.startTime` = "HH:MM"). Fix adicional: `slotBg()`/`slotColor()` usan `selectedSlotIds.includes(slot.id)` en vez de `slot.status === 'selected'` (el EF nunca devuelve status 'selected', siempre 'available'|'occupied').
- **Archivo:** `supabase/functions/public-enrollment/index.ts` — corrección secundaria descubierta: `dateStr` en `buildScheduleGrid` usaba `toISOString().split('T')[0]` (UTC) como clave del Map de días, pero los labels usaban timezone Santiago. En horarios nocturnos (>21:00 Santiago) esto generaba columnas duplicadas con el mismo label. Fix: `toLocaleDateString('en-CA', { timeZone: 'America/Santiago' })`.
- **Archivo:** `supabase/functions/student-payment/index.ts` — mismo bug en `buildScheduleGrid` del flujo de pago de alumnos. Mismo fix aplicado.

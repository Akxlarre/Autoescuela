# Fix: Grilla de horarios renderiza columna de día duplicada
> id: fix-007-b-grilla-horarios-dia-duplicado
> refs: 0009-rediseno-ux-flujo-inscripcion-online-publico (descubierto durante auditoría 0011)
> status: done
> created: 2026-06-04
> resolved: 2026-06-04 — redeploy de la Edge Function `public-enrollment` al proyecto remoto. Verificado en navegador: la grilla muestra una sola columna por fecha. Sin cambios de código en el repo (el fuente ya contenía el dedup).

## Root Cause

La grilla de horarios del flujo público (`/inscripcion`, paso "Horario") renderiza **dos
columnas para la misma fecha** ("vie 5/6" ×2, la segunda vacía). Confirmado empíricamente
con Playwright: el header row tiene `grid-template-columns: 60px 300px 300px` y dos `<span>`
de día idénticos ("vie 5/6").

**No es un bug de frontend ni responsive** (persiste igual en mobile 390 y desktop 1280):

- El componente `public-schedule.component.ts` itera `currentWeekDays()`, que deriva de
  `scheduleGrid.week.days` (datos que llegan de la Edge Function `public-enrollment`,
  acción `load-schedule`).
- El **fuente local** de `buildScheduleGrid` (`supabase/functions/public-enrollment/index.ts`,
  ~L1518) **ya deduplica** los días con un `Map` keyed por `dateStr`
  (`if (!days.has(dateStr))`). Con ese código es **imposible** producir días duplicados.

**Causa raíz:** la Edge Function **desplegada** en el proyecto Supabase remoto
(`skvekggejikzxhzsjmkz.supabase.co`, al que apunta `src/environments/environment.ts`) es una
**versión anterior, out-of-sync con el fuente local**. Evidencia adicional: la etiqueta de día
desplegada es `"vie 5/6"` (sin padding, separador `/`), mientras el fuente local genera
`${dayName} ${dayLabel}` con `toLocaleDateString('es-CL', {day:'2-digit', month:'2-digit'})`
→ `"vie 05-06"`. El formato distinto confirma que el código corriendo ≠ el código del repo.

## ACs Afectados

- **0009 / 0011 §7.6** (grilla de horarios usable): hoy muestra una columna fantasma vacía que
  confunde y desperdicia ancho. El fix restablece una columna por día real.
- Ninguno roto en el fuente — el contrato lo cumple el código del repo; el defecto vive en el deploy.

## Cambio

- **Acción principal (ops, sin editar código):** redeployar la Edge Function `public-enrollment`
  al proyecto remoto para sincronizar el `buildScheduleGrid` con dedup + formato actual.
  - `npx supabase functions deploy public-enrollment` (o el pipeline de deploy del proyecto).
- **Verificación previa pendiente:** confirmar con `git log -- supabase/functions/public-enrollment/index.ts`
  que el dedup ya está commiteado en el fuente (si no lo está, primero commitearlo).
- **Plan B (si tras redeploy persiste):** investigar datos en remoto — posibles filas duplicadas en
  el origen de slots (mismo día, distinto `slot_start`) que un dedup por `dateStr` ya cubriría, o un
  desfase de timezone que genere dos `dateStr` para la misma fecha local.

## Test de Regresión

- **Manual (Playwright):** entrar a `/inscripcion?branchId=1` → Clase B → datos personales →
  pago total → Horario → seleccionar instructor con disponibilidad → el header de la grilla debe
  tener **una sola columna por fecha** (sin "vie 5/6" repetido). Verificable con:
  `grid-template-columns` = `60px` + N columnas, sin etiquetas de día duplicadas.
- **Unit (opcional, recomendado):** extraer `buildScheduleGrid` a una función pura testeable y
  cubrir el caso "filas con fechas repetidas → días únicos" en un `.spec.ts`.

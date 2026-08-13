# Fix: Navegación de agenda permite pasar el límite máximo de semanas configurado
> id: fix-162-m-agenda-navegacion-semanas-fantasma-sin-limite
> refs: docs/UAT-PLAN.md — Paquete 3, caso "Verificar que no se puede navegar más allá del límite configurado"
> status: done
> closed: 2026-08-12
> created: 2026-08-12

## Root Cause
`AgendaFacade.goToNextWeek()` (`agenda.facade.ts:285-288`) actualiza `_weekStart` de forma
síncrona e incondicional (`+7 días`) y dispara `loadWeek()` sin ningún chequeo del límite
configurado (`AgendaSettingsService.maxVisibleDateIso()`) — el Facade no conoce ese límite en
absoluto, solo lo conoce el Smart component vía `AgendaSettingsService` inyectado aparte.

La única protección visible hoy es el `[disabled]="isNextWeekDisabled()"` del botón "Semana
siguiente" en `AgendaSemanalComponent`, pero ese computed depende de `weekData()?.weekStart`
— un signal que solo se actualiza **después** de que el `fetch` async de `loadWeek()` resuelve
(varios cientos de ms). Mientras ese fetch está en vuelo, el botón sigue habilitado: clicks
rápidos y repetidos disparan múltiples `goToNextWeek()` antes de que el primero resuelva y
deshabilite el botón, permitiendo avanzar visualmente más allá del límite (confirmado hasta
semanas 2+ posteriores al límite en QA manual).

El mismo hueco explica el segundo síntoma reportado: como `fetchWeekData()` no tiene guard de
petición (`createRequestGuard()`, patrón obligatorio de `facades.md` §"Guard contra respuestas
fuera de orden" para Facades SWR), cada click encola su propio fetch independiente sin cancelar
los anteriores — todos resuelven en algún momento y van pisando `_weekData` uno tras otro, lo
que se percibe como la grilla "navegando sola" con delay tras soltar el mouse.

## ACs Afectados
Ninguno — fix autónomo, hallazgo de auditoría UAT (Paquete 3), no ligado a una spec de negocio
previa.

## Cambio
- **Archivo:** `src/app/core/utils/agenda-week.utils.ts` (nuevo) — mueve `addDaysToIso`,
  `isDateBeyondLimit` e `isNextWeekBeyondLimit` desde `agenda-semanal.component.ts` (eran
  funciones puras coladas en un Dumb component, violando la regla de Núcleo Funcional de
  `architecture.md`). El componente pasa a importarlas en vez de redefinirlas.
- **Archivo:** `src/app/core/facades/agenda.facade.ts` — inyecta `AgendaSettingsService` y usa
  `isNextWeekBeyondLimit()` como guard síncrono al inicio de `goToNextWeek()`: si la semana
  siguiente ya sería enteramente fantasma, no muta `_weekStart` ni dispara `loadWeek()`. Además
  agrega `createRequestGuard()` a `fetchWeekData()` (mismo patrón que otros Facades branch-scoped
  SWR) para descartar respuestas de fetch obsoletas cuando hay navegación rápida encolada.

## Test de Regresión
- `agenda.facade.spec.ts` — nuevos tests: `goToNextWeek()` no avanza `weekStart` ni llama
  `loadWeek()` cuando la semana siguiente ya excede `maxVisibleDateIso()`; clicks rápidos y
  repetidos en `goToNextWeek()` dejan `weekData()` reflejando solo la respuesta más reciente
  (request guard descarta las obsoletas).
- `agenda-semanal.component.spec.ts` — actualiza el import de `addDaysToIso` /
  `isDateBeyondLimit` / `isNextWeekBeyondLimit` al nuevo util (mismos casos, sin cambios de
  comportamiento).

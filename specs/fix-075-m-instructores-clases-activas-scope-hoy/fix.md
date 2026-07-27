---
# Fix: "Clases activas" de Instructores puede contar sesiones huérfanas de días anteriores
> id: fix-075-m-instructores-clases-activas-scope-hoy
> refs: fix-072-m-instructores-clases-activas-count
> status: done
> closed: 2026-07-27
> created: 2026-07-27

## Root Cause

fix-072 reemplazó la columna cacheada `active_classes_count` por un `COUNT` en vivo de
`class_b_sessions` en `status='in_progress'` (`fetchActiveClassesCounts()`). Pero `status='in_progress'`
solo se setea al iniciar la clase (`AsistenciaClaseBFacade.iniciarClase()`) y solo se limpia al
finalizarla — si una sesión se queda "colgada" en `in_progress` (instructor no la finaliza, sesión de
prueba abandonada, crash, etc.), la query la sigue contando **indefinidamente**, incluso días después
de la fecha agendada. El usuario (Matías) verificó en `ng serve` que el conteo debe representar
únicamente clases que están **realmente transcurriendo ahora**, no sesiones huérfanas de otros días.

## ACs Afectados

- Ninguno — fix autónomo, sin spec asociada.

## Cambio

- **Archivo:** `src/app/core/facades/instructores.facade.ts`
  - `fetchActiveClassesCounts()`: agregar un filtro de fecha sobre `scheduled_at` acotado al día de
    hoy (`gte` inicio del día, `lte` fin del día — mismo patrón `toISODate` + rango que usa
    `dashboard.facade.ts` en `fetchLiveClasses()`), además del `.eq('status', 'in_progress')` y
    `.in('instructor_id', ids)` ya existentes. Así una sesión `in_progress` huérfana de un día
    anterior deja de contarse como "clase activa" de hoy.

## Test de Regresión

- `instructores.facade.spec.ts > InstructoresFacade — clases activas en vivo (fix-072)`:
  - agregar caso `no cuenta sesiones in_progress de días anteriores (huérfanas)`.
  - los 2 tests existentes de fix-072 deben seguir en verde (usan `scheduled_at` implícito de "hoy"
    en el mock, o se ajustan para incluir el filtro de fecha).
- Suite completa (`npm run test:ci`): 1462/1462 en verde (11/11 en `instructores.facade.spec.ts`,
  incluyendo el test nuevo del filtro de fecha).
- `npm run lint:arch`: 0 errores, 165 advertencias (mismas pre-existentes, ninguna nueva).
- Verificación visual: NO ejecutada con Playwright MCP en esta sesión — el usuario (Matías) decidirá
  si la corre en `ng serve`.

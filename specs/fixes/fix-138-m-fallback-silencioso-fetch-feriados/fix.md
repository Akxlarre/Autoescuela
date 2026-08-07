# Fix: Fallback silencioso cuando falla el fetch a la API de feriados chilenos
> id: fix-138-m-fallback-silencioso-fetch-feriados
> refs: 0002-m-promociones-cadencia-automatica
> status: done
> closed: 2026-08-07
> created: 2026-08-07

## Root Cause
`PromocionesFacade.fetchHolidaysForYears()` (`promociones.facade.ts:367-385`) hace
`fetch('https://apis.digital.gob.cl/fl/feriados/{año}')` y, si falla por cualquier motivo
(DNS, red, CORS, 5xx), el `catch` retorna `[]` sin registrar ni comunicar el fallo. Confirmado
en el navegador del owner (incluso sin extensiones): `net::ERR_NAME_NOT_RESOLVED` al resolver
`apis.digital.gob.cl`. `computePromotionEndDate()` con `holidayDates` vacío da
`startDate + 33` (sin ajuste), y ese valor se muestra en el drawer y se persiste como si fuera
el cálculo real — sin ninguna señal de que el chequeo de feriados no se pudo hacer.

Caso concreto reproducido: promoción con `start_date=lun 17 ago 2026` mostró
`end_date=sáb 19 sept 2026` (exactamente `start+33`), pero el 18 y 19 de septiembre 2026 son
feriados reales (Fiestas Patrias) dentro de ese rango — deberían haber extendido `end_date`.

## ACs Afectados
- AC6 (spec 0002-m) — "`end_date` se extiende N días hábiles por cada feriado en el rango
  (manual y automática)". El fix no cambia el algoritmo de cálculo (ya correcto y testeado),
  corrige que su **fallo silencioso de origen** (fetch) quede invisible para quien crea la
  promoción.

## Cambio
- **Archivo:** `src/app/core/facades/promociones.facade.ts`
- **Qué cambia:** `fetchHolidaysForYears()` expone si el fetch falló (en vez de solo devolver
  `[]`); `previewEndDate()` y `crearPromocion()` propagan esa señal; el drawer
  (`admin-promocion-crear-drawer.component.ts`) muestra una advertencia visible cuando el
  `end_date` mostrado no pudo verificar feriados reales, para que el admin decida si ajustar
  la fecha manualmente.

## Test de Regresión
- `src/app/core/facades/promociones.facade.spec.ts` > describe "PromocionesFacade — fallo del
  fetch de feriados es visible (fix-138)" — 3 casos ✓ (fetch rechaza → `holidaysCheckFailed()`
  true y `previewEndDate()` sigue devolviendo `start+33`; fetch exitoso → false; recuperación
  tras un fallo previo → vuelve a false).

## Verificación
- `npx vitest run src/app/core/facades/promociones.facade.spec.ts` → 13/13 verde.
- `npm run lint:arch` → 0 errores.
- QA visual (Playwright, `ng serve` real contra Supabase de producción, solo lectura): se
  reprodujo el caso exacto reportado (`start_date=17 ago 2026` → `end_date=19 sept 2026`,
  `net::ERR_NAME_NOT_RESOLVED` real en consola) y se confirmó que el warning
  "No se pudo verificar feriados reales..." aparece bajo el `end_date` en el drawer. Se cerró
  el drawer sin crear la promoción (solo verificación).

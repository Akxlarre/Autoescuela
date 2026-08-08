# Fix: Fuente de feriados sin redundancia — `apis.digital.gob.cl` inalcanzable, sin fallback de datos
> id: fix-139-m-fallback-fuente-feriados-alternativa
> refs: fix-138-m-fallback-silencioso-fetch-feriados
> status: done
> closed: 2026-08-07
> created: 2026-08-07

## Root Cause
`fix-138-m` hizo visible el fallo del fetch de feriados (signal `holidaysCheckFailed`), pero no
resolvía el problema de fondo: la única fuente de datos (`apis.digital.gob.cl/fl/feriados/
{año}`) está **completamente inalcanzable** — confirmado con `net::ERR_NAME_NOT_RESOLVED` real,
tanto desde el navegador del owner como desde este entorno de desarrollo. No es un problema de
red local ni de extensiones: es el dominio del gobierno el que no resuelve. Sin una fuente
alternativa, tanto la creación manual (drawer) como el cron automático
(`auto-create-next-promotions`) seguirán sin poder calcular `end_date` con feriados reales —
la advertencia de fix-138 solo hace visible el síntoma en el drawer, no ayuda al cron
desatendido en absoluto.

Verificado en este entorno (mismo navegador donde `apis.digital.gob.cl` falla) que SÍ
responden con datos correctos para 2026, incluyendo el 18 y 19 de septiembre
(Independencia Nacional / Glorias del Ejército, ambos irrenunciables):
- `https://api.boostr.cl/holidays.json?year={año}&country=CL` → `{ status, data: [{date, title, type, inalienable, extra}] }`
- `https://date.nager.at/api/v3/publicholidays/{año}/CL` → `[{date, localName, name, ...}]`

Se elige **Boostr** como respaldo (formato más simple, ya usado en Chile específicamente,
mismo campo `date` en formato `YYYY-MM-DD`).

## ACs Afectados
- AC6 (spec 0002-m) — mismo AC que fix-138. Este fix cierra el gap real: ahora `end_date` se
  calcula con feriados reales incluso cuando `apis.digital.gob.cl` está caída, tanto en
  creación manual como en el cron.

## Cambio
- **Archivo:** `src/app/core/facades/promociones.facade.ts`
- **Qué cambia:** `fetchHolidaysForYears()` intenta `apis.digital.gob.cl` primero; si falla
  (por año), reintenta con `api.boostr.cl` antes de darse por vencido. `holidaysCheckFailed`
  ahora solo se activa cuando **ambas** fuentes fallan para algún año del rango.
- **Archivo:** `supabase/functions/_shared/holidays.ts`
- **Qué cambia:** mismo fallback, portado 1:1 (comentario del archivo ya exige mantener ambos
  en sync). Usado por el cron `auto-create-next-promotions` — con esto la automatización deja
  de depender de una única fuente inalcanzable.

## Test de Regresión
- `src/app/core/facades/promociones.facade.spec.ts` > describe "PromocionesFacade — fallback a
  fuente alternativa de feriados (fix-139)" — 2 casos ✓ (gob.cl falla + boostr responde →
  `holidaysCheckFailed()` false y `end_date` refleja el feriado real; ambas fuentes fallan →
  `holidaysCheckFailed()` true, comportamiento fix-138 preservado). Los 3 casos de fix-138
  siguen verdes sin modificación (15/15 en total).

## Verificación
- `npx vitest run src/app/core/facades/promociones.facade.spec.ts` → 15/15 verde.
- `npm run lint:arch` → 0 errores.
- QA visual (Playwright, `ng serve` real, solo lectura): se reprodujo el caso exacto de
  fix-138 (`start_date=17 ago 2026`, `apis.digital.gob.cl` sigue fallando con
  `net::ERR_NAME_NOT_RESOLVED` real) y ahora el drawer muestra `end_date=22 sept 2026`
  (correctamente extendido por los 2 feriados reales de Fiestas Patrias, vía `api.boostr.cl`)
  **sin** ningún warning — confirma que el fallback resuelve el caso real, no solo el test.

## Verificación del runtime del cron (post-cierre, 2026-08-07)
No se pudo invocar `auto-create-next-promotions` end-to-end (el colchón local ya estaba
completo — 1 `in_progress` + 3 `planned` de una sesión de QA anterior — así que la función
retorna `{created:0,missing:0}` sin ejecutar ninguna rama que llame a `fetchHolidaysForYears`).
En su lugar se verificó **la reachability real desde el mismo binario y red** que ejecuta el
cron: se montó un servicio Deno efímero dentro del contenedor `supabase_edge_runtime` (mismo
`edge-runtime` que sirve las Edge Functions) que replica únicamente las dos llamadas `fetch()`
de `_shared/holidays.ts`, sin tocar BD. Resultado:
- `apis.digital.gob.cl` → `TypeError: dns error: failed to lookup address information: Name or
  service not known` — mismo fallo exacto que en el navegador, confirmado también desde este
  runtime.
- `api.boostr.cl` → `200 OK`, feriados reales de 2026 completos.

Esto confirma que el fallback también funciona desde el runtime real del cron, no solo desde
el navegador — la causa raíz (esa API de gobierno específica no resuelve desde esta red/ISP)
y la solución (respaldo con `api.boostr.cl`) son las mismas en ambos entornos. Servicio de
diagnóstico eliminado del contenedor tras la prueba, sin cambios persistentes.

## Alcance NO cubierto (pendiente, fuera de este fix)
- Si el owner quiere una garantía más fuerte que "dos fuentes externas en cadena", el
  siguiente paso natural (fuera de este fix) sería que el cron deje un registro visible
  (notificación persistida para el admin, tabla de auditoría, o similar) cuando AMBAS fuentes
  fallen — hoy ese caso solo queda en el log de la Edge Function, que nadie revisa de forma
  proactiva. No implementado por decisión de scope, no por limitación técnica.

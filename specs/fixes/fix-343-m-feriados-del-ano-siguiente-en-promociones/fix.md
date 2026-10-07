# Fix: Una promoción que cruza de año ignora los feriados del año siguiente
> id: fix-343-m-feriados-del-ano-siguiente-en-promociones
> refs: ASG-i-025 · fix-319-m (K04) · 0002-m (AC6) · fix-139
> status: done
> closed: 2026-10-06
> created: 2026-10-06

## Root Cause
Para calcular la fecha de término y cancelar las sesiones de los feriados, se piden los feriados
"del o los años que la promoción puede cubrir". La condición para pedir el año siguiente es
**"la promoción parte en diciembre"** (`promociones.facade.ts:454`, y la misma línea en
`supabase/functions/_shared/holidays.ts:62`, que usa el cron). Una promoción dura 30 días de clase
(33 días corridos como mínimo), así que una que parte a fines de noviembre también cruza a enero y
se queda sin los feriados de ese año.

Visto en el testing (K04): promoción manual del lunes 30-11-2026 → término 05-01-2027 (debía ser
06-01) y la sesión del **01-01-2027 queda `scheduled`**. **La automática 284 parte ese mismo lunes**
y le pasaría igual.

**Segunda causa, encontrada al verificar en navegador:** pedir 2027 no bastaba. La fuente oficial
(`apis.digital.gob.cl`) no resuelve (fix-139) y el respaldo `api.boostr.cl` **ignora el parámetro
`year`**: responde 200 con los feriados del año en curso. Para 2027 devolvía 16 fechas de 2026,
ninguna útil, y `holidaysCheckFailed` quedaba en `false` (sin aviso).

## ACs Afectados
- `0002-m` AC6 — recuperación de feriados en `end_date` y cancelación de las sesiones en feriado.

## Cambio
- `src/app/core/utils/promotion-end-date.utils.ts` — dos funciones puras nuevas:
  `promotionHolidayYears()` (el año de inicio y, si es otro, el año en que cae "inicio + 60 días")
  y `holidaysOfYear()` (deja solo las fechas del año pedido).
- `src/app/core/facades/promociones.facade.ts` — `fetchHolidaysForYears` usa la primera;
  `fetchHolidaysForYear` prueba las fuentes en orden y **acepta una solo si entrega fechas del año
  pedido**; se agrega `date.nager.at` como tercera fuente (ya documentada en DG-057 como alternativa
  verificada; entrega 2027 y marca los feriados regionales, que se descartan).
- `supabase/functions/_shared/holidays.ts` — mismo cambio en el espejo Deno. **La edge function
  `auto-create-next-promotions` la despliega Matías.**

No hay datos que corregir: la única promoción afectada es la de prueba del testing (se borra).

## Test de Regresión
- `promotion-end-date.utils.spec.ts`: años a consultar para inicios en octubre, 30-11, diciembre y
  enero; filtro de fechas por año.
- `promociones.facade.spec.ts`: inicio 30-11-2026 → consulta 2026 y 2027 y el término es
  06-01-2027; con la oficial caída y `boostr` respondiendo 2026, se usa la tercera fuente.
- `supabase/functions/_shared/holidays.test.ts`: espejo de los casos de las funciones puras.

## Progreso
- [x] Funciones puras + facade + espejo Deno, con sus tests. Vitest: 40/40 en los 2 archivos
  tocados (12 utilidad, 28 facade). `tsc` sin errores; `lint:arch` solo con los avisos de siempre.
  Los tests Deno no se ejecutaron (sin Deno/Docker en esta máquina); son espejo de los de Vitest.
- [x] Dos tests existentes del facade (fix-138) simulaban "fuente OK" con una lista vacía; con la
  regla nueva una lista sin fechas del año cuenta como fuente caída, así que ahora responden con un
  feriado real fuera del rango.
- [x] Revisión en navegador (admin, red real, 2026-10-06): `previewEndDate('2026-11-30')` pasó de
  `2027-01-05` a **`2027-01-06`**, sin aviso de feriados no verificados; 23-11 → 29-12 y
  26-10 → 30-11 sin cambios. En la red se ven las consultas a `date.nager.at/.../2027/CL`.
- [x] Matías desplegó `auto-create-next-promotions` (2026-10-06). No se invocó para comprobarlo:
  solo corre con `service_role` y, con el colchón completo, no llega a consultar feriados. La
  primera prueba real será la promoción que el cron cree cuando parta la 282 (02-11).

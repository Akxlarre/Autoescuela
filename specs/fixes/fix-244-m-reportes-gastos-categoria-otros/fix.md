# Fix: Reportes Contables — gastos de combustible y varios caen todos en "Otros"
> id: fix-244-m-reportes-gastos-categoria-otros
> refs: fix-243-m-egresos-sede-y-asociacion-obligatoria
> status: done
> closed: 2026-09-09
> created: 2026-09-09

## Root Cause

En la pestaña **Gastos por Categoría** de Reportes Contables, casi todo gasto aparece
rotulado "Otros", y a veces con varias filas distintas todas llamadas "Otros". Tres
causas apiladas en cómo se escribe y cómo se etiqueta `expenses.category`:

1. **Mismatch de nomenclatura `combustible` vs `fuel`.**
   `CuadraturaFacade.registrarEgreso()` escribe `category: 'combustible'` para los
   egresos de tipo combustible (`cuadratura.facade.ts:616`). Pero el diccionario
   `EXPENSE_LABEL` de `reportes-contables.utils.ts` usa la clave canónica `'fuel'`
   ('Bencina'), no `'combustible'`. `EXPENSE_LABEL['combustible']` es `undefined` →
   cae al `?? 'Otros'`. Todo egreso de combustible aparece como "Otros". (Efecto
   colateral: `RENTABILIDAD_VEHICLE_CATEGORIES = ['fuel', 'repair']` tampoco recoge
   el combustible → el prorrateo de bencina por tipo de curso queda en cero.)

2. **"Gastos Varios" nunca guarda categoría.**
   Para el tipo `gasto`, `registrarEgreso()` escribe `category: null` — el drawer de
   egreso no tiene selector de categoría para "Gastos Varios". Todo gasto no-combustible
   nace sin categoría → `null` → bucket `'other'` → "Otros".

3. **Filas "Otros" duplicadas.**
   `computeGastosCategoria()` agrupa por el string crudo de `category`. `null` cae al
   bucket `'other'` y `'combustible'` es su propio bucket, pero ambos se renderizan con
   el texto "Otros" (ambos caen al `?? 'Otros'`). Cualquier valor histórico fuera del
   diccionario (`materials`, `cleaning`, …) suma otra fila "Otros" más.

Los `fixed_expenses` (Gastos Fijos) no sufren esto porque su drawer usa
`GASTO_FIJO_CATEGORIES` con claves canónicas (`rent`, `salary`, …) que sí coinciden
con `EXPENSE_LABEL`.

## ACs Afectados

Ninguna spec declaró estos ACs — fix autónomo, continuación de fix-243-m (misma familia:
egresos que se registran mal desde el drawer de Cuadratura). ACs de regresión que
establece:

- **AC-1 — Combustible se rotula "Bencina", no "Otros":** un egreso de tipo combustible
  aparece en Gastos por Categoría bajo "Bencina" y entra al prorrateo de vehículo de la
  pestaña Rentabilidad.
- **AC-2 — Gastos varios se rotulan "Gastos Varios", no "Otros":** un egreso de tipo
  `gasto` aparece bajo "Gastos Varios". Las filas históricas de `expenses` con
  `category = null` (que siempre fueron gastos varios) también se muestran como
  "Gastos Varios" — sin migración de datos (criterio del owner en fix-243, AC-7).
- **AC-3 — Una sola fila "Otros":** cualquier `category` de `expenses` que no esté en el
  diccionario de etiquetas se agrupa en una única fila "Otros". Nunca dos filas con el
  mismo texto.

## Cambio

Se corrige **solo el lado de lectura/etiquetado** en `reportes-contables.utils.ts`. NO se
toca cómo `CuadraturaFacade.registrarEgreso()` escribe `expenses.category`: el valor
`'combustible'` ya es el de-facto canónico y del que dependen `FlotaFacade` (gasto de
bencina por vehículo, `.eq('category', 'combustible')`), `CuadraturaContentComponent`
(etiqueta/ícono del egreso) e `historial-cuadraturas`. Cambiar la escritura sería un fix
de otra familia con blast radius propio.

- **Archivo:** `src/app/core/utils/reportes-contables.utils.ts`
  - `EXPENSE_LABEL` gana `general: 'Gastos Varios'`.
  - Nuevo `EXPENSE_CATEGORY_ALIAS = { combustible: 'fuel' }` — normaliza el valor legacy
    del drawer a la clave canónica al LEER (sin migración de datos, fix-243 AC-7).
  - `computeGastosCategoria()`: para cada gasto, `category ?? 'general'` → aplica alias →
    si la clave canónica no está en `EXPENSE_LABEL` cae en `'other'`. Todo esto **antes**
    de agrupar, así `fuel` + `combustible` = una sola fila "Bencina" y las claves
    desconocidas = una sola fila "Otros".
  - `RENTABILIDAD_VEHICLE_CATEGORIES` incluye `'combustible'` junto a `'fuel'`/`'repair'`
    para que el egreso de combustible entre al prorrateo de vehículo de la pestaña
    Rentabilidad (antes quedaba en cero).

## Test de Regresión

- `src/app/core/utils/reportes-contables.utils.spec.ts > computeGastosCategoria`:
  - `rotula "fuel" y el alias legacy "combustible" como "Bencina"` ✓ (AC-1)
  - `rotula "general" y category=null como "Gastos Varios"` ✓ (AC-2)
  - `agrupa toda categoría desconocida en una sola fila "Otros"` ✓ (AC-3)
- `src/app/core/utils/reportes-contables.utils.spec.ts > computeRentabilidadCursos`:
  - `el pool de vehículo incluye category="combustible"` ✓ (AC-1)
- `npm run test:ci` verde completo (sin regresiones en cuadratura / flota / historial —
  la escritura de `category` no cambió).
- `/verify` (Playwright): pestaña Gastos por Categoría del reporte muestra "Bencina" y
  "Gastos Varios" con datos reales; no hay dos filas "Otros".

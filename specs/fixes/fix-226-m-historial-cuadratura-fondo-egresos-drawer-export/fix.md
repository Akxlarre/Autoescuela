# Fix: Historial de Cuadratura — fondo de apertura, egresos efectivo vs no-efectivo, layout con drawer y menú Exportar recortado
> id: fix-226-m-historial-cuadratura-fondo-egresos-drawer-export
> refs: fix-211-m-arqueo-caja-metodo-pago-egresos, 0012-m-persistir-borrador-cierre-caja
> status: done
> closed: 2026-08-27
> created: 2026-08-27

## Root Cause

La vista **Historial de Cuadraturas** (calendario mensual + drawer de detalle) y sus
reportes fueron construidos **antes** de que:

1. `cash_closings.opening_amount` existiera (lo agregó spec 0012-m), y
2. los egresos distinguieran método de pago (`expenses.payment_method` / `instructor_advances.payment_method`, fix-211-m).

Como consecuencia, la capa de historial/reporte quedó desincronizada de lo que el cierre
realmente persiste:

- **`mapCierreToHistorial()`** (`historial-cuadraturas.facade.ts:75`) hardcodea
  `fondoInicial: 50_000` e ignora `row.opening_amount`, que **sí** viene en la fila. El
  drawer de detalle ni siquiera muestra ese campo.
- **`DetalleCuadraturaModalComponent`** muestra en "Conciliación Operativa" tres cifras
  sueltas — Ingresos registrados, Egresos/Gastos (total, todos los métodos) y Cierre Total —
  que **no cuadran entre sí** (`0 − 84.000 ≠ 15.000`), porque el arqueo solo considera
  efectivo pero la card no lo dice ni separa el egreso no-efectivo (tarjeta/transferencia).
- **Edge functions `generate-cash-closing-report` y `generate-cash-history-report`**
  repiten el mismo `const FONDO_INICIAL = 50_000` hardcodeado y calculan
  `saldoTeorico`/`totalEgresos` sin separar efectivo.

Aparte, dos bugs de UI de la misma vista, del mismo lote de pulido (`fix/detalles-finales`):

- **Layout con drawer abierto:** `historial-cuadraturas-content` usa
  `.bento-grid--fill-screen-kpi`, cuyo `grid-template-rows: auto auto minmax(0,1fr)` +
  `height: calc(100vh - 120px)` viven dentro de `@container layoutmain (min-width: 1024px)`.
  Al abrir un drawer que angosta `<main>` por debajo de 1024px, la regla deja de aplicar y
  el grid cae al default (`grid-auto-rows: minmax(120px, auto)`): el hero `density="slim"`
  (~64px reales) se estira a 120px y aparece un hueco enorme entre el hero y el calendario.
  Mismo bug ya documentado y resuelto en `admin-auditoria.component.ts` y
  `admin-alumno-detalle.component.ts` con un `@container layoutmain (max-width: 1023px)` que
  colapsa las filas a `auto`.
- **Menú Exportar del drawer de detalle:** en `DetalleCuadraturaModalComponent` el dropdown
  es `absolute top-full mt-2` — se abre hacia abajo. Como el botón está al fondo de un
  drawer scrolleable, el menú queda recortado/invisible bajo el borde inferior.

> **Nota de alcance:** normalmente esto serían varios fix tracks. Se agrupan a pedido
> explícito del owner porque son todos "detalles finales" de una sola vista (Historial de
> Cuadratura) y comparten el mismo QA visual de cierre. Los puntos 1–2 + edge functions
> comparten causa raíz (capa de historial desincronizada del cierre); 3 y 4 son bugs de UI
> de la misma vista arrastrados en la misma rama.

## ACs Afectados

Ninguno con AC formal escrito — fix-211-m y 0012-m no dejaron AC sobre la vista de
historial. Este fix cierra la brecha entre lo que esas specs persistieron y lo que el
historial muestra.

- **fix-211-m** ("solo egresos en efectivo salen físicamente de la caja"): el historial
  ahora refleja esa distinción en vez de mostrar el egreso total como si todo afectara el
  arqueo.
- **0012-m** (`opening_amount` persistido por cierre): el historial ahora lee y muestra el
  fondo de apertura real en vez de un `50_000` hardcodeado.

## Cambio

### Parte A — Fondo de apertura real (dato)
- **Migración nueva:** `cash_closings.cash_expenses INTEGER` — snapshot de egresos pagados
  en efectivo al momento del cierre (lo único que baja el saldo físico). Idempotente
  (`ADD COLUMN IF NOT EXISTS`). Documentar en `indices/DATABASE.md`.
- **`core/facades/cuadratura.facade.ts`** — `cerrarCaja()`: persistir
  `cash_expenses: this.totalEgresosEfectivoHoy()`. (Ya persiste `opening_amount`.)
- **`core/facades/historial-cuadraturas.facade.ts`** — `mapCierreToHistorial()`: borrar
  `fondoInicial: 50_000`; leer `row.opening_amount` (nullable → `null`, no un default
  falso); mapear `cashExpenses` desde `row.cash_expenses` con fallback derivado
  `opening_amount + cash_amount − balance` para filas viejas sin la columna.
- **`core/models/ui/historial-cuadraturas.model.ts`** — `fondoInicial: number | null`;
  agregar `cashExpenses: number` y `nonCashExpenses` (derivado `totalEgresos − cashExpenses`).
- **`core/models/dto/cash-closing.model.ts`** — agregar `cash_expenses`.

### Parte B — Conciliación que cuadra (UI del drawer de detalle)
- **`shared/components/detalle-cuadratura-modal/detalle-cuadratura-modal.component.ts`**:
  - Card/KPI de **Fondo de apertura** (si `fondoInicial === null` → "No registrado").
  - Rehacer "Conciliación Operativa" para que la aritmética sea explícita y cierre:
    `Fondo apertura + Ingresos efectivo − Egresos efectivo = Saldo teórico`, y aparte
    `Total egresos del día` con nota "$X pagados con tarjeta/transferencia — no afectan el arqueo".
  - Menú Exportar: abrir hacia arriba (`bottom-full mb-2`) en vez de `top-full mt-2`.

### Parte C — Layout con drawer abierto
- **`shared/components/historial-cuadraturas-content/historial-cuadraturas-content.component.ts`**
  (bloque `styles`): agregar
  `@container layoutmain (max-width: 1023px) { .bento-grid.bento-grid--fill-screen-kpi { grid-template-rows: auto auto auto; } }`
  — misma técnica que `admin-auditoria.component.ts:344`.

### Parte D — Edge functions
- **`supabase/functions/generate-cash-closing-report/index.ts`**: quitar
  `FONDO_INICIAL = 50_000`; usar `cierreData.opening_amount ?? 0`; separar
  `totalEgresosEfectivo` (join `payment_method` en el select de `expenses` /
  `instructor_advances`) de `totalEgresos`; `saldoTeorico = openingAmount + totalEfectivo − totalEgresosEfectivo`.
- **`supabase/functions/generate-cash-history-report/index.ts`**: mismo tratamiento —
  `r.opening_amount ?? 0` en vez de `FONDO_INICIAL`.

## Test de Regresión

`src/app/core/facades/historial-cuadraturas.facade.spec.ts > mapCierreToHistorial`:
- `usa opening_amount real cuando viene, y null cuando falta` ✓
- `usa cash_expenses persistido y deriva nonCashExpenses del total` ✓
- `cashExpenses cae al fallback derivado (opening + cash_amount − balance) cuando la columna es null` ✓
- `el libro de conciliación cuadra: fondo + ingresosEfectivo − cashExpenses === saldoSistema` ✓

`src/app/core/facades/cuadratura.facade.spec.ts`:
- `cerrarCaja … > persiste cash_expenses = totalEgresosEfectivoHoy (fix-226-m)` ✓

Verificación:
- `npx vitest run` → 2239 passed (1 fallo **pre-existente y ajeno**:
  `secretaria-contabilidad-cuadratura.component.spec.ts` llama `openIngresoDrawer()`, método
  renombrado a `abrirDrawerIngreso()` por otro track de esta misma rama — fuera del alcance
  de este fix).
- `ng build` ✓ · `npm run lint:arch` → 0 errores.
- `/verify` visual en la app (admin, 1440px, drawer abierto): Fondo de apertura $50.000
  visible; Conciliación cuadra (50.000 + 0 − 34.000 = 16.000 teórico, dif −1.000); nota
  "$50.000 pagados con tarjeta/transferencia — no afectan el arqueo"; sin hueco
  hero↔calendario; menú Exportar del drawer abre hacia arriba y se ve completo.

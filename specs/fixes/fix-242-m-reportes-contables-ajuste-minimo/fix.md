# Fix: Reportes Contables — ajuste mínimo (punto de equilibrio + recompose app-like)

> id: fix-242-m-reportes-contables-ajuste-minimo
> refs: 0003-i-app-like-reportes-contables
> status: done
> closed: 2026-09-08
> created: 2026-09-08

## Nota de cierre (2026-09-08)

### Ronda final — manejo de espacio por tab + Evolución serie fija

- ✅ **Evolución Mensual: serie FIJA de últimos 6 meses** hasta el mes en curso,
  independiente del filtro de rango. Antes con "Mes actual" mostraba un solo mes
  (inútil). `evolucionMensual` pasó de `_reporte()?.evolucionMensual` al signal
  `_evolucionSerie`, que `fetchEvolucionSerie(desde,hasta,branch)` puebla con su
  propia ventana (`ReportesContablesFacade.EVOLUCION_MONTHS`), agregada al
  `Promise.all` de `fetchReporte`. `computeEvolucionMensual` sin cambios.
- ✅ **Manejo de espacio (todas las tabs llenan el panel):** `<app-evolucion-mensual-chart>`
  `:host` flex-col `height:100%` + columnas/barras `flex:1` → el gráfico crece al
  alto disponible. `<app-rentabilidad-cursos>` `:host` flex-col, tabla `flex-1
  min-h-0 overflow-y-auto`, nota al pie `shrink-0`. Gastos Fijos: header
  `shrink-0`, empty `flex-1`, tabla `flex-1 min-h-0 overflow-auto`.
- Opciones de layout más grandes (C/E/F/G/H/J/K) — el owner las revisó y
  descartó; se quedó con la estructura actual + este manejo de espacio.

---

El alcance final quedó más chico que lo planificado abajo, tras varias rondas de
revisión visual con el owner:

- ✅ Eliminado el tab "Detalle Diario" + todo su wiring (`detalleDiario`,
  `diasConMovimientos`, `verDetalle`, `computeDetalleDiario`). Nota: la Edge
  Function `generate-financial-report` tiene su propia copia de
  `computeDetalleDiario` (Deno, no importa de `src/`) — el export Excel/PDF sigue
  incluyendo esa sección. Sin tocar acá.
- ✅ Evolución Mensual: tabla → `<app-evolucion-mensual-chart>` (barras) — nuevo
  Dumb en `shared/components/evolucion-mensual-chart/`.
- ✅ Layout: hero sin tocar (`<app-section-hero density="slim">`) en su fila +
  **una sola celda `.bento-fill`** con filtros/tabs como cabecera fija y el
  contenido de la tab activa scrolleando debajo. Categorías pasó a tab por
  defecto. Root `bento-grid--fill-screen`.
- ✅ Categorías: en lg+ cada tarjeta (Ingresos / Gastos por Categoría) llena el
  alto del panel — lista scrolleable arriba, fila Total anclada abajo, empty
  state centrado — para que no quede hueco con pocas categorías. Móvil sin
  cambios (scroll nativo).
- ❌ **Barra de "Punto de Equilibrio" — descartada.** Se implementó
  (`computeBreakEven` + `BreakEven` model + `puntoEquilibrio` computed) y el owner
  la rechazó por no ser clara. Todo ese código se revirtió: no queda rastro en
  `src/`.
- ❌ Cabecera unificada sin `<app-section-hero>` — también revertida; el hero
  quedó como estaba.

Verificación: `tsc` 0 errores · `npm run test:ci` 2336/2336 · `npm run lint:arch`
0 errores · `/verify` navegador (admin + secretaría, claro/oscuro, desktop +
móvil).

## Root Cause

La vista de Reportes Contables (`0003-i`) quedó funcional pero con tres problemas de
producto detectados en revisión con el dueño:

1. **Ruido:** el tab "Detalle Diario" es la misma tabla día-por-día que ya provee
   Cuadratura Diaria — en un reporte contable mensual el dueño quiere el consolidado,
   no 30 filas. Los subtítulos "N operaciones / N egresos" de los KPI tampoco aportan.
2. **Falta el dato que el dueño pide textual:** "cuánto tengo que vender para cubrir los
   gastos". El KPI "Total Neto" ya es `ingresos − gastos` pero deja la pregunta a medias
   (si es negativo, ¿cuánto falta?, ¿voy al 40% o al 90%?).
3. **Layout app-like a medias:** el template declara `bento-grid--fill-screen-4` y
   `bento-grid--rows-fit` a la vez. Cuatro filas fijas apiladas (Hero slim, Filtros,
   Categorías con scroll propio, panel de tabs) dejan al `.bento-fill` como una tira y
   un hueco en blanco abajo.

## ACs Afectados

De `0003-i-app-like-reportes-contables`:

- **AC que incluía "Detalle Diario" como tab del panel** → se elimina el tab. El grano
  diario es responsabilidad de Cuadratura Diaria; el output `verDetalle` y todo su
  wiring salen.
- **AC de estructura app-like (fill-screen + jerarquía plana)** → se cumple mejor:
  una sola cabecera compacta fija + un único `.bento-fill`. Se elimina la fila fija de
  Categorías (pasa a tab) y el modificador `bento-grid--rows-fit`.
- **AC de KPIs de cabecera** → los 3 KPI se mantienen; cambia el subtítulo (sale el
  conteo de operaciones, entra la barra de punto de equilibrio cruzando debajo).

Ninguna sección se pierde salvo Detalle Diario. Evolución Mensual, Rentabilidad,
Gastos Fijos, Ingresos/Gastos por Categoría y export Excel/PDF se conservan.

## Cambio

Alcance confirmado con el dueño (2026-09-08): **todo junto**, incluido el gráfico de
barras de Evolución.

- **Archivo:** `src/app/shared/components/reportes-contables-content/reportes-contables-content.component.ts`
  - Quitar `@case ('detalle')`, `{ id: 'detalle', ... }` de `tabOptions()`, inputs
    `detalleDiario` / `diasConMovimientos`, output `verDetalle`, computed `totalesDiario`.
  - Nuevo `computed()` `puntoEquilibrio` = `{ avancePct, faltante, umbral, diaCruce, semaforo }`
    derivado de `kpis()` (`totalIngresos` / `totalGastos`) + `filtros()` (para `diaCruce`
    solo cuando el rango es el mes en curso). Sin queries nuevas.
  - Recompose de template: Hero slim + fila de Filtros → **una cabecera compacta**
    (título + 3 `.card-tinted` con la barra de equilibrio + rango + chip período + tabs).
  - Categorías: de fila fija `bento-banner reportes-categorias-scroll` → `@case ('categorias')`,
    tab por defecto. `tabOptions()` queda: Categorías · Evolución · Rentabilidad · Gastos Fijos(admin).
  - Grilla raíz: `bento-grid--fill-screen-4 bento-grid--rows-fit` → `bento-grid--fill-screen-kpi`.
  - Evolución Mensual: tabla → gráfico de barras ingresos/gastos por mes. Con rango de un
    solo mes, el tab pide 6 meses de contexto para que el gráfico tenga sentido (o cae a
    un `app-empty-state` si no hay histórico).
- **Archivo:** `src/app/core/utils/reportes-contables.utils.ts`
  - `computeBreakEven(kpis, hoy?, rangoEsMesActual)` — función pura nueva (TDD).
  - `computeDetalleDiario` / `DetalleDiario` quedan si algún otro consumidor los usa;
    si `reportes-contables-content` era el único, se eliminan junto con el campo
    `detalleDiario` de `ReporteContable` y su ensamblado en `buildReporte`.
- **Archivo:** `src/app/core/facades/reportes-contables.facade.ts`
  - Dejar de exponer `detalleDiario` / `diasConMovimientos` si nadie más los consume.
- **Archivo (nuevo, si se extrae el gráfico):** `src/app/shared/components/evolucion-mensual-chart/`
  - Dumb component: `input()` `datos: EvolucionMensual[]`. Barras SVG/CSS con tokens del DS.
- Índices a sincronizar: `COMPONENTS.md`, `UTILS.md`, `USAGE-MAP.md`.

## Test de Regresión

- `src/app/core/utils/reportes-contables.utils.spec.ts > computeBreakEven` — casos:
  ingresos > gastos (avance ≥ 100, faltante 0), ingresos < gastos (faltante correcto,
  avance < 100), gastos = 0 (no divide por cero), `diaCruce` solo con rango mes actual. ✓
- `src/app/shared/components/reportes-contables-content/reportes-contables-content.component.spec.ts`
  — `tabOptions()` ya no incluye `detalle`; incluye `categorias`. El componente ya no
  declara input `detalleDiario`. ✓
- `npm run test:ci` verde completo.
- `/verify` (Playwright): cabecera compacta + panel `.bento-fill` ocupa el resto sin
  hueco; barra de equilibrio renderiza con datos reales; tabs Categorías/Evolución/
  Rentabilidad/Gastos Fijos funcionan; modo claro/oscuro; 4 puntos de entrada
  (admin/secretaria × desktop/mobile).

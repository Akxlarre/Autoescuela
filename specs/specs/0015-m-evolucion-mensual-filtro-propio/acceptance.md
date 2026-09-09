# Acceptance 0015 — Evolución Mensual: selector de rango propio de la pestaña

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md) · **Tasks:** [tasks.md](./tasks.md)
> **Verified:** 2026-09-09
> **Verifier:** Claude (implementación + `/verify`) · pendiente visto bueno visual de Matías

---

## Resumen

- AC totales: 14 (10 AC + 4 edge)
- AC cumplidos: 14
- AC fallidos: 0
- AC con evidencia: 14 (tests unitarios + verificación visual Playwright)

**Veredicto final:** ✅ PASA — pendiente el visto bueno visual del owner (spec 0030: el veredicto ✅ no cierra el track de UI)

`npm run test:ci`: **2380 passed** · `tsc --noEmit`: 0 · `npm run lint:arch`: 0 errores.

---

## Verificación por AC

### AC1 — En Evolución Mensual el selector ofrece SOLO las 4 opciones nuevas

- **Estado:** ✅ cumplido
- **Evidencia:**
  - `src/app/shared/components/reportes-contables-content/reportes-contables-content.component.ts` — `selectOptions = computed(() => isEvolucionTab() ? rangosEvolucion : rangos)`.
  - Test: `reportes-contables-content.component.spec.ts` → `en la pestaña Evolución el selector ofrece SOLO las opciones de Evolución (AC1)` — valores `['ultimos_6_meses','ultimos_12_meses','anio_actual','anio_anterior']`, sin `mes_actual`/`personalizado`.
  - QA visual: `verify-0015-dropdown.png` — dropdown muestra exactamente "Últimos 6 meses / Últimos 12 meses / Año actual / Año anterior".

### AC2 — En las otras pestañas el selector mantiene las opciones generales

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Test: `reportes-contables-content.component.spec.ts` → `en las otras pestañas el selector mantiene las opciones generales (AC2)`.
  - QA visual: al volver de Evolución a Categorías el selector vuelve a "Mes actual" (`verify` — snapshot final `combobox "Mes actual"`).

### AC3 — "Últimos 6 meses" → exactamente 6 barras cronológicas

- **Estado:** ✅ cumplido
- **Evidencia:**
  - `computeEvolucionRange('ultimos_6_meses', …)` — test `reportes-contables.utils.spec.ts` → `ultimos_6_meses → 6 meses [abr..sep], desde 1° abril, hasta fin septiembre`.
  - Facade: `reportes-contables.facade.spec.ts` → `el rango de evolución arranca en "ultimos_6_meses" y la serie trae 6 meses`.
  - QA visual: `verify-0015-evo-6m-v2.png` — 6 columnas Abr…Sep en orden.

### AC4 — "Últimos 12 meses" → 12 barras

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Test: `computeEvolucionRange` → `ultimos_12_meses → 12 meses [oct 2025 .. sep 2026]`.
  - Facade: `aplicarRangoEvolucion("ultimos_12_meses") repuebla la serie con 12 meses`.
  - QA visual: `verify-0015-evo-12m-v2.png` — 12 columnas (con scroll horizontal interno del chart, ver AC-E2).

### AC5 — "Año actual" → enero hasta el mes en curso, inclusive; sin meses futuros

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Test: `computeEvolucionRange` → `anio_actual → enero hasta el mes en curso, inclusive (AC5)` (sep → `['2026-01' … '2026-09']`, 9 meses).
  - QA visual: `verify-0015-evo-anioActual.png` — 9 columnas Ene…Sep, chip `01/01/2026 – 30/09/2026`, sin Oct-Dic.

### AC6 — "Año anterior" → los 12 meses del año calendario anterior

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Test: `computeEvolucionRange` → `anio_anterior → los 12 meses del año calendario anterior (AC6)` (`['2025-01' … '2025-12']`, desde `2025-01-01`, hasta `2025-12-31`).
  - Facade: `"anio_anterior" → 12 meses, todos del año calendario anterior (AC6)`.
  - QA visual: `verify-0015-evo-anioAnterior.png` — chip `01/01/2025 – 31/12/2025`, 12 columnas Ene…Dic.

### AC7 — Mes sin ingresos ni gastos: se dibuja igual, con nota "sin movimientos"

- **Estado:** ✅ cumplido (con ajuste de UX del owner: nota **arriba** de las barras y capitalizada "Sin movimientos")
- **Evidencia:**
  - `computeEvolucionMensual(_, _, meses)` — test `meses sin ingresos NI gastos quedan en 0 y sinMovimientos=true (AC7, AC-E3)`.
  - `EvolucionMensual.sinMovimientos: boolean` (nuevo campo).
  - Chart: `evolucion-mensual-chart.component.ts` — `@if (mes.sinMovimientos)` renderiza `<span class="mes-sin-mov">Sin movimientos</span>` **encima** de `<div class="bars bars--empty">` (línea base punteada, sin stubs de color).
  - Test chart: `propaga sinMovimientos a cada barra` + `mantiene todas las columnas del rango, incluidas las de valor 0`.
  - QA visual: `verify-0015-evo-6m-v2.png` (Abr/Jun con nota + baseline punteada, distinguibles de May que sí tiene barras).

### AC8 — Cada grupo de pestañas mantiene su propio rango

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Dos ejes de estado: `_filtros` (general) y `_rangoEvolucion` (evolución) en el facade; en el Dumb, `localRango` y `localRangoEvolucion` (linkedSignals separados).
  - Test facade: `aplicarRangoEvolucion NO toca el filtro general ni dispara skeleton (AC8, AC10)`.
  - Test Dumb: `cada eje conserva su propio rango al cambiar de pestaña (AC8)`.
  - QA visual: Evolución en "Año actual" → tab Categorías muestra "Mes actual" y chip `01/09/2026 – 30/09/2026`; al volver a Evolución sigue en "Año actual".

### AC9 — El chip de fechas refleja la ventana efectiva del rango de Evolución

- **Estado:** ✅ cumplido
- **Evidencia:**
  - `rangoDatesLabel = computed(...)` usa `computeEvolucionRange(localRangoEvolucion())` en la pestaña Evolución.
  - QA visual: chip cambia `01/04/2026 – 30/09/2026` (6m) → `01/10/2025 – 30/09/2026` (12m) → `01/01/2026 – 30/09/2026` (año actual) → `01/01/2025 – 31/12/2025` (año anterior).

### AC10 — KPIs del header y resto de pestañas sin cambios de cálculo

- **Estado:** ✅ cumplido
- **Evidencia:**
  - `fetchReporte()` (KPIs / Categorías / Rentabilidad / Gastos Fijos) sigue usando `_filtros()`; `aplicarRangoEvolucion` solo llama `refreshEvolucionSerie()`.
  - Test facade: `aplicarRangoEvolucion NO toca el filtro general …` — `filtros()` idéntico antes/después, `isLoading()` en `false`.
  - Los 2312 tests preexistentes de este módulo siguen verdes.
  - Nota UX menor: el badge "% margen" del header se oculta en la pestaña Evolución (el número corresponde al rango general, no a la ventana de la serie — evitaba confusión). No cambia ningún cálculo.

### AC-E1 — "Año actual" en enero → una sola barra, sin romper

- **Estado:** ✅ cumplido
- **Evidencia:** Test `computeEvolucionRange` → `anio_actual en enero → un solo mes (AC-E1)` (`['2026-01']`, desde `2026-01-01`, hasta `2026-01-31`).

### AC-E2 — Hasta 12 barras: layout legible, sin romper app-like

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Chart: `.mes-col { flex: 1 1 64px; min-width: 60px }` + `.chart-scroll { overflow-x: auto }`. 6 y 9 meses caben sin scroll; 12 meses activan scroll **interno** del chart.
  - Probe app-like (año actual, 9 cols): `documentScrollsX: false`, `documentScrollsY: false`, `chartScrollHasOverflowX: false`.
  - `.mes-sin-mov` envuelve dentro de la columna (`white-space: normal; overflow-wrap: break-word`) — no se derrama sobre columnas vecinas en 12 meses.
  - QA visual: `verify-0015-evo-12m-v2.png` (12 barras legibles con scroll), `verify-0015-mobile.png` (375px OK).

### AC-E3 — Todos los meses sin movimientos → N barras en 0, no empty-state

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Test utils: `meses sin ingresos NI gastos quedan en 0 y sinMovimientos=true (AC7, AC-E3)`.
  - QA visual: `verify-0015-evo-anioAnterior.png` — 12 columnas "Sin movimientos" con línea base punteada, ningún `app-empty-state`.

### AC-E4 — Mes con solo ingresos o solo gastos NO lleva nota "sin movimientos"

- **Estado:** ✅ cumplido
- **Evidencia:**
  - `sinMovimientos = ingresos === 0 && gastos === 0` (ambos caminos de `computeEvolucionMensual`).
  - Test utils: `un mes con solo ingresos o solo gastos NO es "sin movimientos" (AC-E4)` + `setea sinMovimientos por fila también sin lista de meses`.

---

## Out-of-scope respetado

- ❌ Cálculo de KPIs del header / otras pestañas — confirmado: sin cambios (AC10).
- ❌ Rango `Personalizado` para Evolución — confirmado: no está entre las 4 opciones.
- ❌ Granularidad distinta a mensual — confirmado: no se tocó.
- ❌ Export Excel/PDF (`generate-financial-report`) — confirmado: `exportar()` sigue usando `_filtros()`, sin cambios en la Edge Function.
- ❌ Persistencia entre sesiones de la última selección — confirmado: `_rangoEvolucion` arranca siempre en `ultimos_6_meses`.
- ❌ Realtime / auto-refresh de la serie — confirmado: no se agregó.

---

## Deuda técnica detectada

- **Posible doble fetch de la serie al cambiar de opción** (observado en el panel de red del `/verify`): al seleccionar un rango nuevo se ve la fetch de `refreshEvolucionSerie` y, en algunos casos, una segunda fetch de la misma ventana. Todas 200, cacheadas, en pantalla admin-only — no bloquea. Revisar si `aplicarRangoEvolucion` se solapa con un `fetchReporte` disparado por el `effect()` del Smart en el mismo ciclo. → candidato a `fix-` si molesta.
- El shell `bento-grid--fill-screen-kpi` de la página no revierte a scroll nativo puro en móvil (comportamiento preexistente de la página, no introducido por esta spec).

---

## Cambios en índices

- `indices/MODELS.md` — `reportes-contables.model.ts`: agregados `RangoEvolucion`, `RangoEvolucionOption`, `RANGOS_EVOLUCION`, `RANGO_EVOLUCION_DEFAULT`; `EvolucionMensual` gana `sinMovimientos`.
- `indices/UTILS.md` — `reportes-contables.utils.ts`: nuevo `computeEvolucionRange`; `computeEvolucionMensual` gana overload `meses?`.
- `indices/COMPONENTS.md` — sin cambios estructurales (mismos componentes, inputs/outputs nuevos en `reportes-contables-content`: `rangoEvolucion` in, `aplicarRangoEvolucion` out).

---

## Changelog

- 2026-09-09 — verificación inicial. 14/14 AC con evidencia. Pendiente visto bueno visual de Matías sobre las 4 vistas (capturas `verify-0015-*.png`).

# Plan 0015 — Evolución Mensual: selector de rango propio de la pestaña

> **Spec:** [spec.md](./spec.md)
> **Status:** draft
> **Created:** 2026-09-09

---

## 1. Resumen ejecutivo

La pestaña Evolución Mensual pasa a tener su **propio estado de rango** (`RangoEvolucion`),
independiente del `FiltrosReporte` general que sigue alimentando KPIs + Categorías +
Rentabilidad + Gastos Fijos. El selector `p-select` del header muestra una lista de opciones u
otra según la pestaña activa. La serie del gráfico deja de ser una ventana fija de 6 meses:
`computeEvolucionRange()` traduce cada opción (`ultimos_6_meses` / `ultimos_12_meses` /
`anio_actual` / `anio_anterior`) a `[desde, hasta]` + la lista ordenada de `YYYY-MM` a pintar.
`computeEvolucionMensual()` rellena esa lista con barras en cero y marca `sinMovimientos` por
mes. El chart dibuja una nota discreta "sin movimientos" en esos meses.

Orden grueso: (1) modelo + helper puro + tests, (2) facade + tests, (3) chart Dumb + tests,
(4) content Dumb + tests, (5) wiring en los 2 Smart, (6) `/verify` layout 6 vs 12 barras.

---

## 2. Inventario de impacto

### Archivos a CREAR

Ninguno. Todo es extensión de artefactos existentes.

### Archivos a MODIFICAR

| Path | Cambio | Motivo |
|------|--------|--------|
| `src/app/core/models/ui/reportes-contables.model.ts` | Nuevo `type RangoEvolucion`, const `RANGOS_EVOLUCION: RangoOption[]`, `EvolucionMensual` gana `sinMovimientos: boolean`, nueva fn pura `computeEvolucionRange(rango, now?) → { desde; hasta; meses: string[] }` | Opciones nuevas + zero-fill + semántica "año actual = ene→mes actual" (AC1, AC4–AC6, AC7) |
| `src/app/core/utils/reportes-contables.utils.ts` | `computeEvolucionMensual(payments, expenses, meses?: string[])` — con `meses` emite exactamente esos meses en orden, zero-fill de faltantes, `sinMovimientos = ingresos===0 && gastos===0` en ambos caminos | AC3–AC7, AC-E3, AC-E4 |
| `src/app/core/facades/reportes-contables.facade.ts` | `_rangoEvolucion = signal<RangoEvolucion>('ultimos_6_meses')` + `rangoEvolucion` readonly; `evolucionSerieRange()` usa `computeEvolucionRange(_rangoEvolucion())` y devuelve también `meses`; `fetchEvolucionSerie(...)` recibe y pasa `meses`; nuevo `aplicarRangoEvolucion(r)` con su propio `createRequestGuard()`; se elimina el `static EVOLUCION_MONTHS` (la ventana la da el helper) | Estado independiente por grupo (AC8, AC10), race guard (regla facades §7) |
| `src/app/shared/components/evolucion-mensual-chart/evolucion-mensual-chart.component.ts` | Renderizar nota "sin movimientos" cuando `mes.sinMovimientos`; comprimir `gap`/`min-width` de `.mes-col` para que 12 columnas entren; `.chart-scroll` ya tiene `overflow-x:auto` como fallback | AC7, AC-E2 |
| `src/app/shared/components/reportes-contables-content/reportes-contables-content.component.ts` | Nuevo `input rangoEvolucion`, nuevo `output aplicarRangoEvolucion`; `localRangoEvolucion = linkedSignal(...)`; el `p-select` alterna `[options]`/`[ngModel]`/`(ngModelChange)` según `activeTab() === 'evolucion'`; `@if ('personalizado')` de los date-input solo fuera de evolución; label dinámico ("últimos 6 meses" / "últimos 12 meses" / "año 2026" / "año 2025"); chip de fechas usa la ventana efectiva en evolución; quitar branch de empty-state (la serie ya nunca es `[]`) dejándola como defensa `@if (length)` | AC1, AC2, AC8, AC9 |
| `src/app/features/admin/contabilidad-reportes/admin-contabilidad-reportes.component.ts` | `[rangoEvolucion]="facade.rangoEvolucion()"` + `(aplicarRangoEvolucion)="facade.aplicarRangoEvolucion($event)"` | Wiring |
| `src/app/features/secretaria/contabilidad-reportes/secretaria-contabilidad-reportes.component.ts` | Idem admin | Wiring |

### Archivos a MODIFICAR (tests, TDD primero)

| Path | Casos nuevos |
|------|--------------|
| `src/app/core/models/ui/reportes-contables.model.spec.ts` *(o donde vivan los tests de `computeDateRange`)* | `computeEvolucionRange`: 6→6 meses, 12→12, `anio_actual` en sep→9 (ene..sep), `anio_actual` en ene→1, `anio_anterior`→12 (ene..dic año-1); `[desde,hasta]` correctos |
| `src/app/core/utils/reportes-contables.utils.spec.ts` | `computeEvolucionMensual(..., meses)`: zero-fill en orden; `sinMovimientos` true solo con 0 y 0; mes con solo ingresos o solo gastos → `sinMovimientos:false` (AC-E4); sin `meses` sigue comportándose como hoy pero con `sinMovimientos` seteado |
| `src/app/core/facades/reportes-contables.facade.spec.ts` | default `rangoEvolucion === 'ultimos_6_meses'`; `aplicarRangoEvolucion('ultimos_12_meses')` re-puebla `_evolucionSerie` con 12 meses y **no** toca `_filtros`/`kpis` (AC8, AC10); guard descarta respuesta vieja |
| `src/app/shared/components/reportes-contables-content/reportes-contables-content.component.spec.ts` | en tab `evolucion` las opciones del select == `RANGOS_EVOLUCION` (sin `mes_actual`); en otras tabs == `RANGOS_REPORTE`; cambiar el select en `evolucion` emite `aplicarRangoEvolucion` y NO `aplicarFiltros`; cambiar de tab preserva ambos rangos |
| `src/app/shared/components/evolucion-mensual-chart/evolucion-mensual-chart.component.spec.ts` | pinta la nota "sin movimientos" para filas `sinMovimientos:true` y no para el resto; N columnas para N meses incl. los de valor 0 |

### Archivos a ELIMINAR

Ninguno.

---

## 3. Reutilización (Discovery)

### Componentes existentes que reutilizamos
- `<app-evolucion-mensual-chart>` (`shared/components/evolucion-mensual-chart/`, Dumb, fix-242-m) — se extiende, no se recrea. Ya tiene `.chart-scroll { overflow-x:auto }`, `:host` flex-col `height:100%`, `shortLabel()` (Ene 26), `compact()`.
- `<app-reportes-contables-content>` (`shared/`, Dumb) — ya tiene estado local `activeTab`, `localRango/localDesde/localHasta` (linkedSignal), `p-select` de rango. Se agrega un segundo eje de rango, mismo patrón.
- `p-select`, `<app-tabs variant="segmented">`, `<app-empty-state>`, `<app-badge>` — sin cambios.

### Facades/Services existentes que extendemos
- `ReportesContablesFacade` — ya tiene SWR (`_initialized`, `refreshSilently`), `reporteGuard` (`createRequestGuard`), y `fetchEvolucionSerie()` **ya aislado** dentro del `Promise.all` de `fetchReporte()`. Solo hay que: darle su propio signal de rango + guard, y un método público para re-pedir la serie sin re-pedir todo el reporte.
- `computeEvolucionMensual()` / `computeDateRange()` en `reportes-contables.utils.ts` y `reportes-contables.model.ts` — se extienden con overload / función hermana.

### Componentes/Facades que NO existen y debemos crear
- Ninguno. La spec es un cambio de comportamiento sobre la tubería existente de fix-242-m.

---

## 4. Modelo de datos

**N/A** — cero cambios de BD, RLS ni Supabase. Todo cliente.

Cambios de tipos (UI models, no DTO):
- `RangoEvolucion = 'ultimos_6_meses' | 'ultimos_12_meses' | 'anio_actual' | 'anio_anterior'`
- `RANGOS_EVOLUCION: RangoOption[]` — labels: "Últimos 6 meses", "Últimos 12 meses", "Año actual", "Año anterior".
- `EvolucionMensual` gana `sinMovimientos: boolean` (campo requerido; la copia Deno de la Edge Function `generate-financial-report` tiene sus propios tipos y no compila contra `src/` → no rompe).
- `computeEvolucionRange(rango: RangoEvolucion, now = new Date()): { desde: string; hasta: string; meses: string[] }`
  - `ultimos_6_meses`: `[1° del mes −5, fin mes actual]`, 6 `YYYY-MM`.
  - `ultimos_12_meses`: `[1° del mes −11, fin mes actual]`, 12.
  - `anio_actual`: `[YYYY-01-01, fin mes actual]`, `meses` = ene…mes actual (AC5, AC-E1).
  - `anio_anterior`: `[(YYYY-1)-01-01, (YYYY-1)-12-31]`, 12 meses ene…dic.

---

## 5. Arquitectura del feature

### Diagrama de flujo

```
Admin/Secretaria
  → <app-admin|secretaria-contabilidad-reportes>  (Smart, inject ReportesContablesFacade)
       ├─ [filtros]=facade.filtros()                     ┐ grupo "general"
       ├─ (aplicarFiltros)=facade.aplicarFiltros($e)     ┘  → KPIs + Categorías + Rentabilidad + Gastos Fijos
       ├─ [rangoEvolucion]=facade.rangoEvolucion()       ┐ grupo "evolución"
       ├─ (aplicarRangoEvolucion)=facade.aplicarRangoEvolucion($e) ┘ → solo _evolucionSerie
       ├─ [evolucionMensual]=facade.evolucionMensual()
       └─ <app-reportes-contables-content>  (Dumb)
             ├─ activeTab (signal local)
             ├─ p-select:  activeTab()==='evolucion' ? RANGOS_EVOLUCION/localRangoEvolucion
             │                                        : RANGOS_REPORTE/localRango
             ├─ onRangoChange → emite aplicarFiltros            (grupo general)
             ├─ onRangoEvolucionChange → emite aplicarRangoEvolucion (grupo evolución)
             └─ <app-evolucion-mensual-chart [datos]=evolucionMensual()>
                   └─ por mes: barras ingresos/gastos + (si sinMovimientos) nota "sin movimientos"

Facade:
  _filtros            → fetchReporte()  (Promise.all: payments/singulars/expenses/fixed/classCounts/serie)
  _rangoEvolucion     → evolucionSerieRange() = computeEvolucionRange(_rangoEvolucion())
  aplicarRangoEvolucion(r): _rangoEvolucion.set(r) → refreshEvolucionSerie()  [guard propio]
                            (NO toca _filtros, _reporte, _isLoading)
  fetchReporte() sigue recomputando la serie con la MISMA ventana de _rangoEvolucion()
```

### Capas tocadas
- **Smart**: `features/admin/contabilidad-reportes/…`, `features/secretaria/contabilidad-reportes/…` (solo 2 bindings c/u).
- **Dumb**: `shared/components/reportes-contables-content/…`, `shared/components/evolucion-mensual-chart/…`.
- **Facade**: `core/facades/reportes-contables.facade.ts`.
- **Puro**: `core/models/ui/reportes-contables.model.ts`, `core/utils/reportes-contables.utils.ts`.
- **Migration**: ninguna.

---

## 6. Restricciones aplicables

- [x] `architecture.md` — OnPush ya está; Smart/Dumb: el content sigue siendo Dumb (solo inputs/outputs + Gsap transversal). Nuevo estado va como signal, nada de RxJS suelto.
- [x] `facades.md` — Núcleo funcional: la lógica de ventanas es fn pura en utils/model. Nuevo `createRequestGuard()` para la re-carga de la serie (§7, respuestas fuera de orden con el admin cambiando de opción rápido o solapándose con `aplicarFiltros`). El `effect()` de reactividad sigue en el Smart, no en el Facade.
- [x] `models.md` — `RangoEvolucion` y `RANGOS_EVOLUCION` en `models/ui/`. `EvolucionMensual` se **extiende** (campo nuevo), no se clona.
- [x] `visual-system.md` — nota "sin movimientos" con `var(--text-muted)` / `.micro-label` (o menor), **sin emojis**, sin colores hardcodeados. Respetar `.bento-fill` / app-like (el chart ya vive en la celda fill). GSAP: no se toca el stagger (corre una vez, `ngAfterViewInit`).
- [x] `swr-pattern.md` — `aplicarRangoEvolucion` refresca en silencio (sin skeleton) si ya hay datos; primera vez cae al flujo de `initialize()`. Nunca skeleton si `_evolucionSerie()` ya tiene valor.
- [ ] `notifications.md` — no aplica (sin toasts).
- [x] `testing-tdd.md` — `.spec.ts` primero para `computeEvolucionRange`, `computeEvolucionMensual`, el Facade y los 2 Dumb con lógica (`computed`).
- [x] `ai-readability.md` — el `p-select` mantiene/actualiza su `data-llm-description` para reflejar que en Evolución las opciones son ventanas de meses.

---

## 7. Plan de testing

- **Unitarios puros** (`computeEvolucionRange`, `computeEvolucionMensual` con `meses`): todos los AC de rango y de zero-fill/`sinMovimientos`, incluidos AC-E1 (enero), AC-E3 (todo en cero), AC-E4 (solo ingresos / solo gastos).
- **Facade** (`reportes-contables.facade.spec.ts`): default del rango; aislamiento entre grupos (AC8/AC10); guard de orden; que `fetchReporte()` general use la ventana de evolución vigente.
- **Dumb content**: opciones del select por tab (AC1/AC2), ruteo del output correcto, preservación de ambos rangos al cambiar de tab (AC8), label y chip.
- **Dumb chart**: nota "sin movimientos" condicional (AC7), N columnas.
- **QA manual `/verify`** (Playwright, `ng serve`): 
  - AC-E2: 6 barras y 12 barras en el ancho real del panel, claro/oscuro, desktop + móvil; confirmar que 12 no rompen app-like (scroll interno del chart si hace falta, nunca scroll del documento).
  - Nota "sin movimientos" legible y discreta.
  - Cambiar entre tabs y verificar que Categorías conserva su rango y Evolución el suyo.
  - `Año actual` en la fecha real (sep 2026) → ene…sep; `Año anterior` → 12 barras 2025.

---

## 8. Riesgos y mitigaciones

| Riesgo | Prob. | Mitigación |
|--------|-------|------------|
| Re-acoplar Evolución a un filtro después de que fix-242-m lo desacopló a propósito | Media | Las 4 opciones nuevas son **siempre multi-mes** (mínimo 6, o 1 solo en enero para "año actual"); nunca un único mes arbitrario. Comentario en código citando fix-242-m explicando por qué esta vez sí. |
| Respuestas de red fuera de orden entre `aplicarRangoEvolucion` y `aplicarFiltros` (ambas repueblan `_evolucionSerie`) | Media | `createRequestGuard()` dedicado para la serie; `next()` al inicio de `refreshEvolucionSerie()`/`fetchEvolucionSerie()`, `isCurrent()` justo antes del `.set()`. |
| 12 barras no entran en el ancho del panel con drawer abierto | Media | `.chart-scroll` ya scrollea en X; además comprimir `gap`/`min-width`. Validación final con `/verify`, no a ojo (precedente spec 0030/0031). |
| `EvolucionMensual.sinMovimientos` requerido rompe algún constructor del tipo | Baja | Solo se construye en `computeEvolucionMensual` (ambos caminos lo setean) y en fixtures de test (se actualizan). La copia Deno de la Edge Function no compila contra `src/`. |
| `ReporteContable.evolucionMensual` de `buildReporte()` queda con el campo nuevo sin `meses` | Baja | El camino sin `meses` también setea `sinMovimientos`; ese campo de `ReporteContable` ya está muerto desde fix-242-m (el facade expone `_evolucionSerie`, no `_reporte().evolucionMensual`). No se rompe nada. |
| El chip de fechas del header en Evolución muestra la ventana de la serie y confunde vs los KPIs (que son del rango general) | Baja | Es deseable: en Evolución el usuario mira la serie. Los KPIs del header sí quedan "del rango general" — se acepta (AC10). Si molesta en `/verify`, ocultar el chip/badge en la tab Evolución (decisión de UX, anotarla). |

---

## 9. Orden de implementación

1. `reportes-contables.model.ts`: `RangoEvolucion`, `RANGOS_EVOLUCION`, `EvolucionMensual.sinMovimientos`, `computeEvolucionRange` **+ su .spec** (TDD).
2. `reportes-contables.utils.ts`: overload `computeEvolucionMensual(..., meses?)` **+ .spec**.
3. `reportes-contables.facade.ts`: `_rangoEvolucion` + guard + `aplicarRangoEvolucion` + `refreshEvolucionSerie` + `evolucionSerieRange` reescrito **+ .spec**.
4. `evolucion-mensual-chart.component.ts`: nota "sin movimientos" + densidad 12 col **+ .spec**.
5. `reportes-contables-content.component.ts`: input/output nuevos, select tab-aware, label/chip **+ .spec**.
6. Wiring en los 2 Smart.
7. `npm run test:ci` + `npm run lint:arch` + `/verify`.
8. `/spec-verify` → `acceptance.md`.

---

## 10. Estimación

**M** — 7 archivos de producción (2 puros, 1 facade, 2 dumb, 2 smart) + 5 spec files. Sin
migración, sin facade nuevo, sin dominio nuevo. Decisiones de negocio ya cerradas con el owner.
~1–2 días con TDD y `/verify`.

---

## Changelog

- 2026-09-09 — plan inicial. Talla M. Pendiente de aprobación → `/spec-tasks`.

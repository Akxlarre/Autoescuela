---
# Fix: App-like — familia "pagos" (`admin` + `secretaria`)
> id: fix-132-m-app-like-familia-pagos
> refs: ASG-b-076
> status: done
> closed: 2026-08-06
> created: 2026-08-06

## Root Cause

[Heredado de ASG-b-076, a confirmar]: Paso 9 del rollout app-like
(`indices/APP-LIKE-ROLLOUT.md`) — página de mayor tráfico de este lote.
`AdminPagosComponent` y `SecretariaPagosComponent` son casi duplicados línea-por-línea (no
comparten un `*-content`, son 2 archivos separados — aplicar el mismo cambio en ambos).

No son 2 tablas — son **3 bloques SIEMPRE visibles** apilados en 1 sola `.bento-banner`: (1)
Deudores (paginación hand-rolled), (2) fila 2-columnas `lg:col-span-8`/`lg:col-span-4` con
Pagos Recientes (paginada) + sidebar Métodos de Pago.

**Decisión de diseño ya tomada con el owner (2026-08-02, no re-discutir):** NO usar tabs
(Deudores/Pagos) — hoy todo es visible a la vez y esconder Pagos Recientes detrás de un click
cambiaría el flujo de trabajo real de la secretaria.

Plan original (v1, NO ejecutado — ver "Pivot de diseño" abajo):
1. Root → `bento-grid--fill-screen-2`.
2. Fila 1 = Deudores `.bento-fill`: sacar paginación hand-rolled, mismo patrón
   `LayoutService`+`mobileShown`+`sliceByBudget`+"Cargar más" que `admin-secretarias.component.ts`.
3. Fila 2 = Pagos Recientes + sidebar Métodos de Pago, AMBAS `.bento-fill` compartiendo la fila.
   Pagos Recientes: mismo tratamiento de paginación que Deudores. Sidebar: estático,
   `bento-fill flex flex-col h-full` con `overflow-y-auto` defensivo.

### Pivot de diseño (2026-08-06, durante la implementación)

El plan v1 se implementó primero tal cual (root `--fill-screen-2`, split 50/50 entre fila
Deudores y fila Pagos Recientes+Sidebar). **Verificado con Playwright (`/verify`) y descartado**:
en un laptop típico de 900px de alto, la fila de Pagos Recientes (header con buscador + 2
selects, más alto que el header de Deudores) quedaba con 220px totales — header (115px) +
footer (41px) ya consumían casi todo el espacio, dejando **0 filas de pago visibles** (ni
siquiera el header de columnas completo). Subir el peso de Deudores a 3fr/2fr no lo resolvió
(bajó aún más el espacio absoluto de Pagos Recientes). A 768px de alto la situación era peor.

**Decisión revisada con el dueño** (reemplaza la decisión "NO tabs" de 2026-08-02 citada arriba,
que asumía que un split de filas visible SIEMPRE tendría espacio suficiente — la evidencia
concreta de `/verify` mostró que no): Deudores pasa a ser el **único bloque de contenido**,
ocupando todo el alto disponible (`bento-grid--fill-screen`, una sola fila fill). Pagos
Recientes + Métodos de Pago se movieron a un **drawer** (`PagosRecientesDrawerComponent`,
`src/app/features/admin/pagos/pagos-recientes-drawer.component.ts`, compartido entre ambos
portales igual que `RegistrarPagoDrawerComponent`/`AdminPagoDetalleDrawerComponent`), abierto
con un botón nuevo "Pagos Recientes" en el hero. El drawer tiene scroll nativo — sin el límite
de alto del bento-fill, por lo que las filas de pago SÍ son visibles siempre.

Ajuste adicional (mismo día, pedido explícito): Deudores usa **paginador real (10/página,
Anterior/Siguiente + "Mostrando X-Y de N")** en desktop — mismo patrón que la tabla PrimeNG de
`alumnos-list-content.component.ts` ("Base Alumnos B") — en vez de scroll interno sin límite.
Mobile/tablet mantiene el patrón `sliceByBudget`+"Cargar más".

## ACs Afectados

Ninguno de una spec formal — este fix implementa el rollout app-like descrito en
`indices/APP-LIKE-ROLLOUT.md` (filas `/admin/pagos` y `/secretaria/pagos`), sin AC previos
propios más allá del checklist de cierre de la Asignación.

## Cambio

- **`src/app/features/admin/pagos/admin-pagos.component.ts`** y
  **`src/app/features/secretaria/pagos/secretaria-pagos.component.ts`**: root →
  `bento-grid--fill-screen` (una sola fila). Único bloque de contenido: Deudores
  (`bento-banner bento-fill`), con paginador real (10/página) en desktop y
  `sliceByBudget`+"Cargar más" en mobile/tablet. Nuevo botón de hero
  `view-pagos-recientes` que abre `PagosRecientesDrawerComponent`. Se removieron los
  computed/signals de Pagos Recientes (búsqueda, filtros, densidad) — se movieron al drawer.
- **`src/app/features/admin/pagos/pagos-recientes-drawer.component.ts`** (nuevo): drawer
  compartido con Métodos de Pago del mes + buscador/filtros + lista de Pagos Recientes
  (scroll nativo, sin límite de filas — no necesita `sliceByBudget`).
- Tests: `admin-pagos.component.spec.ts`, `secretaria-pagos.component.spec.ts` (densidad de
  Deudores: paginador desktop + `sliceByBudget` mobile/tablet, y hero action del drawer),
  `pagos-recientes-drawer.component.spec.ts` (nuevo, filtros de búsqueda/estado/método).

## Test de Regresión

- `npm run test:ci`: 1815 passed / 9 failed (preexistentes, `flota.facade.spec.ts` — no
  relacionados, ver `project_test_baseline_jun2026` en memoria) / 5 skipped.
- `npm run lint:arch`: 0 errores, 171 advertencias (preexistentes).
- `/verify` (Playwright): ambas rutas, 1440×900, 1440×768, 1280×800, 390×844, modo oscuro,
  drawer abierto (force-compact) — consola limpia, sin 4xx, sin overflow horizontal, doc no
  scrollea en desktop, drawer de Pagos Recientes con filas visibles en todos los tamaños.

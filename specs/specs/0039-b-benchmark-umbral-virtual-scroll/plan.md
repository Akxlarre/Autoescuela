# Plan técnico 0039-b — Benchmark empírico del umbral de virtual scroll

> **Spec:** [spec.md](./spec.md)
> **Status:** aprobado — 2026-09-01

---

## Decisión de método (resuelta con el owner)

**Datos sintéticos en memoria**, no siembra en base de datos.

Motivo: el umbral de §4 de la investigación es sobre el **costo de render de `@for` + OnPush**, no
sobre la query. Inyectar N filas en el `input()` del Dumb aísla exactamente esa variable. Además
evita el riesgo real que traía la alternativa: el único proyecto Supabase configurado
(`src/environments/environment.ts`) tiene `production: true` y es contra el que corre la UAT con el
cliente — sembrar 1.000 filas sintéticas ahí contamina datos que el cliente está validando.

Descartado también el camino vitest: `vitest.config.ts` usa `happy-dom` y **excluye tests de
template Angular** (falta `@analogjs/vite-plugin-angular`). Aunque montara, los tiempos de
`happy-dom` no representan layout/paint de un navegador real.

## Superficie a medir: una sola

Ver `spec.md` §1.2 para la evidencia. Resumen:

| Superficie | Estado | Acción |
|---|---|---|
| `ex-alumnos-content` | `p-table [paginator] [rows]=10` → DOM ≤ 10 | **No medir** — documentar como fuera de riesgo (AC6) |
| `ex-alumnos-profesional-content` | idem | **No medir** — idem |
| `servicios-especiales-content` (historial) | `@for` sin techo, **×2** (tabla + tarjetas coexisten por CSS) | **Medir** |

## Harness

`src/app/features/_bench-0039/bench-servicios.component.ts` + ruta `bench-0039` en
`app.routes.ts`. Monta el Dumb real con catálogo/KPIs sintéticos y expone
`globalThis.__bench0039.seed(n)` para cambiar el volumen desde la consola sin recompilar.

Las ventas se reparten en **5 años hacia atrás**, así "Todo el historial" muestra N y la ventana
por defecto de 12 meses muestra ≈ N/5 — que es justo la comparación que pide AC-E3.

⚠️ **AC5: el harness se borra antes de cerrar el track** (componente + ruta).

## Qué se mide

1. **Re-render al cambiar el filtro por tipo de servicio** con "Todo el historial" activo (AC-E2).
   Es la interacción que invalida `ventasFiltradas()` y fuerza a Angular a reconstruir ambas
   listas. La carga inicial no sirve: incluye bootstrap del framework.
2. **Conteo real de nodos** creados, contando la vista oculta (AC-E1).
3. La misma medición con la ventana por defecto de 12 meses, para cuantificar el margen que ya da
   `0038-b` (AC-E3).

Barrido de volúmenes: **100 → 300 → 600 → 1.000 → 2.000**. El 300 está incluido a propósito: es el
umbral que hay que confirmar o refutar.

## Criterio de decisión (AC3/AC4)

- Re-render **< 200 ms** en el peor caso → **no se implementa nada**, se documenta y se cierra.
- Re-render **≥ 200 ms** → se implementa: migrar el `<table>` hand-rolled a `p-table` (prerequisito
  de `[virtualScroll]`) y activar sobre `LIST_VIRTUAL_SCROLL_THRESHOLD` en
  `core/utils/layout-tier.utils.ts`.

200 ms es la frontera de "needs improvement" de INP, no un número inventado para este track.

## Insumos ya verificados (2026-09-01) — no volver a descubrir

- **Función pura del período:** `core/utils/period-window.utils.ts` (`applyPeriodWindow`).
- **Modelo:** `core/models/ui/servicios-especiales.model.ts` (`VentaServicio`, `ServicioEspecial`,
  `ServiciosEspecialesKpis`).
- **Precedente de seed local** (no usado, pero es el patrón si alguna vez se siembra en BD):
  `supabase/scripts/seed_dev_alumnos_clase_b.sql` — idempotente, con identificadores de seed
  explícitos.

## Corrección a "Archivos involucrados" de la asignación

`ASG-b-088` declara `features/admin/alumnos/ex-alumnos/admin-ex-alumnos.component.ts`. Path
obsoleto: `0007-i` (2026-08-31) consolidó ex-alumnos Clase B en
`shared/components/ex-alumnos-content/`. Y esa superficie además quedó **fuera de alcance** por el
paginador, así que los archivos reales del track son el harness + (solo si se implementa)
`servicios-especiales-content.component.ts` y `layout-tier.utils.ts`.

## Riesgos

1. **Representatividad del hardware.** La asignación pide "no una laptop de dev". Sin máquina de
   oficina disponible, se mide con **CPU throttling declarado** y se reporta como tal. Nunca
   presentar el número sin throttle como si fuera el de la secretaria.
2. **MCP de Playwright caído** en esta sesión (`CONNECT_TIMEOUT`). Se usa el Browser pane
   (`javascript_tool` + `performance`), que alcanza para esta medición.
3. **El harness mide el Dumb aislado**, sin el shell de la app (sidebar, topbar, drawers). Eso
   *subestima* levemente el costo real de change detection. Se declara en el acceptance.

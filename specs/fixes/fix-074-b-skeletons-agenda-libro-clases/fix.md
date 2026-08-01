# Fix: H-007 — skeletons faltantes en Agenda y Libro de Clases
> id: fix-074-b-skeletons-agenda-libro-clases
> refs: ASG-b-022
> status: done
> closed: 2026-07-31
> created: 2026-07-31

## Root Cause

**Diagnóstico original (heredado de ASG-b-022, auditoría 2026-07-21) ya no aplica tal cual.**
Ambas páginas fueron tocadas el 2026-07-22 (commits `b0223fd "agenda ready"` y
`fix(libro-clases): consolidar subnav adaptativo, ID de promoción y skeletons fieles`) — un día
después del hallazgo — y ya incorporan skeletons. Se re-verificó con Playwright real (polling del
DOM cada 60-100ms durante la carga, no solo lectura de código) antes de tocar nada:

- **`/app/admin/agenda`**: `AgendaFacade.initialize()` ya setea `_isLoading.set(true)`
  **síncronamente antes de cualquier `await`** (comentario propio: "evitar salto visual: Empty
  State -> Skeleton -> Contenido") y `app-agenda-semanal` ya resuelve el skeleton internamente
  (`@if (isLoading())`, 66 `app-skeleton-block`). Verificado con 60+ muestras de polling: el
  skeleton cubre el 100% de la ventana de carga, sin flash del empty-state ni `<main>` vacío.
  **No era bug — cerrado sin cambios**, igual que agenda/hero en `fix-071-b`.
- **`/app/admin/libro-de-clases`** (ruta consolidada de `LibroDeClasesComponent`, ya NO existe
  `admin-libro-de-clases.component.ts` — se fusionó admin+secretaria en fix-052-m): el polling
  **sí encontró un gap real**, ~500-900ms con `<main>` completamente vacío (0 texto, 0
  `app-skeleton-block`, ni siquiera el empty-state). Causa raíz: `LibroDeClasesFacade.initialize()`
  encadena `loadPromociones() → selectPromocion() → selectCurso()` (auto-selección de la promoción
  y curso activos) **dentro** del mismo `await` que sostiene `_isLoading`. `selectCurso()` prende y
  apaga `_isLoadingSections` en ese medio. El template gateaba el skeleton de "secciones"
  únicamente con `@if (facade.isLoadingSections())`, independiente del `@if (facade.isLoading())`
  de los filtros — dejando un tick donde ambos flags podían estar en `false` simultáneamente antes
  de que `hasDatos()` fuera `true`, sin que ningún bloque cubriera ese instante.

## ACs Afectados
Ninguno — fix autónomo, sin AC de spec previa.

## Cambio
- **Archivo:** `src/app/features/libro-de-clases/libro-de-clases.component.ts` — el skeleton de
  "secciones" ahora se muestra con `@if (facade.isLoading() || facade.isLoadingSections())` en vez
  de solo `isLoadingSections()`, cubriendo la unión de ambas fases de carga del bootstrap inicial.
  Un solo archivo tocado, causa raíz única.
- `src/app/features/admin/agenda/admin-agenda.component.ts` y `agenda-semanal.component.ts`: **sin
  cambios** — ya cumplían el canon.

## Test de Regresión
⚠️ Este proyecto no tiene tests de componentes Angular (`vitest.config` los excluye).
- **Verificación real (Playwright, no solo lectura de código):** click SPA en el link del sidebar
  + polling del DOM (`document.querySelector('main').innerText.length` y conteo de
  `app-skeleton-block`) cada 60-100ms durante ~9s de carga en frío.
  - Agenda: 0 muestras con `<main>` vacío en toda la ventana (antes y después, sin cambios).
  - Libro de Clases: **antes** del fix, muestras con `textLen:0 && skeletonCount:0` alrededor de
    t≈3.5-4.2s. **Después** del fix, 112 muestras (60ms de paso, ~9.5s), cero muestras vacías;
    contenido real llega igual al final (`textLen:495`, card "Cabecera" con datos reales).
- `npm run lint:arch` → exit 0, sin errores nuevos (solo warnings preexistentes de otros archivos).
- `ng build` → en curso.

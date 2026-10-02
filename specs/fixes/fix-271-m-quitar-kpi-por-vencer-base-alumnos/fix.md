# Fix: El KPI "Por Vencer" de la Base de Alumnos siempre vale 0 — se quita
> id: fix-271-m-quitar-kpi-por-vencer-base-alumnos
> refs: fix-264-m (bug B9, casos D05 / N02 de `024a`), ASG-i-024
> status: done
> closed: 2026-10-01
> created: 2026-10-01

## Root Cause

El KPI "Por Vencer" cuenta alumnos cuya matrícula representativa tiene `expires_at` dentro de los
próximos 7 días. Pero `expires_at` solo existe en borradores (`chk_expires_at_draft_only`, y
`confirm_enrollment_with_payment` lo pone en `NULL` al confirmar), y la lista excluye los
borradores (fix-066). Ninguna fila de la lista puede tener `expires_at`: el KPI vale 0 por
construcción y su drawer ("Alumnos con Cuotas por Vencer") siempre está vacío. El botón
"Contactar" del drawer además no hace nada.

Confirmado por `fix-264-m` (B9, sospecha S4 de `024a`).

**Decisión del owner (Matías, 2026-10-01):** se quita el KPI y su drawer. No se redefine qué
debería medir.

## ACs Afectados

- AC-1: la Base de Alumnos B (admin y secretaria) muestra 3 KPIs: Total Alumnos, Activos y Con
  deuda. "Por Vencer" ya no aparece.
- AC-2: no queda código muerto del KPI: ni el drawer, ni el `computed` del facade, ni los campos
  `expiresAt` / `vencimiento` del modelo de fila.

## Cambio

- **Archivo:** `src/app/shared/components/alumnos-list-content/alumnos-list-content.component.ts`
- **Qué cambia:** se quita el KPI `por-vencer`, el input `alumnosPorVencer`, `openPorVencerDrawer()`
  y el manejo de `(kpiClick)`.
- **Archivo:** `src/app/shared/components/alumnos-por-vencer-drawer/` — se elimina el componente.
- **Archivo:** `src/app/core/facades/admin-alumnos.facade.ts`
- **Qué cambia:** se quitan `alumnosPorVencer`, `isWithinThreshold()`, `formatVencimiento()`,
  `VENCER_THRESHOLD_DAYS` y `expires_at` del `select`.
- **Archivo:** `src/app/core/models/ui/alumno-table-row.model.ts` — se quitan `expiresAt` y
  `vencimiento`.
- **Archivo:** `src/app/features/{admin,secretaria}/alumnos/*.component.ts` — dejan de pasar
  `[alumnosPorVencer]`.
- **Archivo:** `scripts/lib/shared-organisms.allowlist.json` — se quita la entrada del drawer.
- **Archivo:** `src/app/features/admin/alumnos/ex-alumnos/components/stats/admin-ex-alumnos-tasas-drawer.component.ts`
  — solo el comentario, que nombraba al drawer eliminado.
- **Índices:** `COMPONENTS.md`, `USAGE-MAP.md`.

## Test de Regresión

- `e2e/alumnos-b-lista.spec.ts > A01 · D01 · D02 · G01` — comprueba que "Por Vencer" no está en
  el hero.
- `npx tsc --noEmit -p tsconfig.app.json` sin errores (sin referencias colgantes).

No se agrega un `.spec.ts` del componente: el cambio quita código, no agrega una decisión.

## Verificación
Verificado el 2026-10-01: `tsc` de la app sin errores, los 36 tests de
`admin-alumnos.facade.spec.ts` en verde y los tests E2E A01 y A02 pasan en navegador (admin y
secretaria, sin "Por Vencer" y sin errores de consola).

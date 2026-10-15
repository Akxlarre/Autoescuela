# Fix: el ejecutivo muestra los números viejos sin aviso mientras recarga
> id: fix-427-m-ejecutivo-sin-indicador-al-recargar
> refs: fix-395-m-testing-dashboards (caso J03, decisión de Matías 2026-10-14) · fix-426-m
> status: done
> closed: 2026-10-14
> created: 2026-10-14

## Síntoma

Al cambiar de sede (o de período) en el dashboard ejecutivo, durante 1 a 2,5 s la línea de contexto
ya dice la sede o el período nuevo pero los KPIs siguen con los números anteriores, sin ninguna
señal de que se están actualizando. Con `fix-426-m` se suma otro desfase: al elegir "Este año", las
tarjetas cambian de rótulo ("vs año anterior") antes de que lleguen los números del año.

## Root Cause

Con datos en pantalla, `ExecutiveDashboardFacade.reload()` recarga en silencio (SWR, AC23) y no
expone que hay una carga en curso. Las tarjetas se arman con `preset()`, que cambia al elegir el
período, no cuando llegan sus datos.

## Fix

Decisión de Matías: mostrar un indicador de carga.

- El facade expone `isRefreshing` (recarga en curso con datos ya visibles; la apaga solo la carga
  vigente) y `dataPreset` (el preset de los datos que se están mostrando).
- El dashboard atenúa los KPIs (tarjetas y tira del hero), marca la zona `aria-busy` y muestra
  "Actualizando…" con el spinner junto al filtro de período mientras `isRefreshing()`.
- Las tarjetas se arman con `dataPreset()`.

## Acceptance Criteria

- [x] AC1 — Con datos cargados, cambiar de sede o de período deja `isRefreshing` en `true` hasta que
  llega la respuesta vigente, y el dashboard muestra "Actualizando…" con los KPIs atenuados.
- [x] AC2 — Una respuesta vieja que llega después no apaga el indicador de la vigente.
- [x] AC3 — `dataPreset` cambia recién cuando llegan los datos del período nuevo.

## Regression Test

- `executive-dashboard.facade.spec.ts` → `fix-427-m`

## Verificación (2026-10-14)

- Unit: 2 tests nuevos en el spec del facade (indicador y `dataPreset` durante una recarga; una
  respuesta vieja no apaga el indicador de la vigente). Specs del ejecutivo: 112/112. `tsc` sin
  errores; `lint:arch` 0 errores.
- Navegador, admin, con las respuestas de KPIs demoradas 3 s: al pasar de "Todas" a "Conductores
  Chillán" aparece "Actualizando…" con el spinner junto a "Indicadores del período", las tarjetas
  quedan al 60 % de opacidad y con `aria-busy="true"`; al llegar los datos vuelven a 1 y el aviso
  desaparece.

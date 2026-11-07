# Fix: Auditoría — filtros fantasma al volver y respuestas fuera de orden
> id: fix-486-m-auditoria-filtros-fantasma
> refs: ASG-i-036
> status: done
> closed: 2026-11-07
> created: 2026-11-07

## Root Cause

Los filtros de Auditoría viven en dos lugares: los signals del componente (se pierden al salir
de la pantalla) y `_filters` del `AuditoriaFacade` (singleton, sobreviven). Al volver, la tabla
seguía filtrada pero los controles mostraban "todos", y desaparecía "Limpiar filtros" (S8 de
`fix-485-m`, caso E13: 33.379 registros con los controles vacíos). Al cambiar de sede tampoco se
limpiaban: el filtro de una secretaria de la sede A dejaba la tabla vacía en la B (E14).

Además `fetchLogs()` no tenía guard de respuesta vieja: cambiar filtros o página rápido podía
dejar la tabla con el resultado de una consulta anterior (S13, E18). Y la re-entrada SWR mostraba
el skeleton otra vez (B09).

Por la regla de filtros de lista (se conservan solo al volver del detalle), y como el detalle de
Auditoría es un drawer dentro de la misma pantalla, los filtros se limpian siempre al entrar.

## ACs Afectados

- Ninguno de spec — hallazgos S8/S13/B09 del testing `fix-485-m`.

## Cambio

- **`core/facades/auditoria.facade.ts`:** `resetFilters()` (limpia filtros y página sin
  consultar); `createRequestGuard()` en `fetchLogs()`; la re-entrada SWR refresca sin skeleton.
- **`features/admin/auditoria/admin-auditoria.component.ts`:** el effect de entrada y cambio de
  sede limpia los controles y los filtros del facade antes de `initialize()`.

## Test de Regresión

- `core/facades/auditoria.facade.spec.ts > fix-486-m` ✓
- `features/admin/auditoria/admin-auditoria.component.spec.ts > fix-486-m` ✓

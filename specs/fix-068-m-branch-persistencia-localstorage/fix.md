# Fix: H-026 — la sede activa no persiste tras F5
> id: fix-068-m-branch-persistencia-localstorage
> refs: ASG-b-026
> status: done
> closed: 2026-07-26
> created: 2026-07-26

## Root Cause

[Heredado de ASG-b-026, a confirmar]: Como admin, si se cambia el selector de sede a una específica (ej. "Conductores Chillán") y luego se recarga la página completa (F5), el selector vuelve a "Todas las sedes" sin aviso. La navegación normal dentro de la app (clic en links del sidebar) SÍ preserva la sede correctamente — el problema es específico de una recarga completa del navegador. `BranchFacade.selectedBranchId` vive solo en memoria (signal), no en `localStorage` ni query param.

## ACs Afectados

- Ninguno — fix autónomo (originado de Asignación ASG-b-026, no de una spec previa).

## Cambio

- **Alcance sugerido:** Persistir `selectedBranchId` en `localStorage` (o como query param en la URL, evaluar cuál encaja mejor con el resto de la app) y restaurarlo al iniciar `BranchFacade`.
- Verificar que la restauración respete los permisos del usuario (una secretaria no debería poder "restaurar" una sede que no es la suya, aunque en la práctica su sede está fija por su propio perfil).
- **Archivo principal:** `src/app/core/facades/branch.facade.ts`

## Test de Regresión

- Como admin, cambiar el selector de sede a una específica, recargar con F5, y verificar que la sede seleccionada persiste (no vuelve a "Todas las sedes").
- ✓ Cubierto con tests unitarios en `branch.facade.spec.ts` (simula F5 seteando `localStorage` directamente y volviendo a llamar `loadBranches()`):
  - `selectBranch()` persiste el id elegido en `localStorage`.
  - `selectBranch(null)` y `reset()` limpian la persistencia.
  - `loadBranches()` restaura la sede persistida si sigue existiendo entre las sedes cargadas.
  - `loadBranches()` ignora y limpia un id persistido que ya no existe (sede eliminada / storage manipulado).
  - 24/24 tests del facade en verde; suite completa (`npm run test:ci`) 1444/1444 en verde.

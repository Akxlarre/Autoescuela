# Fix: Selector de sede muestra fallback "Sede" mientras carga tras F5, en vez del nombre real
> id: fix-069-m-branch-selector-skeleton-carga
> refs: fix-068-m-branch-persistencia-localstorage, hotfix-053-m-branch-flash-inicial-al-restaurar
> status: done
> closed: 2026-07-27
> created: 2026-07-27

## Root Cause

Consecuencia directa de fix-068/hotfix-053 (persistencia de sede en `localStorage`): `BranchFacade.selectedBranchId()` arranca con el id persistido de forma optimista, ANTES de que `branches()` termine de cargar desde la BD. `BranchSelectorComponent.selectedLabel` resuelve el nombre buscando ese id en `branches()`; mientras la lista sigue vacía, el `.find()` no encuentra nada y cae al fallback `?? 'Sede'` (pensado originalmente para "sede eliminada", no para "aún cargando"). Resultado: un flash del texto literal "Sede" hasta que `loadBranches()` resuelve.

**Intento fallido (revertido):** un primer intento agregó un `<app-skeleton-block>` en `branch-selector.component.ts` mientras `BranchFacade.isLoading()` es `true`. Se revirtió porque el tamaño del skeleton (ancho/alto fijos) nunca coincide con el pill real, cuyo tamaño varía según el largo del nombre de la sede — con "Todas las sedes" quedaba parecido, pero con nombres largos como "Conductores Chillán" la diferencia de tamaño se notaba aún más.

**Causa raíz real y solución:** el problema no es "falta un placeholder de carga", es que `branches()` está vacío cuando debería tener al menos la sede que ya sabemos que está seleccionada (su id Y nombre viven en `localStorage`). La solución es sembrar `BranchFacade._branches` con un "stub" `{id, name}` leído síncronamente de `localStorage` al construirse — así el nombre real se pinta desde el primer frame, sin fallback, sin skeleton, sin flash de ningún tipo. `loadBranches()` reemplaza el stub por la lista real una vez resuelto el fetch.

## ACs Afectados

- Ninguno — fix autónomo, encadenado a fix-068/hotfix-053 (no proviene de una spec).

## Cambio

- **Archivo:** `src/app/core/facades/branch.facade.ts`
  - El valor persistido en `localStorage` pasa de un id numérico plano a JSON `{id, name}` (`persistSelectedBranch()`).
  - Nuevo método `seedBranchesFromPersisted()`: siembra `_branches` con `[{id, name, slug:'', hasProfessional:false}]` a partir de lo persistido, de forma síncrona al construir el Facade.
  - `readPersistedBranch()` reemplaza a `readPersistedBranchId()`: parsea el JSON y descarta silenciosamente valores en el formato legacy (id plano) o corruptos.
  - `validatePersistedBranch()` reemplaza a `restorePersistedBranch()`: ahora solo se encarga de invalidar (limpiar selección + storage) si el id persistido ya no existe en la lista real cargada — el "restaurar" ya no hace falta porque el id y el stub ya se sembraron en la construcción.
- **Archivos revertidos a su estado original** (el intento de skeleton no sirvió): `src/app/shared/components/branch-selector/branch-selector.component.ts` (se quitó el input `loading` y el bloque skeleton) y `src/app/layout/topbar.component.ts` (se quitó `[loading]="branchFacade.isLoading()"`). Se eliminó `branch-selector.component.spec.ts` (probaba el input `loading` que ya no existe).

## Test de Regresión

- `branch.facade.spec.ts`: 26/26 tests en verde, incluyendo:
  - `selectBranch()` persiste `{id, name}` (no solo el id).
  - Un valor legacy (id plano, sin JSON) se ignora sin romper.
  - `branches()` queda sembrado con el stub `{id, name}` correcto de forma síncrona al construirse, y `selectedBranchLabel()` ya devuelve el nombre real en ese mismo instante (sin esperar `loadBranches()`).
  - `loadBranches()` mantiene la sede si sigue existiendo, o la invalida (limpia selección + storage) si ya no existe.
- Suite completa (`npm run test:ci`): 1446/1446 en verde.
- `npm run lint:arch`: sin issues nuevos (exit 0).
- **Verificación visual con Playwright MCP en `ng serve` real** (no solo tests unitarios): se seleccionó "Conductores Chillán" en el topbar, se confirmó la persistencia como `{"id":2,"name":"Conductores Chillán"}` en `localStorage`, y se recargó la página (F5) dos veces. En ambos casos el pill mostró "Conductores Chillán" **desde el primer screenshot tomado**, con el mismo tamaño que el pill ya cargado — sin flash de "Todas las sedes", sin fallback "Sede", sin skeleton. Sin errores en consola.

# Fix: Doble confirmación nativa al eliminar ingreso en Caja Diaria + falta cursor:pointer en botones eliminar
> id: fix-200-m-caja-diaria-doble-confirm-eliminar
> refs: —
> status: done
> closed: 2026-08-24
> created: 2026-08-24

## Root Cause
`CuadraturaContentComponent.onEliminarIngreso()` (Dumb, `shared/components/cuadratura-content`)
llamaba a `window.confirm()` nativo antes de emitir el output `eliminarIngreso`. Ambos Smart
parents que lo consumen (`AdminContabilidadCuadraturaComponent` y
`SecretariaContabilidadCuadraturaComponent`) YA escuchan ese output y muestran su propio
`ConfirmModalService.confirm()` (modal de la app, `surface-glass`) antes de llamar a
`facade.eliminarIngreso()`. Resultado: dos confirmaciones seguidas, la primera con el diálogo
feo del navegador (`localhost:4200 says`). Además los 3 botones de basurero (ingreso desktop,
ingreso mobile, egreso) no tenían `cursor-pointer`.

## ACs Afectados
Ninguno — fix autónomo.

## Cambio
- **Archivo:** `src/app/shared/components/cuadratura-content/cuadratura-content.component.ts`
- **Qué cambia:**
  1. `onEliminarIngreso()` deja de llamar `window.confirm()` — emite el output directamente,
     igual que `onEliminarEgreso()` ya hacía. La confirmación queda centralizada en el Smart
     parent vía `ConfirmModalService`.
  2. Se agrega `cursor-pointer` a los 3 botones de eliminar (ingreso desktop, ingreso mobile,
     egreso).

## Test de Regresión
- Manual: en Caja Diaria (admin y secretaria), click en basurero de un ingreso → aparece
  **solo** el modal de la app (no el diálogo nativo del navegador) → confirmar elimina.
- Manual: hover sobre los 3 botones de basurero → cursor `pointer`.

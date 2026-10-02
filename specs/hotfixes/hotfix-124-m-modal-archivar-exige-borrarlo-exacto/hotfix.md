# Hotfix: El modal de archivar acepta "BORRARLO" en mayúsculas
> id: hotfix-124-m-modal-archivar-exige-borrarlo-exacto
> refs: fix-264-m (caso L04 de `024a`), ASG-i-024
> status: done
> closed: 2026-10-01
> created: 2026-10-01

## Problema
El modal "Archivar con historial" pide escribir `borrarlo` para habilitar el botón, pero compara pasando el texto a minúsculas (`toLowerCase()`): "BORRARLO" o "Borrarlo" también lo habilitan.

**Decisión del owner (Matías, 2026-10-01):** debe escribirse exactamente como lo pide el modal; no se aceptan mayúsculas.

## Cambios
- **Archivo:** `src/app/core/utils/archive-confirmation.utils.ts` — función pura `isArchiveConfirmationText(text)`: `true` solo si el texto es `borrarlo` en minúsculas. Los espacios al inicio y al final se ignoran, igual que antes y que en el modal de eliminar servicio.
- **Archivo:** `src/app/shared/components/eliminar-alumno-modal/eliminar-alumno-modal.component.ts` — `canConfirm` usa esa función.
- **Archivo:** `e2e/alumnos-b-lista.spec.ts` — el test L03 comprueba que "BORRARLO" no habilita el botón.

## Verificación
Verificado el 2026-10-01: `archive-confirmation.utils.spec.ts` (9 casos) en verde, `tsc` de la app sin errores y en navegador el test `L02 · L03 · L05` pasa con el caso nuevo ("BORRARLO" deja el botón deshabilitado; "borrarlo" lo habilita). También pasan L01 y P01 · P02 (archivar desde la lista y desde la ficha).

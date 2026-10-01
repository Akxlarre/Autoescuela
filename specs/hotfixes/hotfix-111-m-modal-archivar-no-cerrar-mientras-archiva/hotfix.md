# Hotfix: El modal de archivar alumno se cierra con Escape o clic afuera mientras está archivando
> id: hotfix-111-m-modal-archivar-no-cerrar-mientras-archiva
> refs: fix-264-m (bug B6)
> status: done
> closed: 2026-10-01
> created: 2026-10-01

## Problema
Con el modal en "Archivando…", Escape o un clic en el fondo lo cierran. El archivado termina igual, pero el usuario ya no ve el resultado en el modal y la pantalla queda sin objetivo de borrado mientras la operación sigue en curso. El botón Cancelar sí se deshabilita; Escape y el fondo llaman a `onCancelar()` sin mirar `isDeleting()`.

## Cambios
- **Archivo:** `src/app/shared/components/eliminar-alumno-modal/eliminar-alumno-modal.component.ts` — `onCancelar()` no hace nada mientras `isDeleting()` es true.
- **Archivo:** `e2e/alumnos-b-lista.spec.ts` — el test L06 deja de estar marcado `knownBug`.

## Verificación
Verificado el 2026-10-01: el test E2E del caso pasa en navegador sin la marca `knownBug`, `npx vitest run` (2835 tests) y `npm run lint:arch` (0 errores) en verde.

# Hotfix: La Papelera de Alumnos queda abierta al salir de la pantalla y volver
> id: hotfix-112-m-papelera-alumnos-no-queda-pegada
> refs: fix-264-m (bug B4)
> status: done
> closed: 2026-10-01
> created: 2026-10-01

## Problema
La vista Papelera (`_trashView`) vive en `AdminAlumnosFacade`, que es un singleton, y nada la apaga al salir de la pantalla. Al volver a Alumnos por el menú se abre la Papelera en vez de la lista activa.

## Cambios
- **Archivo:** `src/app/core/facades/admin-alumnos.facade.ts` — `leaveTrashView()`: apaga la vista Papelera e invalida la caché, sin disparar una carga.
- **Archivo:** `src/app/core/facades/admin-alumnos.facade.spec.ts` — test de `leaveTrashView()`.
- **Archivo:** `src/app/features/admin/alumnos/admin-alumnos.component.ts` — llama a `leaveTrashView()` al destruirse.
- **Archivo:** `src/app/features/secretaria/alumnos/secretaria-alumnos.component.ts` — ídem.
- **Archivo:** `e2e/alumnos-b-lista.spec.ts` — el test M04 deja de estar marcado `knownBug`.

## Verificación
Verificado el 2026-10-01: el test E2E del caso pasa en navegador sin la marca `knownBug`, `npx vitest run` (2835 tests) y `npm run lint:arch` (0 errores) en verde.

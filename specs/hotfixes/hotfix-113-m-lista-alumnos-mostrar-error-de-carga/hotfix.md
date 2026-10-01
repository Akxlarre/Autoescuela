# Hotfix: Si la lista de Alumnos no carga, la pantalla dice "No se encontraron alumnos"
> id: hotfix-113-m-lista-alumnos-mostrar-error-de-carga
> refs: fix-264-m (bug B5)
> status: done
> closed: 2026-10-01
> created: 2026-10-01

## Problema
`AdminAlumnosFacade` guarda el error de carga en su signal `error`, pero ninguna pantalla lo lee. Cuando la carga falla, la lista queda vacía y se muestra el estado "No se encontraron alumnos · Limpiar filtros", como si la sede no tuviera alumnos.

## Cambios
- **Archivo:** `src/app/shared/components/alumnos-list-content/alumnos-list-content.component.ts` — input `error`; si hay error y no hay alumnos que mostrar, se muestra un estado de error con "Reintentar" (emite `refreshRequested`, que ya existía) en vez de la tabla vacía.
- **Archivo:** `src/app/features/admin/alumnos/admin-alumnos.component.ts` — pasa `[error]="facade.error()"`.
- **Archivo:** `src/app/features/secretaria/alumnos/secretaria-alumnos.component.ts` — ídem.
- **Archivo:** `e2e/alumnos-b-lista.spec.ts` — el test A08 deja de estar marcado `knownBug`.

Si ya hay alumnos en pantalla y falla un refresco en segundo plano, se siguen mostrando (regla SWR): el estado de error solo reemplaza a una lista vacía.

## Verificación
Verificado el 2026-10-01: el test E2E del caso pasa en navegador sin la marca `knownBug`, `npx vitest run` (2835 tests) y `npm run lint:arch` (0 errores) en verde.

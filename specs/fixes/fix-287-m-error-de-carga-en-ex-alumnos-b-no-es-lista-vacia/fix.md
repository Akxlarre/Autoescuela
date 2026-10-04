# Fix: Un error de carga en Ex-Alumnos B no se muestra como lista vacía
> id: fix-287-m-error-de-carga-en-ex-alumnos-b-no-es-lista-vacia
> refs: ASG-i-024
> status: done
> closed: 2026-10-03
> created: 2026-10-03

## Root Cause
Cuando la consulta de egresados falla, `ExAlumnosFacade` guarda el mensaje en su signal `error`,
pero nadie lo lee: `app-ex-alumnos-content` no recibe el error y muestra su estado vacío ("No se
encontraron egresados · Intenta ajustar los criterios…"), como si no hubiera egresados. Además el
facade marcaba la carga como hecha aunque hubiera fallado, y nunca limpiaba el error tras una
recarga correcta. Es el mismo problema que `hotfix-113-m` corrigió en la Base de Alumnos; acá es
B32 de la 2ª pasada de `fix-264-m` (`024b` T13).

## ACs Afectados
- `024b` T13: si la carga de Ex-Alumnos B falla y no hay egresados que mostrar, se ve el error con
  un botón "Reintentar", no "No se encontraron egresados".
- Si un refresco en segundo plano falla con egresados ya en pantalla, se siguen mostrando (SWR).

## Cambio
- **Archivo:** `src/app/core/facades/ex-alumnos.facade.ts` — una carga fallida no cuenta como
  inicializada (reintentar vuelve a cargar con skeleton) y una carga correcta limpia el error.
- **Archivo:** `src/app/shared/components/ex-alumnos-content/ex-alumnos-content.component.ts` —
  input `error`, `showLoadError` y el estado de error con "Reintentar" (output `refreshRequested`),
  igual que `app-alumnos-list-content`.
- **Archivo:** `src/app/features/admin/alumnos/ex-alumnos/admin-ex-alumnos.component.ts`,
  `features/secretaria/ex-alumnos/secretaria-ex-alumnos.component.ts` — pasan `facade.error()` y
  reintentan con `facade.loadEgresados()`.

## Test de Regresión
- `ex-alumnos.facade.spec.ts > error de carga — fix-287-m` ✓ (2 tests)
- `ex-alumnos-content.component.spec.ts > showLoadError (fix-287-m)` ✓ (3 tests)
- `e2e/alumnos-b-ficha.spec.ts > T13 (fix-287-m)` sin la marca `knownBug` ✓

## Fuera de este fix
`app-ex-alumnos-profesional-content` tiene el mismo estado vacío sin estado de error. Es de
Ex-Alumnos Profesional (`ASG-i-025`); no se toca acá.

# Hotfix: La Papelera de alumnos muestra el botón "Nueva Matrícula"
> id: hotfix-119-m-papelera-sin-nueva-matricula
> refs: fix-264-m (caso O05 de `024a`), ASG-i-024
> status: done
> closed: 2026-10-01
> created: 2026-10-01

## Problema
El hero de la Base de Alumnos arma las mismas acciones en la lista normal y en la Papelera, así que dentro de la Papelera aparece "Nueva Matrícula". En esa vista solo se restaura; matricular desde ahí no tiene relación con lo que se está viendo.

**Decisión del owner (Matías, 2026-10-01):** "Nueva Matrícula" se oculta dentro de la Papelera.

## Cambios
- **Archivo:** `src/app/core/utils/alumnos-hero-actions.utils.ts` — función pura `buildAlumnosHeroActions(trashView)`: en la Papelera devuelve solo "Papelera"; en la lista normal, "Papelera" y "Nueva Matrícula".
- **Archivo:** `src/app/shared/components/alumnos-list-content/alumnos-list-content.component.ts` — `heroActions` usa esa función.
- **Archivo:** `e2e/alumnos-b-lista.spec.ts` — el test M02 comprueba que el botón no está en la Papelera y sí en la lista.

## Verificación
Verificado el 2026-10-01: `src/app/core/utils/alumnos-hero-actions.utils.spec.ts` (2 casos) en verde y el test E2E `L01 · M01 · M02` pasa en navegador: el botón no está en la Papelera y vuelve al regresar a la lista. Captura revisada a 1600 px.

Cierre de la tanda (fix-270-m, fix-271-m, hotfix-118-m, hotfix-119-m): `npx vitest run` (2860 tests), `npm run lint:arch` (0 errores) y `npx playwright test e2e/alumnos-b-lista.spec.ts` (24/24 esperados) en verde.

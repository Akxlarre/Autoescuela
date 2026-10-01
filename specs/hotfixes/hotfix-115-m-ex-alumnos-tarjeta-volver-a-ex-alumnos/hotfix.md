# Hotfix: Desde una tarjeta de Ex-Alumnos B, "Ver ficha" y luego "Volver" lleva a la Base de Alumnos
> id: hotfix-115-m-ex-alumnos-tarjeta-volver-a-ex-alumnos
> refs: fix-264-m (bug B20)
> status: done
> closed: 2026-10-01
> created: 2026-10-01

## Problema
En la vista de tarjetas (pantalla angosta) de Ex-Alumnos B, "Ver ficha" navega sin `?from=ex-alumnos`. La ficha no sabe de dónde vino y su botón "Volver" lleva a la Base de Alumnos, donde el egresado no está. La fila de la tabla sí pasa el parámetro; la tarjeta no.

## Cambios
- **Archivo:** `src/app/shared/components/ex-alumnos-content/ex-alumnos-content.component.ts` — pasa `viewQueryParams` con `from: 'ex-alumnos'` a `app-egresado-card` (el input ya existía; Ex-Alumnos Profesional ya lo usa).
- **Archivo:** `e2e/alumnos-b-ficha.spec.ts` — el test V02 deja de estar marcado `knownBug`.

## Verificación
Verificado el 2026-10-01: el test E2E del caso pasa en navegador sin la marca `knownBug`, `npx vitest run` (2835 tests) y `npm run lint:arch` (0 errores) en verde.

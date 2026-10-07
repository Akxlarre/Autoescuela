# Hotfix: El botón de perfil del topbar no tiene nombre accesible
> id: hotfix-064-b-boton-perfil-sin-nombre-accesible
> refs: ASG-i-037 (caso Y03 del checklist 037; encontrado por `e2e/transversal-shell.spec.ts`)
> status: closed
> created: 2026-10-06

## Problema
El botón de perfil del topbar pone `[attr.aria-label]` en el host `<p-button>` (un elemento no
interactivo). El `<button>` real que recibe el foco solo contiene el ícono `user`: un lector de
pantalla lo anuncia como "botón" sin nombre. Los otros botones de ícono del topbar (búsqueda, tema,
campana) usan el input `ariaLabel` de PrimeNG, que sí llega al `<button>`.

## Cambios
- **Archivo:** `src/app/layout/topbar.component.ts` — el botón de perfil usa `[ariaLabel]` como los
  demás.

## Verificación
- `e2e/transversal-shell.spec.ts -g Y03` contra el build de producción; `ng build`, `lint:arch`.

## Resultado (2026-10-06)
- `ng build` ✓, `lint:arch` 0 errores.
- `e2e/transversal-shell.spec.ts -g Y0` contra el build de producción: 2/2 (antes Y03 fallaba: el
  `<button>` de perfil sin `aria-label`).

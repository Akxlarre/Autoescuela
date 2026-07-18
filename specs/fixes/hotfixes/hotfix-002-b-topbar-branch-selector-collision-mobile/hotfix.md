# Hotfix: Corrección de colisión Branch Selector vs toolbar en mobile
> id: hotfix-002-b-topbar-branch-selector-collision-mobile
> status: done
> closed: 2026-05-23
> created: 2026-05-23

## Problema
En pantallas estrechas (~375px) el contenedor `flex-1` del selector de sede compite por espacio con los 4 botones del toolbar derecho (~176px), colisionando visualmente a pesar de que `BranchSelectorComponent` ya oculta su label en mobile.

## Cambio
- **Archivo:** `src/app/layout/topbar.component.ts`
- **Qué cambia:** el div contenedor del branch selector pasa de `flex-1 min-w-0` a `shrink-0` en mobile y `flex-1 min-w-0` en `sm+`, eliminando la colisión.

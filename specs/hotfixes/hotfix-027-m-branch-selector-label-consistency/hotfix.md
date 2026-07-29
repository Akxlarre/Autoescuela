# Hotfix: inconsistencia "Todas las escuelas" vs "Todas las sedes" en selector de sedes

## Problema
`BranchSelectorComponent` muestra dos textos distintos para la misma opción:
- Trigger cerrado (`selectedLabel` computed, línea 465): "Todas las sedes".
- Item dentro del dropdown/panel (línea 104, modo topbar) y pill (línea 162,
  modo wizard): "Todas las escuelas".

## Fix
Unificar ambos textos a "Todas las sedes" en las 2 ocurrencias del label de
la opción "todas" (dropdown topbar y pills wizard), para que coincida con lo
que ya muestra el trigger cerrado.

## AC
- El botón trigger y el item dentro del panel dicen ambos "Todas las sedes", en modo topbar y en modo wizard.

## Cierre
- Label del item "todas" cambiado de "Todas las escuelas" a "Todas las sedes" en modo topbar (dropdown) y modo wizard (pills), en `branch-selector.component.ts`.
- Ahora coincide con el texto ya mostrado en el trigger cerrado (`selectedLabel`).
- `tsc --noEmit` limpio.

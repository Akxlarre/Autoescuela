# Hotfix: Eliminar restricción de "primeras 6 clases" para generar Carnet 12 clases
> id: hotfix-093-m-carnet-12-sin-restriccion-primeras-6
> refs: —
> status: done
> closed: 2026-08-26
> created: 2026-08-26

## Problema
`buildCarnetMenu` (usado por el menú "Carnet" en la ficha de alumno Clase B) deshabilita
"Generar Carnet 12 clases" hasta que las primeras 6 clases prácticas estén firmadas, mostrando
un hint "faltan N de las primeras 6 clases". El negocio pidió eliminar esta restricción: ambos
carnets (6 y 12 clases) deben poder generarse en cualquier momento, sin depender del progreso
de la primera etapa.

## Cambios
- **Archivo:** `src/app/core/utils/carnet-menu.util.ts` — quita el cálculo `puede12`/`faltan` y
  el `disabled`/`hint` asociado en el ítem `generar-carnet-12`; ese botón queda siempre
  habilitado igual que `generar-carnet-6`. Se mantiene `primeras6Completadas` en
  `CarnetMenuState` solo si algún otro caller lo necesita — si no, se elimina también del
  estado y sus llamadas.
- **Archivo:** `src/app/core/utils/carnet-menu.util.spec.ts` — actualiza/quita los tests que
  verifican el bloqueo por primeras 6 clases incompletas.

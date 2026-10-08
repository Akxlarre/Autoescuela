# Fix: al abrir un panel lateral, el foco del teclado se queda en la pantalla de atrás
> id: fix-357-m-el-foco-entra-al-panel-lateral-al-abrirlo
> refs: fix-319-m-testing-clase-profesional-piloto (U08) · ASG-i-025
> status: done
> closed: 2026-10-07
> created: 2026-10-07

## Root Cause
`LayoutDrawerComponent` (el host único de todos los paneles laterales) se anuncia como diálogo
(`role="dialog"`, hotfix-061-b) pero nunca mueve el foco: al abrirse, el foco sigue en el botón
que lo abrió. Con teclado hay que recorrer toda la pantalla de atrás antes de llegar al panel
(medido el 2026-10-07 en Promociones: 12 tabulaciones —buscador, filtro y los 2 botones de cada
promoción— antes de entrar a "Programar Promoción"), y al cerrarlo el foco no vuelve a donde estaba.

## ACs Afectados
Ninguno — fix autónomo.

## Cambio
- `src/app/layout/layout-drawer.component.ts`:
  - Al abrir, el foco pasa al panel (el contenedor, no un campo: no abre el teclado en móvil ni
    despliega un selector). El siguiente Tab cae en el primer control del panel.
  - Al apilar o volver dentro del panel (editar desde el detalle, "Volver"), si el foco quedó
    fuera, vuelve al panel.
  - Al cerrar, el foco vuelve al control que abrió el panel, si sigue en pantalla.
  - No es una trampa de foco: en escritorio el panel no es modal y la pantalla de atrás sigue
    siendo usable.

## Test de Regresión
E2E (`e2e/drawer-global.spec.ts`): abrir "Ver detalle" de una promoción → el foco queda dentro del
panel; Tab → sigue dentro; Escape → el panel se cierra y el foco vuelve al botón "Ver detalle".

## Progreso
- [x] Test E2E en rojo ("foco dentro del panel al abrir": falso).
- [x] Implementación. El foco se devuelve al terminar la animación de cierre, no al empezarla:
  con el panel abierto la pantalla de atrás puede estar en otra vista (tarjetas en vez de tabla)
  y el botón que lo abrió, oculto; un elemento oculto no recibe foco.
- [x] Test E2E en verde; `drawer-global` y `modal-confirmacion` completos (9/9). Specs que más usan
  paneles (`clase-profesional`, `agenda`, `alumnos-b-lista`, `instructores-alta`,
  `transversal-shell`): 132 de 136 en la corrida conjunta; los 4 restantes pasaron al repetirlos
  (3 de `transversal-shell` por interferencia entre tests, 1 de `clase-profesional` por una
  espera del menú que se corrigió en el test). Unitarios 3473 en verde, `lint:arch` 0 errores.
- [x] Revisión manual (admin, Promociones, 1440 px, abriendo con Enter): el foco queda en el panel
  sin anillo visible; al apilar "Editar promoción" vuelve al panel y el primer Tab cae en
  "Volver"; al cerrar regresa a "Ver detalle". No se probó en móvil ni con lector de pantalla.

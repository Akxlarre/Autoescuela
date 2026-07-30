# Fix: Select "Cambiar de ciclo" desborda el rail al abrirse (overlay inline)
> id: fix-049-b-ciclos-select-overlay-appendto-body
> refs: 0031-ciclos-teoricos-fill-screen
> status: done
> closed: 2026-07-16
> created: 2026-07-16

## Root Cause
En el rail "Alumnos del ciclo" (`ciclos-teoricos-content`), al pulsar "Cambiar de ciclo"
aparece un `p-select` inline. Su overlay se monta **dentro del contenedor de scroll del
roster** (`.overflow-y-auto`), no en el `<body>`. Al abrirlo, el panel + las opciones
largas ("Ciclo — Lunes 29 de junio · Autoescuela Chillán") miden ~439px contra los ~334px
del contenedor → **105px de overflow horizontal**. Por el quirk de CSS (con `overflow-y:auto`,
`overflow-x:visible` computa a `auto`), aparece un **scrollbar horizontal** y el contenido
interno se desplaza. Medido en vivo: `scrollWidth 439 > clientWidth 334`, overlay
`panelInsideScrollContainer: true`.

## ACs Afectados
Ninguno funcional — bug de layout del overlay. No cambia el flujo de mover alumno de ciclo.

## Cambio
- **Archivo:** `src/app/shared/components/ciclos-teoricos-content/ciclos-teoricos-content.component.ts`
- **Qué cambia:** agregar `appendTo="body"` a los `p-select` (patrón canónico del
  proyecto para escapar de scroll containers, cf. `assignment.component`): al select del
  roster ("Cambiar a…") — el del bug — y al selector de ciclo (`w-full`), preventivo por
  el mismo riesgo. El overlay pasa a montarse en `<body>` → no contribuye al `scrollWidth`
  del rail → sin scrollbar horizontal ni desplazamiento.

## Test de Regresión
Bug de layout (template). Verificación:
- `ng build` compila.
- `/verify` (Playwright): abrir "Cambiar de ciclo" y desplegar el select → el rail NO gana
  scrollbar horizontal (`scrollWidth === clientWidth`) y el overlay se monta fuera del
  contenedor de scroll. Light + dark.

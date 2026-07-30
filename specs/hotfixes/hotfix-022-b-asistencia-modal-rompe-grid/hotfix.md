# Hotfix: Modal "Justificar" rompe el grid de Asistencia (regresión de hotfix-021)
> id: hotfix-022-b-asistencia-modal-rompe-grid
> status: done
> closed: 2026-07-18
> created: 2026-07-18

## Problema
El usuario reportó que en Asistencia B los elementos (KPIs, tabla) se ven más
chicos y "más arriba" que en Base Alumnos B (el canon de referencia del layout
app-like fill-screen). Causa raíz confirmada (`asistencia-clase-b-content.component.ts:648-701`):
el wrapper `<div [appModalOverlay]="justifyModalOpen()">` del modal "Justificar
Inasistencia" (agregado en hotfix-021 para migrarlo al canon) quedó como **hijo
directo de `.bento-grid`** (el grid abre en la línea 88, cierra en la 702), sin
ninguna clase `bento-*`. `ModalOverlayDirective` necesita que ese wrapper exista
siempre en el DOM (para poder moverlo al overlay cuando se abre), así que aunque
el modal esté cerrado, el `<div>` vacío sigue siendo un ítem del grid.

Sin clase de proporción, CSS Grid lo coloca por auto-placement usando
`grid-auto-rows: minmax(120px, auto)` (`_bento-grid.scss`) — una fila fantasma de
≥120px dentro del contenedor de alto fijo `calc(100vh - 120px)` de
`.bento-grid--fill-screen-kpi`. Esa fila le resta alto real a la fila `fill`
(`minmax(0,1fr)`, donde vive la tabla/KPIs/tabs), comprimiéndola — de ahí que
todo se vea más chico y con espacio muerto abajo.

`admin-alumnos.component.ts` (el canon) NO tiene este problema porque su modal
equivalente vive como *sibling* del `.bento-grid` a nivel del Smart component,
nunca dentro de él.

## Cambios
- **Archivo:** `src/app/shared/components/asistencia-clase-b-content/asistencia-clase-b-content.component.ts`
  - Mover el bloque `<div [appModalOverlay]="justifyModalOpen()">...</div>`
    (líneas 648-701) a **fuera** del `.bento-grid`, como sibling justo después de
    su `</div>` de cierre — mismo patrón que usa `admin-alumnos.component.ts`
    para su modal. Sin cambios de lógica/contrato, solo reubicación en el DOM.

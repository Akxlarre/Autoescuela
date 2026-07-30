# Hotfix: Asistencia B — 2 modales más fuera del canon
> id: hotfix-021-b-asistencia-b-modales-canon
> status: done
> closed: 2026-07-18
> created: 2026-07-17

## Problema
Continuación de hotfix-020 (migración de modales al canon en Ciclos Teóricos):
QA del owner encontró 2 casos más en el mismo dominio (Asistencia B) sin el patrón
canónico (`[appModalOverlay]` + `appAnimateIn` + backdrop con tokens, igual que
`eliminar-alumno-modal` y el modal "Incorporar alumno" ya migrado):

1. **Modal "Justificar Inasistencia"** (`asistencia-clase-b-content.component.ts:644-694`)
   usa `bg-black/40` — color arbitrario de Tailwind, prohibido por
   `visual-system.md` — y no tiene `[appModalOverlay]` ni `appAnimateIn`.
2. **Panel "Elegir destinatarios y enviar Zoom"** (`ciclos-teoricos-content.component.ts`,
   dentro del `@for` de clases) es un panel inline expandido dentro de la card de la
   clase, no un modal. El owner pidió que sea "un modal muy similar al de incorporar"
   (mismo patrón backdrop+card+header+body+footer que el modal "Incorporar alumno").

## Cambios
- **Archivo:** `src/app/shared/components/asistencia-clase-b-content/asistencia-clase-b-content.component.ts`
  - Importar `AnimateInDirective`, `ModalOverlayDirective`.
  - Reemplazar el backdrop `bg-black/40` por `bg-(--overlay-backdrop) backdrop-blur-sm`.
  - Envolver en `[appModalOverlay]="justifyModalOpen()"`, agregar `appAnimateIn` a la
    card, agregar cierre por Escape (`(document:keydown.escape)`).
- **Archivo:** `src/app/shared/components/ciclos-teoricos-content/ciclos-teoricos-content.component.ts`
  - Sacar el panel "Destinatarios" del `@for` de clases (ya no vive inline en la
    card) y moverlo a un modal a nivel raíz del componente, igual patrón que el
    modal "Incorporar alumno" (backdrop + card `rounded-2xl` + `[appModalOverlay]`
    + `appAnimateIn` + cierre Escape/backdrop/X).
  - Nuevo computed `sendingClase` (deriva la clase objetivo desde `openPanelClassId()`
    + `clases()`) para que el modal a nivel raíz sepa qué clase está enviando.
  - Sin cambios de lógica: mismo `toggleRecipient`/`toggleAllRecipients`/`confirmSend`/
    `closeSendPanel`, mismo contrato de outputs.
